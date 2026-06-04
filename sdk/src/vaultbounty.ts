import {
  encodeAbiParameters,
  toHex,
  createPublicClient,
  http,
  type Address,
  type WalletClient,
  type PublicClient,
} from "viem";
import { uuidToLabel } from "@piplabs/cdr-sdk";
import type { CDRClient } from "@piplabs/cdr-sdk";
import { CONTRACTS, BOUNTY_REGISTRY_ABI, RPC_URL } from "./index.js";

// CDR vault path constants - must match BountyReadCondition.sol
export const PATH_VERIFY   = 0;
export const PATH_DISCLOSE = 1;
export const PATH_ESCALATE = 2;

export type Severity = 0 | 1 | 2 | 3 | 4; // NONE/LOW/MEDIUM/HIGH/CRITICAL
export const SeverityLabel: Record<number, string> = {
  0: "NONE", 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL",
};

// ── Vault helpers ─────────────────────────────────────────────────────────────

/// Allocate a CDR vault with the read condition pre-wired to BountyReadCondition.
/// Strategy: read nextReportId first → expected reportId = nextReportId + 1 →
/// encode it into readConditionData at allocation time (condition addr is immutable).
export async function allocateExploitVault(
  cdrClient: CDRClient,
  publicClient: PublicClient,
  researcherAddress: Address,
  exploitPayload: string,
): Promise<{ uuid: number; encryptedData: `0x${string}`; expectedReportId: bigint }> {
  // Pre-read nextReportId so we know the reportId before allocating
  const nextReportId: bigint = await publicClient.readContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "nextReportId",
  }) as bigint;
  const expectedReportId = nextReportId + 1n;

  const globalPubKey = await cdrClient.observer.getGlobalPubKey();

  // Allocate vault with BountyReadCondition addr + pre-encoded reportId as conditionData.
  // This means the three-path gate is enforced by CDR validators from day one.
  const conditionData = encodeAbiParameters([{ type: "uint256" }], [expectedReportId]);
  const { uuid } = await cdrClient.uploader.allocate({
    updatable: false,
    writeConditionAddr: CONTRACTS.RESEARCHER_WRITE_CONDITION,
    writeConditionData: encodeAbiParameters([{ type: "address" }], [researcherAddress]),
    readConditionAddr: CONTRACTS.BOUNTY_READ_CONDITION,
    readConditionData: conditionData,
    skipConditionValidation: true,
  });

  const ciphertext = await cdrClient.uploader.encryptDataKey({
    dataKey: new TextEncoder().encode(exploitPayload),
    globalPubKey,
    label: uuidToLabel(uuid),
  });
  const encryptedData = toHex(ciphertext.raw);

  await cdrClient.uploader.write({
    uuid,
    accessAuxData: "0x",
    encryptedData,
  });

  console.log(`✓ CDR vault allocated: uuid=${uuid}, expectedReportId=${expectedReportId}`);
  return { uuid, encryptedData, expectedReportId };
}

// ── Story Protocol IP registration ───────────────────────────────────────────

/// Register an exploit report as a Story IP Asset.
/// Returns the ipId to store in BountyRegistry via setIpId.
export async function registerExploitAsIp(
  storyClient: any, // StoryClient from @story-protocol/core-sdk
  nftContract: Address,
  tokenId: bigint,
  targetContract: Address,
  vaultUuid: number,
  reportId: bigint,
): Promise<Address> {
  const result = await storyClient.ipAsset.register({
    nftContract,
    tokenId,
    metadata: {
      metadataURI: `ipfs://vaultbounty/${reportId}`,
      metadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      nftMetadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    },
    txOptions: { waitForTransaction: true },
  });
  const ipId = result.ipId as Address;
  console.log(`✓ IP Asset registered: ipId=${ipId}`);
  return ipId;
}

// ── TEE service client ────────────────────────────────────────────────────────

const TEE_SERVICE_URL = process.env.TEE_SERVICE_URL ?? "http://localhost:3001";

export interface TeeVerifyResult {
  attestation:    `0x${string}`;
  signature:      `0x${string}`;
  severity:       number;
  severityLabel:  string;
  exploitSuccess: boolean;
  fundsDrained:   string;
  operatorAddress: Address;
}

/// Submit an exploit payload to the TEE service for verification.
/// Returns the signed attestation ready to submit on-chain via attestWithProof.
export async function requestTeeVerification(
  reportId: bigint,
  exploitPayload: string,
  targetContract: Address,
): Promise<TeeVerifyResult> {
  const res = await fetch(`${TEE_SERVICE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId: reportId.toString(), exploitPayload, targetContract }),
  });
  if (!res.ok) throw new Error(`TEE service error: ${await res.text()}`);
  return res.json() as Promise<TeeVerifyResult>;
}



export async function submitReport(
  walletClient: WalletClient,
  publicClient: PublicClient,
  vaultUuid: number,
  targetContract: Address,
  company: Address,
): Promise<bigint> {
  const hash = await walletClient.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "submitReport",
    args: [vaultUuid, targetContract, company],
    account: walletClient.account!,
    chain: null,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Report submitted: tx=${hash}`);

  // ReportSubmitted(uint256 indexed reportId, ...) - reportId is topics[1]
  const reportId = receipt.logs[0]?.topics[1]
    ? BigInt(receipt.logs[0].topics[1])
    : (() => { throw new Error("ReportSubmitted event not found in logs"); })();
  console.log(`  reportId=${reportId}`);
  return reportId;
}

export async function attestWithProof(
  walletClient: WalletClient,
  publicClient: PublicClient,
  reportId: bigint,
  attestationBytes: `0x${string}`,
  signature: `0x${string}`,
  bountyAmount: bigint,
): Promise<void> {
  const hash = await walletClient.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "attestWithProof",
    args: [reportId, attestationBytes, signature, bountyAmount],
    account: walletClient.account!,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ TEE attestation posted on-chain | tx=${hash}`);
}

export async function attestSeverity(
  walletClient: WalletClient,
  publicClient: PublicClient,
  reportId: bigint,
  severity: Severity,
  attestationHash: `0x${string}`,
  bountyAmount: bigint,
): Promise<void> {
  const hash = await walletClient.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "attestSeverity",
    args: [reportId, severity, attestationHash, bountyAmount],
    account: walletClient.account!,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Severity attested: ${SeverityLabel[severity]} | tx=${hash}`);
}

export async function settle(
  walletClient: WalletClient,
  publicClient: PublicClient,
  reportId: bigint,
  bountyAmount: bigint,
): Promise<void> {
  const hash = await walletClient.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "settle",
    args: [reportId],
    value: bountyAmount,
    account: walletClient.account!,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Bounty settled: ${bountyAmount} wei | tx=${hash}`);
}

export async function escalate(
  walletClient: WalletClient,
  publicClient: PublicClient,
  reportId: bigint,
): Promise<void> {
  const hash = await walletClient.writeContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "escalate",
    args: [reportId],
    account: walletClient.account!,
    chain: null,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Report escalated to DAO | tx=${hash}`);
}

// ── CDR Read helpers ──────────────────────────────────────────────────────────

export async function readVaultVerify(cdrClient: CDRClient, uuid: number): Promise<string> {
  const { dataKey } = await cdrClient.consumer.accessCDR({
    uuid,
    accessAuxData: encodeAbiParameters([{ type: "uint8" }], [PATH_VERIFY]),
    timeoutMs: 120_000,
  });
  return new TextDecoder().decode(dataKey);
}

export async function readVaultDisclose(cdrClient: CDRClient, uuid: number): Promise<string> {
  const { dataKey } = await cdrClient.consumer.accessCDR({
    uuid,
    accessAuxData: encodeAbiParameters([{ type: "uint8" }], [PATH_DISCLOSE]),
    timeoutMs: 120_000,
  });
  return new TextDecoder().decode(dataKey);
}

export async function readVaultEscalate(cdrClient: CDRClient, uuid: number): Promise<string> {
  const { dataKey } = await cdrClient.consumer.accessCDR({
    uuid,
    accessAuxData: encodeAbiParameters([{ type: "uint8" }], [PATH_ESCALATE]),
    timeoutMs: 120_000,
  });
  return new TextDecoder().decode(dataKey);
}
