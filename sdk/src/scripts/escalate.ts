/**
 * Step 3b: Escalate to DAO after deadline (if company didn't pay).
 * Run: REPORT_ID=1 pnpm demo:escalate
 *
 * In demoMode=true, the deadline is 2 minutes after submitReport.
 */
import "dotenv/config";
import { getPublicClientOnly, CONTRACTS } from "../clients.js";
import { BOUNTY_REGISTRY_ABI } from "../abis/index.js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const reportId = BigInt(process.env.REPORT_ID ?? "1");
  const publicClient = getPublicClientOnly();

  console.log("=== VaultBounty: Escalate to DAO ===\n");
  console.log("reportId:", reportId);

  // Check current report state
  const report = await publicClient.readContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "getReport",
    args: [reportId],
  });

  const now = Math.floor(Date.now() / 1000);
  const escalateAt = Number(report.escalateAt);
  console.log(`Escalate deadline: ${new Date(escalateAt * 1000).toISOString()}`);
  console.log(`Current time:      ${new Date(now * 1000).toISOString()}`);

  if (now < escalateAt) {
    const wait = escalateAt - now;
    console.log(`⏳ ${wait}s until deadline. Waiting...`);
    await new Promise((r) => setTimeout(r, wait * 1000 + 2000)); // +2s buffer
  }

  const pk = process.env.RESEARCHER_PRIVATE_KEY!;
  const account = privateKeyToAccount(`0x${pk.replace(/^0x/, "")}`);
  const walletClient = createWalletClient({ account, transport: http(process.env.RPC_URL!) });

  const hash = await walletClient.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "escalate",
    args: [reportId],
    account,
    chain: null,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n✅ Escalated to DAO: ${hash}`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log("\n💡 DAO can now read the exploit via read-disclose.ts with PATH_ESCALATE.");
}

main().catch(console.error);
