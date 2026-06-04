// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./interfaces/ICDRCondition.sol";
import "./MockTEEVerifier.sol";

/// @title  BountyRegistry
/// @notice Manages exploit report lifecycle: submission, TEE attestation, escrow, payment, escalation.
///         The CDR vault UUID is the primary key linking on-chain state to encrypted exploit data.
contract BountyRegistry {
    // ─── Enums ────────────────────────────────────────────────────────────────

    enum Severity { NONE, LOW, MEDIUM, HIGH, CRITICAL }

    enum State {
        PENDING,    // submitted, awaiting TEE attestation
        ATTESTED,   // TEE confirmed exploit is valid + severity set
        SETTLED,    // company paid — exploit decrypted to company
        ESCALATED   // deadline passed unpaid — released to DAO
    }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Report {
        uint32  vaultUuid;         // CDR vault holding encrypted exploit
        address researcher;        // report submitter
        address targetContract;    // vulnerable contract (informational)
        address company;           // entity to pay the bounty
        address ipId;              // Story Protocol IP Asset ID (set after registration)
        Severity severity;         // set by TEE attestation
        bytes32 attestationHash;   // keccak256 of TEE attestation payload bytes
        uint256 bountyAmount;      // ETH amount the company must pay
        uint256 escalateAt;        // deadline for company payment
        State   state;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    MockTEEVerifier public immutable teeVerifier;
    address         public immutable daoMultisig;
    bool            public immutable demoMode;

    // Legacy: EOA relayer allowed to attest without full TEE proof (for demo fallback)
    address public immutable teeRelayer;

    uint256 public constant ESCALATION_PERIOD      = 7 days;
    uint256 public constant DEMO_ESCALATION_PERIOD = 2 minutes;

    uint256 public nextReportId;
    mapping(uint256 => Report)  public reports;
    mapping(uint32  => uint256) public vaultToReport;

    // ─── Events ───────────────────────────────────────────────────────────────

    event ReportSubmitted(uint256 indexed reportId, uint32 vaultUuid, address researcher, address targetContract);
    event IpIdSet(uint256 indexed reportId, address ipId);
    event Attested(uint256 indexed reportId, Severity severity, bytes32 attestationHash);
    event Settled(uint256 indexed reportId, address company, uint256 amount);
    event Escalated(uint256 indexed reportId);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error Unauthorized();
    error WrongState(State current, State required);
    error DeadlineNotPassed();
    error AlreadyPaid();
    error InsufficientPayment(uint256 required, uint256 sent);
    error VaultAlreadyUsed(uint32 vaultUuid);
    error ExploitNotConfirmed();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _teeVerifier,
        address _teeRelayer,
        address _daoMultisig,
        bool    _demoMode
    ) {
        teeVerifier  = MockTEEVerifier(_teeVerifier);
        teeRelayer   = _teeRelayer;
        daoMultisig  = _daoMultisig;
        demoMode     = _demoMode;
    }

    // ─── External ─────────────────────────────────────────────────────────────

    function submitReport(
        uint32  vaultUuid,
        address targetContract,
        address company
    ) external returns (uint256 reportId) {
        if (vaultToReport[vaultUuid] != 0) revert VaultAlreadyUsed(vaultUuid);

        reportId = ++nextReportId;
        uint256 period = demoMode ? DEMO_ESCALATION_PERIOD : ESCALATION_PERIOD;

        reports[reportId] = Report({
            vaultUuid:       vaultUuid,
            researcher:      msg.sender,
            targetContract:  targetContract,
            company:         company,
            ipId:            address(0),
            severity:        Severity.NONE,
            attestationHash: bytes32(0),
            bountyAmount:    0,
            escalateAt:      block.timestamp + period,
            state:           State.PENDING
        });
        vaultToReport[vaultUuid] = reportId;

        emit ReportSubmitted(reportId, vaultUuid, msg.sender, targetContract);
    }

    function setIpId(uint256 reportId, address ipId) external {
        Report storage r = reports[reportId];
        if (r.researcher != msg.sender) revert Unauthorized();
        r.ipId = ipId;
        emit IpIdSet(reportId, ipId);
    }

    /// @notice Full TEE attestation path: verifier validates operator signature.
    ///         Decodes the attestation, confirms exploit succeeded, sets severity.
    function attestWithProof(
        uint256       reportId,
        bytes calldata attestationBytes,
        bytes calldata signature,
        uint256        bountyAmount
    ) external {
        Report storage r = reports[reportId];
        if (r.state != State.PENDING) revert WrongState(r.state, State.PENDING);

        (bool valid, , MockTEEVerifier.Attestation memory att) =
            teeVerifier.verifyView(attestationBytes, signature);

        if (!valid)              revert Unauthorized();
        if (!att.exploitSuccess) revert ExploitNotConfirmed();
        if (att.reportId != reportId) revert Unauthorized();

        // Consume nonce — prevents replaying same attestation
        teeVerifier.verify(attestationBytes, signature);

        r.severity        = Severity(att.severity);
        r.attestationHash = keccak256(attestationBytes);
        r.bountyAmount    = bountyAmount;
        r.state           = State.ATTESTED;

        emit Attested(reportId, r.severity, r.attestationHash);
    }

    /// @notice Fallback: EOA relayer posts attestation (demo / no TEE infra available).
    ///         Only callable by the registered teeRelayer EOA.
    function attestSeverity(
        uint256  reportId,
        Severity severity,
        bytes32  attestationHash,
        uint256  bountyAmount
    ) external {
        if (msg.sender != teeRelayer) revert Unauthorized();
        Report storage r = reports[reportId];
        if (r.state != State.PENDING) revert WrongState(r.state, State.PENDING);

        r.severity        = severity;
        r.attestationHash = attestationHash;
        r.bountyAmount    = bountyAmount;
        r.state           = State.ATTESTED;

        emit Attested(reportId, severity, attestationHash);
    }

    /// @notice Company pays the bounty atomically. Funds split: 80/15/5.
    function settle(uint256 reportId) external payable {
        Report storage r = reports[reportId];
        if (r.state != State.ATTESTED) revert WrongState(r.state, State.ATTESTED);
        if (msg.value < r.bountyAmount) revert InsufficientPayment(r.bountyAmount, msg.value);

        r.state = State.SETTLED;

        uint256 total      = msg.value;
        uint256 daoShare   = total * 15 / 100;
        uint256 relayShare = total *  5 / 100;
        uint256 resShare   = total - daoShare - relayShare;

        _safeTransfer(r.researcher, resShare);
        _safeTransfer(daoMultisig,  daoShare);
        _safeTransfer(teeRelayer,   relayShare);

        emit Settled(reportId, msg.sender, msg.value);
    }

    /// @notice Anyone can escalate after the deadline if the company hasn't paid.
    function escalate(uint256 reportId) external {
        Report storage r = reports[reportId];
        if (r.state == State.SETTLED)          revert AlreadyPaid();
        if (block.timestamp <= r.escalateAt)   revert DeadlineNotPassed();

        r.state = State.ESCALATED;
        emit Escalated(reportId);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getReport(uint256 reportId) external view returns (Report memory) {
        return reports[reportId];
    }

    function getReportByVault(uint32 vaultUuid) external view returns (Report memory) {
        return reports[vaultToReport[vaultUuid]];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
