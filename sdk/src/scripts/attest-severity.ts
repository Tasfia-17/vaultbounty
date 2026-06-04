/**
 * Step 2: Post TEE severity attestation on-chain.
 *
 * Primary path  (USE_TEE_SERVICE=true, default):
 *   Calls the TEE service → gets signed attestation → calls attestWithProof on-chain.
 *   This is the full cryptographic proof path.
 *
 * Fallback path (USE_TEE_SERVICE=false):
 *   EOA signs a hash and calls attestSeverity directly.
 *   Use when TEE service is unavailable.
 *
 * Run: REPORT_ID=1 TARGET=0x... pnpm demo:attest
 */
import "dotenv/config";
import { keccak256, stringToHex, parseEther, encodeAbiParameters, toHex, fromHex, type Hex } from "viem";
import { getTeeRelayerClients, CONTRACTS } from "../clients.js";
import { BOUNTY_REGISTRY_ABI, SeverityLabel } from "../index.js";

const SEVERITY_CRITICAL = 4;

async function main() {
  const reportId      = BigInt(process.env.REPORT_ID  ?? "1");
  const severity      = Number(process.env.SEVERITY   ?? SEVERITY_CRITICAL);
  const bountyEth     = process.env.BOUNTY_ETH        ?? "0.01";
  const targetContract = (process.env.TARGET_CONTRACT ?? "0x0000000000000000000000000000000000000001") as Hex;
  const useTeeService  = process.env.USE_TEE_SERVICE !== "false";
  const teeUrl         = process.env.TEE_SERVICE_URL   ?? "http://localhost:3001";

  console.log("=== VaultBounty: TEE Attestation ===\n");
  console.log(`reportId : ${reportId}`);
  console.log(`severity : ${SeverityLabel[severity]}`);
  console.log(`bounty   : ${bountyEth} IP`);
  console.log(`mode     : ${useTeeService ? "TEE service (attestWithProof)" : "EOA fallback (attestSeverity)"}`);

  const { account, walletClient, publicClient } = await getTeeRelayerClients();
  console.log("TEE Operator:", account.address);

  let txHash: Hex;

  if (useTeeService) {
    // ── Primary: call TEE service, post signed attestation on-chain ────────
    const exploitPayload = JSON.stringify({
      severity: SeverityLabel[severity],
      pocSummary: "Reentrancy exploit - 100% fund drainage",
      targetContract,
    });

    console.log("\nCalling TEE service...");
    const res = await fetch(`${teeUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: reportId.toString(), exploitPayload, targetContract }),
    });
    if (!res.ok) throw new Error(`TEE service error: ${await res.text()}`);
    const { attestation, signature, severityLabel, exploitSuccess } = await res.json() as any;

    console.log(`✓ TEE verified: ${severityLabel} | exploitSuccess=${exploitSuccess}`);
    console.log(`  attestation: ${(attestation as string).slice(0, 20)}...`);

    txHash = await walletClient.writeContract({
      address: CONTRACTS.BOUNTY_REGISTRY,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "attestWithProof",
      args: [reportId, attestation, signature, parseEther(bountyEth)],
      account,
      chain: null,
    });
  } else {
    // ── Fallback: EOA signs hash ────────────────────────────────────────────
    const attestPayload = JSON.stringify({
      reportId: reportId.toString(), severity: SeverityLabel[severity],
      exploitExecuted: true, fundsDrained: "100%",
      timestamp: Math.floor(Date.now() / 1000), teeType: "EOA_FALLBACK",
    });
    const attestationHash = keccak256(stringToHex(attestPayload));
    console.log(`\nAttestation hash: ${attestationHash}`);

    txHash = await walletClient.writeContract({
      address: CONTRACTS.BOUNTY_REGISTRY,
      abi: BOUNTY_REGISTRY_ABI,
      functionName: "attestSeverity",
      args: [reportId, severity, attestationHash, parseEther(bountyEth)],
      account,
      chain: null,
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`\n✅ Attestation on-chain: ${txHash}`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Explorer: https://aeneid.storyscan.io/tx/${txHash}`);
  console.log(`\n💡 Company can now pay ${bountyEth} IP to unlock the exploit.`);
}

main().catch(console.error);
