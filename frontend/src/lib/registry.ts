import { encodeAbiParameters } from "viem";
import { publicClient } from "./wallet.js";
import {
  CONTRACTS, BOUNTY_READ_CONDITION_ABI, BOUNTY_REGISTRY_ABI,
  SEVERITY_LABELS, STATE_LABELS,
} from "./constants.js";

export type Report = {
  vaultUuid: number;
  researcher: string;
  targetContract: string;
  company: string;
  ipId: string;
  severity: number;
  severityLabel: string;
  attestationHash: string;
  bountyAmount: bigint;
  escalateAt: bigint;
  state: number;
  stateLabel: string;
};

export async function fetchReport(reportId: bigint): Promise<Report> {
  const r = await publicClient.readContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "getReport",
    args: [reportId],
  });
  return {
    vaultUuid:       r.vaultUuid,
    researcher:      r.researcher,
    targetContract:  r.targetContract,
    company:         r.company,
    ipId:            r.ipId,
    severity:        r.severity,
    severityLabel:   SEVERITY_LABELS[r.severity] ?? "UNKNOWN",
    attestationHash: r.attestationHash,
    bountyAmount:    r.bountyAmount,
    escalateAt:      r.escalateAt,
    state:           r.state,
    stateLabel:      STATE_LABELS[r.state] ?? "UNKNOWN",
  };
}

export async function fetchNextReportId(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.BOUNTY_REGISTRY,
    abi: BOUNTY_REGISTRY_ABI,
    functionName: "nextReportId",
  });
}

export async function checkAllGates(reportId: bigint, caller: `0x${string}`) {
  const [verify, disclose, escalate] = await Promise.all([
    checkGate(reportId, 0, caller).catch(() => false),
    checkGate(reportId, 1, caller).catch(() => false),
    checkGate(reportId, 2, caller).catch(() => false),
  ]);
  return { verify, disclose, escalate };
}

async function checkGate(reportId: bigint, path: 0 | 1 | 2, caller: `0x${string}`): Promise<boolean> {
  const accessAuxData = encodeAbiParameters([{ type: "uint8" }], [path]);
  const conditionData = encodeAbiParameters([{ type: "uint256" }], [reportId]);
  return publicClient.readContract({
    address: CONTRACTS.BOUNTY_READ_CONDITION,
    abi: BOUNTY_READ_CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [0, accessAuxData, conditionData, caller],
  });
}
