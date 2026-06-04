// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/BountyRegistry.sol";
import "../src/BountyReadCondition.sol";
import "../src/ResearcherWriteCondition.sol";
import "../src/MockTEEVerifier.sol";
import "../src/VulnerableVault.sol";

contract VaultBountyTest is Test {
    BountyRegistry           registry;
    BountyReadCondition      readCond;
    ResearcherWriteCondition writeCond;
    MockTEEVerifier          verifier;
    VulnerableVault          vuln;

    address researcher  = makeAddr("researcher");
    address company     = makeAddr("company");
    address dao         = makeAddr("dao");
    address target      = makeAddr("target");

    // TEE operator: use a known private key so we can sign attestations
    uint256 constant TEE_OPERATOR_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address teeOperator;

    function setUp() public {
        teeOperator = vm.addr(TEE_OPERATOR_PK);

        verifier  = new MockTEEVerifier(dao);
        vm.prank(dao);
        verifier.addOperator(teeOperator);

        registry  = new BountyRegistry(address(verifier), teeOperator, dao, true); // demoMode
        readCond  = new BountyReadCondition(address(registry));
        writeCond = new ResearcherWriteCondition();
        vuln      = new VulnerableVault();
    }

    // ── Helper: build + sign a TEE attestation ───────────────────────────────

    function _makeAttestation(
        uint256 reportId,
        address targetContract,
        uint8   severity,
        bool    exploitSuccess
    ) internal view returns (bytes memory attestBytes, bytes memory sig) {
        MockTEEVerifier.Attestation memory att = MockTEEVerifier.Attestation({
            reportId:       reportId,
            targetContract: targetContract,
            severity:       severity,
            exploitSuccess: exploitSuccess,
            fundsDrained:   1 ether,
            nonce:          keccak256(abi.encode(reportId, block.timestamp)),
            timestamp:      block.timestamp
        });
        attestBytes = abi.encode(att);
        bytes32 hash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(attestBytes)
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(TEE_OPERATOR_PK, hash);
        sig = abi.encodePacked(r, s, v);
    }

    function _checkRead(uint32 uuid, uint256 rid, uint8 path, address caller) internal view returns (bool) {
        return readCond.checkReadCondition(uuid, abi.encode(path), abi.encode(rid), caller);
    }

    // ── Happy path ───────────────────────────────────────────────────────────

    function test_fullFlow() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(42, target, company);
        assertEq(rid, 1);

        // Gates before attestation
        assertTrue(_checkRead(42, rid, 0, researcher),  "VERIFY open before attest");
        assertFalse(_checkRead(42, rid, 1, company),    "DISCLOSE closed before pay");
        assertFalse(_checkRead(42, rid, 2, dao),        "ESCALATE closed before deadline");

        // TEE attests via full proof path
        (bytes memory att, bytes memory sig) = _makeAttestation(rid, target, 4, true);
        registry.attestWithProof(rid, att, sig, 1 ether);

        assertFalse(_checkRead(42, rid, 1, company),   "DISCLOSE still closed before pay");

        // Company pays
        vm.deal(company, 2 ether);
        vm.prank(company);
        registry.settle{value: 1 ether}(rid);

        assertFalse(_checkRead(42, rid, 0, researcher), "VERIFY closed after settle");
        assertTrue(_checkRead(42, rid, 1, company),     "DISCLOSE open after pay");
        assertFalse(_checkRead(42, rid, 1, dao),        "DISCLOSE closed for non-company");
        assertFalse(_checkRead(42, rid, 2, dao),        "ESCALATE closed after settle");
    }

    function test_attestWithProof_rejectsFailedExploit() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(55, target, company);

        // exploitSuccess = false → should revert
        (bytes memory att, bytes memory sig) = _makeAttestation(rid, target, 4, false);
        vm.expectRevert(BountyRegistry.ExploitNotConfirmed.selector);
        registry.attestWithProof(rid, att, sig, 1 ether);
    }

    function test_attestWithProof_rejectsUnknownOperator() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(66, target, company);

        // Sign with a different key not in operator set
        uint256 badPk = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef;
        MockTEEVerifier.Attestation memory a = MockTEEVerifier.Attestation({
            reportId: rid, targetContract: target, severity: 4,
            exploitSuccess: true, fundsDrained: 1 ether,
            nonce: bytes32(uint256(1)), timestamp: block.timestamp
        });
        bytes memory attBytes = abi.encode(a);
        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(attBytes)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPk, hash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert();
        registry.attestWithProof(rid, attBytes, badSig, 1 ether);
    }

    function test_nonceReplay() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(77, target, company);
        (bytes memory att, bytes memory sig) = _makeAttestation(rid, target, 4, true);

        // First attest succeeds
        registry.attestWithProof(rid, att, sig, 1 ether);

        // Try to replay on a new report - should fail because nonce is consumed
        vm.prank(researcher);
        uint256 rid2 = registry.submitReport(88, target, company);
        // Reuse same attestation bytes (same nonce) → should revert
        vm.expectRevert();
        registry.attestWithProof(rid2, att, sig, 1 ether);
    }

    function test_escalationPath() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(99, target, company);

        (bytes memory att, bytes memory sig) = _makeAttestation(rid, target, 3, true);
        registry.attestWithProof(rid, att, sig, 0.5 ether);

        vm.expectRevert(BountyRegistry.DeadlineNotPassed.selector);
        registry.escalate(rid);

        vm.warp(block.timestamp + 3 minutes);
        registry.escalate(rid);

        assertTrue(_checkRead(99, rid, 2, dao),  "ESCALATE open after escalation");
        assertFalse(_checkRead(99, rid, 1, company), "DISCLOSE closed after escalation");
    }

    function test_paymentSplit() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(111, target, company);
        (bytes memory att, bytes memory sig) = _makeAttestation(rid, target, 3, true);
        registry.attestWithProof(rid, att, sig, 1 ether);

        vm.deal(company, 2 ether);
        vm.prank(company);
        registry.settle{value: 1 ether}(rid);

        assertEq(researcher.balance,   0.80 ether, "researcher 80%");
        assertEq(dao.balance,          0.15 ether, "dao 15%");
        assertEq(teeOperator.balance,  0.05 ether, "tee operator 5%");
    }

    function test_fallbackEOAAttest() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(222, target, company);

        // Fallback EOA path still works
        vm.prank(teeOperator);
        registry.attestSeverity(rid, BountyRegistry.Severity.HIGH, keccak256("proof"), 0.5 ether);

        BountyRegistry.Report memory r = registry.getReport(rid);
        assertEq(uint8(r.state), uint8(BountyRegistry.State.ATTESTED));
    }

    function test_writeCondition() public {
        bytes memory condData = abi.encode(researcher);
        assertTrue(writeCond.checkWriteCondition(1, "", condData, researcher));
        assertFalse(writeCond.checkWriteCondition(1, "", condData, company));
    }

    function test_cannotDoubleSubmitVault() public {
        vm.prank(researcher);
        registry.submitReport(55, target, company);
        vm.prank(researcher);
        vm.expectRevert(abi.encodeWithSelector(BountyRegistry.VaultAlreadyUsed.selector, uint32(55)));
        registry.submitReport(55, target, company);
    }

    function test_insufficientPaymentReverts() public {
        vm.prank(researcher);
        uint256 rid = registry.submitReport(333, target, company);
        (bytes memory att, bytes memory sig) = _makeAttestation(rid, target, 4, true);
        registry.attestWithProof(rid, att, sig, 1 ether);

        vm.deal(company, 2 ether);
        vm.prank(company);
        vm.expectRevert(abi.encodeWithSelector(BountyRegistry.InsufficientPayment.selector, 1 ether, 0.5 ether));
        registry.settle{value: 0.5 ether}(rid);
    }

    // ── VulnerableVault exploit demo ─────────────────────────────────────────

    function test_reentrancyExploitDrainsVault() public {
        // Seed vault with 1 ETH (simulates honeypot)
        vm.deal(address(this), 2 ether);
        vuln.deposit{value: 1 ether}();
        assertEq(address(vuln).balance, 1 ether);

        // Deploy exploit contract and attack
        ExploitAttack exploit = new ExploitAttack(address(vuln));
        vm.deal(address(exploit), 0.1 ether);
        exploit.attack{value: 0.1 ether}();

        // Vault is drained
        assertEq(address(vuln).balance, 0, "vault drained");
        assertGt(address(exploit).balance, 1 ether, "attacker holds funds");
    }
}
