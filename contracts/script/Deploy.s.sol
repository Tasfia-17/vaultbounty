// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/BountyRegistry.sol";
import "../src/BountyReadCondition.sol";
import "../src/ResearcherWriteCondition.sol";
import "../src/MockTEEVerifier.sol";
import "../src/VulnerableVault.sol";

contract Deploy is Script {
    function run() external {
        address teeRelayer = vm.envAddress("TEE_RELAYER_ADDRESS");
        address dao        = vm.envAddress("DAO_ADDRESS");
        bool    demoMode   = vm.envOr("DEMO_MODE", true);

        vm.startBroadcast();

        // 1. TEE verifier (dao governs operator set)
        MockTEEVerifier verifier = new MockTEEVerifier(dao);

        // 2. Register teeRelayer as approved TEE operator
        verifier.addOperator(teeRelayer);

        // 3. Core registry
        BountyRegistry reg = new BountyRegistry(
            address(verifier), teeRelayer, dao, demoMode
        );

        // 4. CDR conditions
        BountyReadCondition     readCond  = new BountyReadCondition(address(reg));
        ResearcherWriteCondition writeCond = new ResearcherWriteCondition();

        // 5. Demo contracts — deploy a vulnerable vault and seed it
        VulnerableVault vuln = new VulnerableVault();
        vuln.deposit{value: 0.05 ether}(); // honeypot: 0.05 IP testnet

        vm.stopBroadcast();

        console.log("MockTEEVerifier:         ", address(verifier));
        console.log("BountyRegistry:          ", address(reg));
        console.log("BountyReadCondition:     ", address(readCond));
        console.log("ResearcherWriteCondition:", address(writeCond));
        console.log("VulnerableVault:         ", address(vuln));
        console.log("  Vault balance:          0.05 ETH (honeypot)");
    }
}
