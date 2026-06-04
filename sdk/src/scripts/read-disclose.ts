/**
 * Company reads the decrypted exploit after paying the bounty (DISCLOSE path).
 * The CDR gate is only open once the report is in SETTLED state.
 *
 * Run: VAULT_UUID=<n> REPORT_ID=<n> pnpm demo:read-disclose
 */
import "dotenv/config";
import { encodeAbiParameters } from "viem";
import { getCompanyClients, getPublicClientOnly, CONTRACTS } from "../clients.js";
import { BOUNTY_READ_CONDITION_ABI } from "../abis/index.js";
import { PATH_DISCLOSE } from "../vaultbounty.js";

async function main() {
  const uuid     = Number(process.env.VAULT_UUID);
  const reportId = BigInt(process.env.REPORT_ID ?? "1");

  if (!uuid) throw new Error("Set VAULT_UUID env var");

  console.log("=== VaultBounty: Read Vault (DISCLOSE path) ===\n");
  console.log(`vault uuid : ${uuid}`);
  console.log(`reportId   : ${reportId}`);

  const publicClient = getPublicClientOnly();
  const { account, cdrClient } = await getCompanyClients();

  // 1. Verify DISCLOSE gate is open
  const accessAuxData = encodeAbiParameters([{ type: "uint8" }], [PATH_DISCLOSE]);
  const conditionData = encodeAbiParameters([{ type: "uint256" }], [reportId]);

  const allowed = await publicClient.readContract({
    address: CONTRACTS.BOUNTY_READ_CONDITION,
    abi: BOUNTY_READ_CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [uuid, accessAuxData, conditionData, account.address],
  });

  console.log(`\nCDR gate PATH_DISCLOSE: ${allowed ? "✅ OPEN" : "❌ CLOSED"}`);
  if (!allowed) {
    console.log("Gate is closed. Possible reasons:");
    console.log("  - Report not yet settled (company hasn't paid)");
    console.log("  - Caller address is not the registered company");
    return;
  }

  // 2. Read from CDR vault
  console.log("\nReading from CDR vault (company key)…");
  const { dataKey } = await cdrClient.consumer.accessCDR({
    uuid,
    accessAuxData: encodeAbiParameters([{ type: "uint8" }], [PATH_DISCLOSE]),
    timeoutMs: 120_000,
  });

  const payload = JSON.parse(new TextDecoder().decode(dataKey));
  console.log("\n✅ EXPLOIT UNLOCKED — full PoC decrypted:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("\nBounty has been paid. Exploit is now in your possession.");
  console.log("The TEE attestation hash on-chain is the cryptographic receipt.");
}

main().catch(console.error);
