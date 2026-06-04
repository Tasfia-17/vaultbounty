export const CHAIN_ID = 1315;
export const RPC_URL  = "https://aeneid.storyrpc.io";
export const EXPLORER = "https://aeneid.storyscan.io";

export const CONTRACTS = {
  BOUNTY_REGISTRY:            (import.meta.env.VITE_BOUNTY_REGISTRY      ?? "") as `0x${string}`,
  BOUNTY_READ_CONDITION:      (import.meta.env.VITE_BOUNTY_READ_CONDITION ?? "") as `0x${string}`,
  RESEARCHER_WRITE_CONDITION: (import.meta.env.VITE_RESEARCHER_WRITE_COND ?? "") as `0x${string}`,
  MOCK_TEE_VERIFIER:          (import.meta.env.VITE_MOCK_TEE_VERIFIER     ?? "") as `0x${string}`,
  VULNERABLE_VAULT:           (import.meta.env.VITE_VULNERABLE_VAULT      ?? "") as `0x${string}`,
  // Story Protocol Aeneid (fixed)
  IP_ASSET_REGISTRY: "0x77319B4031e6eF1250907aa00018B8B1c67a244b" as `0x${string}`,
  LICENSING_MODULE:  "0x04fbd8a2e56dd85CFD5500A4A4DfA955B9f1dE6f" as `0x${string}`,
  LICENSE_TOKEN:     "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`,
  ROYALTY_MODULE:    "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086" as `0x${string}`,
  WIP_TOKEN:         "0x1514000000000000000000000000000000000000" as `0x${string}`,
};

export const PATH_VERIFY   = 0;
export const PATH_DISCLOSE = 1;
export const PATH_ESCALATE = 2;

export const SEVERITY_LABELS: Record<number, string> = {
  0: "NONE", 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL",
};

export const STATE_LABELS: Record<number, string> = {
  0: "PENDING", 1: "ATTESTED", 2: "SETTLED", 3: "ESCALATED",
};

export const BOUNTY_REGISTRY_ABI = [
  { name: "submitReport", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "vaultUuid", type: "uint32" }, { name: "targetContract", type: "address" }, { name: "company", type: "address" }],
    outputs: [{ name: "reportId", type: "uint256" }] },
  { name: "attestSeverity", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "reportId", type: "uint256" }, { name: "severity", type: "uint8" }, { name: "attestationHash", type: "bytes32" }, { name: "bountyAmount", type: "uint256" }],
    outputs: [] },
  { name: "attestWithProof", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "reportId", type: "uint256" }, { name: "attestationBytes", type: "bytes" }, { name: "signature", type: "bytes" }, { name: "bountyAmount", type: "uint256" }],
    outputs: [] },
  { name: "settle", type: "function", stateMutability: "payable",
    inputs: [{ name: "reportId", type: "uint256" }], outputs: [] },
  { name: "escalate", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "reportId", type: "uint256" }], outputs: [] },
  { name: "setIpId", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "reportId", type: "uint256" }, { name: "ipId", type: "address" }], outputs: [] },
  { name: "getReport", type: "function", stateMutability: "view",
    inputs: [{ name: "reportId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "vaultUuid", type: "uint32" }, { name: "researcher", type: "address" },
      { name: "targetContract", type: "address" }, { name: "company", type: "address" },
      { name: "ipId", type: "address" }, { name: "severity", type: "uint8" },
      { name: "attestationHash", type: "bytes32" }, { name: "bountyAmount", type: "uint256" },
      { name: "escalateAt", type: "uint256" }, { name: "state", type: "uint8" },
    ]}] },
  { name: "nextReportId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "ReportSubmitted", type: "event", inputs: [
    { name: "reportId", type: "uint256", indexed: true }, { name: "vaultUuid", type: "uint32", indexed: false },
    { name: "researcher", type: "address", indexed: false }, { name: "targetContract", type: "address", indexed: false }] },
  { name: "Attested", type: "event", inputs: [
    { name: "reportId", type: "uint256", indexed: true }, { name: "severity", type: "uint8", indexed: false },
    { name: "attestationHash", type: "bytes32", indexed: false }] },
  { name: "Settled", type: "event", inputs: [
    { name: "reportId", type: "uint256", indexed: true }, { name: "company", type: "address", indexed: false },
    { name: "amount", type: "uint256", indexed: false }] },
  { name: "Escalated", type: "event", inputs: [{ name: "reportId", type: "uint256", indexed: true }] },
] as const;

export const BOUNTY_READ_CONDITION_ABI = [
  { name: "checkReadCondition", type: "function", stateMutability: "view",
    inputs: [{ name: "uuid", type: "uint32" }, { name: "accessAuxData", type: "bytes" },
             { name: "conditionData", type: "bytes" }, { name: "caller", type: "address" }],
    outputs: [{ name: "", type: "bool" }] },
] as const;
