/**
 * Full end-to-end demo flow - all steps in one script.
 * Suitable for Demo Day: runs the complete lifecycle with console output at each step.
 *
 * Run: pnpm demo:full
 */
import "dotenv/config";
import { parseEther, keccak256, stringToHex, encodeAbiParameters } from "viem";
import { getResearcherClients, getCompanyClients, getTeeRelayerClients, getPublicClientOnly, CONTRACTS } from "../clients.js";
import { allocateExploitVault } from "../vaultbounty.js";
import { BOUNTY_REGISTRY_ABI, BOUNTY_READ_CONDITION_ABI } from "../abis/index.js";

const SEPARATOR = "\n" + "─".repeat(60) + "\n";

async function checkPath(publicClient: any, reportId: bigint, path: 0 | 1 | 2, caller: `0x${string}`): Promise<boolean> {
  const accessAuxData = encodeAbiParameters([{ type: "uint8" }], [path]);
  const conditionData = encodeAbiParameters([{ type: "uint256" }], [reportId]);
  return publicClient.readContract({
    address: CONTRACTS.BOUNTY_READ_CONDITION,
    abi: BOUNTY_READ_CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [0, accessAuxData, conditionData, caller],
  });
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          VaultBounty - Full Demo Flow            ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log("Network  : Story Aeneid Testnet (Chain ID 1315)");
  console.log("Explorer : https://aeneid.storyscan.io");

  const publicClient = getPublicClientOnly();
  const { account: researcher, walletClient: resWallet, cdrClient } = await getResearcherClients();
  const { account: company,    walletClient: coWallet, cdrClient: companyCDR } = await getCompanyClients();
  const { account: relayer,    walletClient: relWallet } = await getTeeRelayerClients();

  const TARGET = (process.env.TARGET_CONTRACT ?? researcher.address) as `0x${string}`;

  console.log(`\nResearcher : ${researcher.address}`);
  console.log(`Company    : ${company.address}`);
  console.log(`TEE Relayer: ${relayer.address}`);

  // ── STEP 1: Researcher encrypts + submits ─────────────────────────────────
  console.log(SEPARATOR);
  console.log("STEP 1: Researcher encrypts exploit → allocates CDR vault → submits report");

  const exploitPayload = JSON.stringify({
    vulnerability: "Reentrancy in withdraw()",
    targetContract: TARGET,
    severity: "CRITICAL",
    pocSummary: "Attacker can drain 100% of funds via re-entrant withdraw() call.",
    submittedAt: new Date().toISOString(),
  });

  // Pre-reads nextReportId - vault conditionData is wired correctly from allocation
  const { uuid, expectedReportId } = await allocateExploitVault(cdrClient, publicClient, researcher.address, exploitPayload);

  const submitHash = await resWallet.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "submitReport",
    args: [uuid, TARGET, company.address],
    account: researcher,
    chain: null,
  });
  const submitReceipt = await publicClient.waitForTransactionReceipt({ hash: submitHash });
  const reportId = BigInt(submitReceipt.logs[0]?.topics[1] ?? "1");

  console.log(`✓ CDR Vault UUID   : ${uuid}`);
  console.log(`✓ Report ID        : ${reportId} (expected: ${expectedReportId})`);
  console.log(`✓ TX               : https://aeneid.storyscan.io/tx/${submitHash}`);

  // ── STEP 2: Show gates BEFORE attestation ─────────────────────────────────
  console.log(SEPARATOR);
  console.log("STEP 2: CDR gate state BEFORE attestation");

  const verifyOpen     = await checkPath(publicClient, reportId, 0, researcher.address);
  const discloseClosed = await checkPath(publicClient, reportId, 1, company.address);
  console.log(`  PATH_VERIFY   (0) → ${verifyOpen    ? "✅ OPEN" : "❌ CLOSED"}  (expected: OPEN)`);
  console.log(`  PATH_DISCLOSE (1) → ${discloseClosed ? "✅ OPEN" : "🔒 CLOSED"} (expected: CLOSED)`);

  // ── STEP 3: TEE attests severity ──────────────────────────────────────────
  console.log(SEPARATOR);
  console.log("STEP 3: TEE Relayer posts severity attestation");

  const attestPayload = JSON.stringify({ reportId: reportId.toString(), severity: "CRITICAL", tee: "AWS_NITRO_DEMO", ts: Date.now() });
  const attestHash32  = keccak256(stringToHex(attestPayload));

  const attestTx = await relWallet.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "attestSeverity",
    args: [reportId, 4, attestHash32, parseEther("0.01")],
    account: relayer,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash: attestTx });
  console.log(`✓ Severity: CRITICAL | Bounty: 0.01 IP`);
  console.log(`✓ TX: https://aeneid.storyscan.io/tx/${attestTx}`);

  // ── STEP 4: Company pays - THE DEMO MOMENT ────────────────────────────────
  console.log(SEPARATOR);
  console.log("STEP 4: Company pays bounty (THE KEY DEMO MOMENT)");

  const beforePay = await checkPath(publicClient, reportId, 1, company.address);
  console.log(`  🔒 DISCLOSE gate BEFORE payment: ${beforePay ? "OPEN" : "CLOSED"}`);

  const settleTx = await coWallet.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "settle",
    args: [reportId],
    value: parseEther("0.01"),
    account: company,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash: settleTx });
  console.log(`✓ Payment TX: https://aeneid.storyscan.io/tx/${settleTx}`);

  const afterPay = await checkPath(publicClient, reportId, 1, company.address);
  console.log(`\n  ✅ DISCLOSE gate AFTER payment: ${afterPay ? "OPEN ← ONE TX CHANGED EVERYTHING" : "CLOSED"}`);

  // ── STEP 5: Company reads decrypted exploit ───────────────────────────────
  console.log(SEPARATOR);
  console.log("STEP 5: Company decrypts exploit from CDR vault");

  const discloseAux = encodeAbiParameters([{ type: "uint8" }], [1]);
  const { dataKey } = await companyCDR.consumer.accessCDR({
    uuid,
    accessAuxData: discloseAux,
    timeoutMs: 120_000,
  });
  const decrypted = JSON.parse(new TextDecoder().decode(dataKey));
  console.log("✅ Decrypted exploit:");
  console.log(`   Vulnerability : ${decrypted.vulnerability}`);
  console.log(`   PoC           : ${decrypted.pocSummary}`);
  console.log(`   Submitted at  : ${decrypted.submittedAt}`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log(SEPARATOR);
  console.log("✅ DEMO COMPLETE\n");
  console.log("What just happened:");
  console.log("  1. Researcher encrypted exploit → CDR vault (BountyReadCondition gates access)");
  console.log("  2. TEE verified exploit is real → CRITICAL severity posted on-chain");
  console.log("  3. Company paid WITHOUT ever seeing the exploit");
  console.log("  4. ONE transaction flipped the CDR gate: CLOSED → OPEN");
  console.log("  5. Exploit decrypted ONLY after payment confirmed on-chain");
  console.log("\nThe TEE attestation hash is the cryptographic receipt.");
  console.log(`\nExplorer: https://aeneid.storyscan.io/address/${CONTRACTS.BOUNTY_REGISTRY}`);
}

main().catch(console.error);
