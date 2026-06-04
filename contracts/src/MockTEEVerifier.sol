// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title  MockTEEVerifier
/// @notice Hackathon-grade TEE verifier. A DAO-approved operator signs an attestation
///         payload off-chain (simulating what an Intel TDX enclave would produce).
///         This contract checks that signature. Production upgrade: replace with DCAP
///         on-chain quote verification checking MRTD + RTMR measurements.
contract MockTEEVerifier {
    // ─── Storage ──────────────────────────────────────────────────────────────

    address public dao;
    mapping(address => bool)    public approvedOperators;
    mapping(bytes32 => bool)    public usedNonces; // replay protection

    // ─── Events ───────────────────────────────────────────────────────────────

    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotDAO();
    error NonceUsed(bytes32 nonce);
    error InvalidSignature();
    error UnknownOperator(address operator);

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Attestation {
        uint256 reportId;
        address targetContract;
        uint8   severity;        // maps to BountyRegistry.Severity
        bool    exploitSuccess;
        uint256 fundsDrained;
        bytes32 nonce;           // random bytes32 to prevent replay
        uint256 timestamp;
    }

    constructor(address _dao) {
        dao = _dao;
    }

    modifier onlyDAO() {
        if (msg.sender != dao) revert NotDAO();
        _;
    }

    // ─── Operator management ──────────────────────────────────────────────────

    function addOperator(address op) external onlyDAO {
        approvedOperators[op] = true;
        emit OperatorAdded(op);
    }

    function removeOperator(address op) external onlyDAO {
        approvedOperators[op] = false;
        emit OperatorRemoved(op);
    }

    // ─── Verification ─────────────────────────────────────────────────────────

    /// @notice Verify a TEE attestation. Returns the decoded attestation if valid.
    /// @param attestation  ABI-encoded Attestation struct.
    /// @param signature    ECDSA signature over keccak256(abi.encode(attestation)).
    function verify(
        bytes calldata attestation,
        bytes calldata signature
    ) external returns (Attestation memory att) {
        att = abi.decode(attestation, (Attestation));

        if (usedNonces[att.nonce]) revert NonceUsed(att.nonce);

        bytes32 hash = keccak256(attestation);
        address signer = _recover(hash, signature);

        if (!approvedOperators[signer]) revert UnknownOperator(signer);

        usedNonces[att.nonce] = true;
    }

    /// @notice Pure verification — does not consume nonce. For condition contracts to
    ///         validate without side effects.
    function verifyView(
        bytes calldata attestation,
        bytes calldata signature
    ) external view returns (bool valid, address signer, Attestation memory att) {
        att = abi.decode(attestation, (Attestation));
        if (usedNonces[att.nonce]) return (false, address(0), att);
        bytes32 hash = keccak256(attestation);
        signer = _recover(hash, signature);
        valid = approvedOperators[signer];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) revert InvalidSignature();
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        address recovered = ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)),
            v, r, s
        );
        if (recovered == address(0)) revert InvalidSignature();
        return recovered;
    }
}
