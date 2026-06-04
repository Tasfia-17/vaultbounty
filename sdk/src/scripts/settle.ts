/**
 * Step 3a: Company pays the bounty. Atomically settles the report.
 * After this tx, the CDR read condition opens the DISCLOSE path.
 *
 * Run: REPORT_ID=1 pnpm demo:settle
 */
import "dotenv/config";
import { getCompanyClients, getPublicClientOnly, CONTRACTS } from "../clients.js";
import { BOUNTY_REGISTRY_ABI } from "../abis/index.js";

async function main() {
  const reportId = BigInt(process.env.REPORT_ID ?? "1");

  const { account, walletClient } = await getCompanyClients();
  const publicClient = getPublicClientOnly();
  console.log("=== VaultBounty: Settle Bounty ===\n");
  console.log("Company:", account.address);
  console.log("reportId:", reportId);

  // Read bounty amount from contract
  const report = await publicClient.readContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "getReport",
    args: [reportId],
  });

  const bountyAmount = report.bountyAmount;
  console.log(`Bounty amount: ${bountyAmount} wei`);

  // DEMO MOMENT: Show that DISCLOSE path is closed BEFORE payment
  const closed = await checkDisclosePath(publicClient, reportId, account.address);
  console.log(`\n🔒 DISCLOSE path BEFORE payment: ${closed ? "OPEN ❌" : "CLOSED ✅"}`);

  // Pay
  const hash = await walletClient.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "settle",
    args: [reportId],
    value: bountyAmount,
    account,
    chain: null,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n✅ Payment settled: ${hash}`);
  console.log(`   Block: ${receipt.blockNumber}`);

  // DEMO MOMENT: Show that DISCLOSE path is now OPEN
  const open = await checkDisclosePath(publicClient, reportId, account.address);
  console.log(`\n🔓 DISCLOSE path AFTER payment: ${open ? "OPEN ✅" : "CLOSED ❌"}`);
  console.log("\n💡 Company can now call read-disclose.ts to decrypt the exploit.");
}

async function checkDisclosePath(
  publicClient: any,
  reportId: bigint,
  caller: `0x${string}`,
): Promise<boolean> {
  // Encode path=1 (DISCLOSE) as accessAuxData
  const { encodeAbiParameters } = await import("viem");
  const accessAuxData = encodeAbiParameters([{ type: "uint8" }], [1]);
  const conditionData = encodeAbiParameters([{ type: "uint256" }], [reportId]);

  return publicClient.readContract({
    address: CONTRACTS.BOUNTY_READ_CONDITION,
    abi: [{
      name: "checkReadCondition",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "uuid",          type: "uint32"  },
        { name: "accessAuxData", type: "bytes"   },
        { name: "conditionData", type: "bytes"   },
        { name: "caller",        type: "address" },
      ],
      outputs: [{ name: "", type: "bool" }],
    }],
    functionName: "checkReadCondition",
    args: [0, accessAuxData, conditionData, caller],
  });
}

main().catch(console.error);
