/**
 * Read the encrypted exploit from the vault via the VERIFY path.
 * Any caller can trigger this while the report is PENDING or ATTESTED.
 * Simulates what a TEE/whitehat DAO member would do to confirm the exploit exists.
 *
 * Run: VAULT_UUID=<n> pnpm demo:read-verify
 */
import "dotenv/config";
import { encodeAbiParameters } from "viem";
import { getResearcherClients, getPublicClientOnly, CONTRACTS } from "../clients.js";
import { BOUNTY_READ_CONDITION_ABI } from "../abis/index.js";
import { PATH_VERIFY } from "../vaultbounty.js";

async function main() {
  const uuid     = Number(process.env.VAULT_UUID  ?? process.env.VAULT_UUID);
  const reportId = BigInt(process.env.REPORT_ID   ?? "1");

  if (!uuid) throw new Error("Set VAULT_UUID env var");

  console.log("=== VaultBounty: Read Vault (VERIFY path) ===\n");
  console.log(`vault uuid : ${uuid}`);
  console.log(`reportId   : ${reportId}`);

  const publicClient = getPublicClientOnly();

  // 1. Check the read condition is open for VERIFY
  const accessAuxData = encodeAbiParameters([{ type: "uint8" }], [PATH_VERIFY]);
  const conditionData = encodeAbiParameters([{ type: "uint256" }], [reportId]);
  const { account } = await getResearcherClients();

  const allowed = await publicClient.readContract({
    address: CONTRACTS.BOUNTY_READ_CONDITION,
    abi: BOUNTY_READ_CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [uuid, accessAuxData, conditionData, account.address],
  });
  console.log(`\nCDR gate PATH_VERIFY: ${allowed ? "✅ OPEN" : "❌ CLOSED"}`);
  if (!allowed) { console.log("Gate is closed — report may already be settled or escalated."); return; }

  // 2. Read from CDR vault
  const { cdrClient } = await getResearcherClients();
  console.log("\nReading from CDR vault (researcher key)…");
  const { dataKey } = await cdrClient.consumer.accessCDR({
    uuid,
    accessAuxData: encodeAbiParameters([{ type: "uint8" }], [PATH_VERIFY]),
    timeoutMs: 120_000,
  });

  const payload = JSON.parse(new TextDecoder().decode(dataKey));
  console.log("\n✅ Exploit payload decrypted (VERIFY — exploit exists):");
  console.log(`   Vulnerability : ${payload.vulnerability ?? payload.description ?? "(see full payload)"}`);
  console.log(`   Target        : ${payload.targetContract}`);
  console.log(`   Severity      : ${payload.severity}`);
  console.log(`   Submitted     : ${payload.submittedAt}`);
  console.log("\nNOTE: In production, only the TEE reads this. The TEE never exposes the raw payload.");
}

main().catch(console.error);
