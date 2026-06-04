// BountyRegistry ABI — minimal subset needed by the SDK
export const BOUNTY_REGISTRY_ABI = [
  // submitReport
  {
    name: "submitReport",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vaultUuid",       type: "uint32"  },
      { name: "targetContract",  type: "address" },
      { name: "company",         type: "address" },
    ],
    outputs: [{ name: "reportId", type: "uint256" }],
  },
  // setIpId
  {
    name: "setIpId",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reportId", type: "uint256" },
      { name: "ipId",     type: "address" },
    ],
    outputs: [],
  },
  // attestWithProof — full TEE path
  {
    name: "attestWithProof",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reportId",         type: "uint256" },
      { name: "attestationBytes", type: "bytes"   },
      { name: "signature",        type: "bytes"   },
      { name: "bountyAmount",     type: "uint256" },
    ],
    outputs: [],
  },
  // attestSeverity
  {
    name: "attestSeverity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reportId",        type: "uint256"  },
      { name: "severity",        type: "uint8"    },
      { name: "attestationHash", type: "bytes32"  },
      { name: "bountyAmount",    type: "uint256"  },
    ],
    outputs: [],
  },
  // settle
  {
    name: "settle",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "reportId", type: "uint256" }],
    outputs: [],
  },
  // escalate
  {
    name: "escalate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "reportId", type: "uint256" }],
    outputs: [],
  },
  // nextReportId
  {
    name: "nextReportId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // getReport
  {
    name: "getReport",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "reportId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "vaultUuid",       type: "uint32"  },
          { name: "researcher",      type: "address" },
          { name: "targetContract",  type: "address" },
          { name: "company",         type: "address" },
          { name: "ipId",            type: "address" },
          { name: "severity",        type: "uint8"   },
          { name: "attestationHash", type: "bytes32" },
          { name: "bountyAmount",    type: "uint256" },
          { name: "escalateAt",      type: "uint256" },
          { name: "state",           type: "uint8"   },
        ],
      },
    ],
  },
  // getReportByVault
  {
    name: "getReportByVault",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "vaultUuid", type: "uint32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "vaultUuid",       type: "uint32"  },
          { name: "researcher",      type: "address" },
          { name: "targetContract",  type: "address" },
          { name: "company",         type: "address" },
          { name: "ipId",            type: "address" },
          { name: "severity",        type: "uint8"   },
          { name: "attestationHash", type: "bytes32" },
          { name: "bountyAmount",    type: "uint256" },
          { name: "escalateAt",      type: "uint256" },
          { name: "state",           type: "uint8"   },
        ],
      },
    ],
  },
  // Events
  { name: "ReportSubmitted", type: "event", inputs: [
    { name: "reportId",       type: "uint256",  indexed: true },
    { name: "vaultUuid",      type: "uint32",   indexed: false },
    { name: "researcher",     type: "address",  indexed: false },
    { name: "targetContract", type: "address",  indexed: false },
  ]},
  { name: "Attested", type: "event", inputs: [
    { name: "reportId",        type: "uint256", indexed: true  },
    { name: "severity",        type: "uint8",   indexed: false },
    { name: "attestationHash", type: "bytes32", indexed: false },
  ]},
  { name: "Settled", type: "event", inputs: [
    { name: "reportId", type: "uint256", indexed: true  },
    { name: "company",  type: "address", indexed: false },
    { name: "amount",   type: "uint256", indexed: false },
  ]},
  { name: "Escalated", type: "event", inputs: [
    { name: "reportId", type: "uint256", indexed: true },
  ]},
] as const;

export const BOUNTY_READ_CONDITION_ABI = [
  {
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
  },
] as const;
