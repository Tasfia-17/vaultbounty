// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./interfaces/ICDRCondition.sol";

/// @title  ResearcherWriteCondition
/// @notice CDR write condition - only the registered researcher can write to the vault.
///         conditionData = abi.encode(address researcher)
contract ResearcherWriteCondition is ICDRWriteCondition {
    function checkWriteCondition(
        uint32 /* uuid */,
        bytes calldata /* accessAuxData */,
        bytes calldata conditionData,
        address caller
    ) external pure override returns (bool) {
        address researcher = abi.decode(conditionData, (address));
        return caller == researcher;
    }
}
