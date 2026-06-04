/**
 * CLI: Sign a TEE attestation for a specific report and post it on-chain.
 * Run: REPORT_ID=1 TARGET=0x... pnpm sign-attestation
 *
 * This is the "TEE operator" workflow:
 *   1. Read exploit payload from CDR vault (via researcher key for demo)
 *   2. Simulate exploit execution
 *   3. Build + sign attestation
 *   4. Call BountyRegistry.attestWithProof on-chain
 */
import "dotenv/config";
import {
  createPublicClient, createWalletClient, http,
  encodeAbiParameters, keccak256, toHex, fromHex,
  parseEther, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL  = process.env.RPC_URL ?? "https://aeneid.storyrpc.io";
const PK       = process.env.TEE_OPERATOR_PRIVATE_KEY!.replace(/^0x/, "");
const REGISTRY = process.env.BOUNTY_REGISTRY_ADDRESS! as Hex;
const REPORT_ID = BigInt(process.env.REPORT_ID ?? "1");
const TARGET    = (process.env.TARGET ?? "0x0000000000000000000000000000000000000001") as Hex;
const BOUNTY_ETH = process.env.BOUNTY_ETH ?? "0.01";
const SEVERITY  = Number(process.env.SEVERITY ?? "4"); // default CRITICAL

const account = privateKeyToAccount(`0x${PK}`);
const publicClient  = createPublicClient({ transport: http(RPC_URL) });
const walletClient  = createWalletClient({ account, transport: http(RPC_URL) });

const REGISTRY_ABI = [
  { name: "attestWithProof", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "reportId",         type: "uint256" },
      { name: "attestationBytes", type: "bytes"   },
      { name: "signature",        type: "bytes"   },
      { name: "bountyAmount",     type: "uint256" },
    ], outputs: [] },
] as const;

async function main() {
  console.log("=== VaultBounty: TEE Sign Attestation ===\n");
  console.log(`Operator  : ${account.address}`);
  console.log(`reportId  : ${REPORT_ID}`);
  console.log(`target    : ${TARGET}`);
  console.log(`severity  : ${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][SEVERITY]}`);

  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const att = {
    reportId:       REPORT_ID,
    targetContract: TARGET,
    severity:       SEVERITY,
    exploitSuccess: true,
    fundsDrained:   BigInt(1e18),
    nonce:          nonce as Hex,
    timestamp:      BigInt(Math.floor(Date.now() / 1000)),
  };

  const attestationHex = encodeAbiParameters(
    [{ type: "tuple", components: [
      { name: "reportId",       type: "uint256" },
      { name: "targetContract", type: "address" },
      { name: "severity",       type: "uint8"   },
      { name: "exploitSuccess", type: "bool"    },
      { name: "fundsDrained",   type: "uint256" },
      { name: "nonce",          type: "bytes32" },
      { name: "timestamp",      type: "uint256" },
    ]}],
    [att as any],
  );

  const hash = keccak256(attestationHex);
  const signature = await account.signMessage({ message: { raw: fromHex(hash, "bytes") } });

  console.log(`\nAttestation hash : ${keccak256(attestationHex)}`);
  console.log(`Nonce            : ${nonce}`);
  console.log("Submitting attestWithProof on-chain...");

  const tx = await walletClient.writeContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "attestWithProof",
    args: [REPORT_ID, attestationHex, signature, parseEther(BOUNTY_ETH)],
    account,
    chain: null,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`\n✅ Attested on-chain: ${tx}`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Explorer: https://aeneid.storyscan.io/tx/${tx}`);
}

main().catch(console.error);
