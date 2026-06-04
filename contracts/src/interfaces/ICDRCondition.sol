// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Official CDR read condition interface (Story Protocol Aeneid)
interface ICDRReadCondition {
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool);
}

/// @notice Official CDR write condition interface
interface ICDRWriteCondition {
    function checkWriteCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool);
}
