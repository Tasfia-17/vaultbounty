// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./interfaces/ICDRCondition.sol";
import "./BountyRegistry.sol";

/// @title  BountyReadCondition
/// @notice CDR read condition implementing three disclosure paths:
///
///   Path 0 - VERIFY:   TEE/DAO members can verify exploit validity (report not yet settled/escalated)
///   Path 1 - DISCLOSE: Company reads decrypted exploit after paying (report SETTLED)
///   Path 2 - ESCALATE: DAO reads after deadline passes without payment (report ESCALATED)
///
/// conditionData  = abi.encode(uint256 reportId)         - set at vault allocation
/// accessAuxData  = abi.encode(uint8 path, address caller) - passed at read time
contract BountyReadCondition is ICDRReadCondition {

    uint8 public constant PATH_VERIFY   = 0;
    uint8 public constant PATH_DISCLOSE = 1;
    uint8 public constant PATH_ESCALATE = 2;

    BountyRegistry public immutable registry;

    constructor(address _registry) {
        registry = BountyRegistry(_registry);
    }

    /// @inheritdoc ICDRReadCondition
    function checkReadCondition(
        uint32 /* uuid */,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view override returns (bool) {
        uint256 reportId = abi.decode(conditionData, (uint256));
        (uint8 path) = abi.decode(accessAuxData, (uint8));

        BountyRegistry.Report memory r = registry.getReport(reportId);

        if (path == PATH_VERIFY) {
            // Anyone can verify - report must exist and not yet be resolved
            return r.researcher != address(0)
                && r.state != BountyRegistry.State.SETTLED
                && r.state != BountyRegistry.State.ESCALATED;
        }

        if (path == PATH_DISCLOSE) {
            // Only the registered company, only after settlement
            return caller == r.company
                && r.state == BountyRegistry.State.SETTLED;
        }

        if (path == PATH_ESCALATE) {
            // Anyone can trigger after escalation (DAO multisig typically)
            return r.state == BountyRegistry.State.ESCALATED;
        }

        return false;
    }
}
