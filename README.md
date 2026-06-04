# VaultBounty

**Trustless responsible disclosure. Prove a bug exists without showing it.**

Researchers encrypt exploit proofs inside CDR vaults. A TEE verifies severity on-chain. Companies pay *before* they see the code. No trusted middleman, no CFAA exposure, no patch-and-ditch.

Built for the **Story Protocol CDR Hackathon 2026** - targeting both prize tracks.

---

## The Problem

Bug bounty researchers are routinely screwed:

- They disclose a vulnerability → the company patches it silently → no payment
- Current platforms (HackerOne, Immunefi) require full disclosure before payment
- A centralized coordinator sees every exploit before either party
- Legal exposure under CFAA just for finding the bug

VaultBounty replaces the coordinator with a CDR vault + TEE attestation chain, enforced entirely on-chain.

---

## How It Works

```
Researcher encrypts exploit → CDR vault allocated with BountyReadCondition
       ↓
TEE forks target contract, runs exploit inside enclave → signs severity attestation
       ↓
Attestation posted on-chain (ECDSA signature from registered operator)
       ↓
Company reviews: "CRITICAL - 100% funds drained" - without ever seeing the PoC
       ↓
Company pays bounty → ONE transaction flips CDR gate CLOSED → OPEN
       ↓
Exploit decrypted only to company. 80% → researcher, 15% → DAO, 5% → TEE operator
       ↓
No payment in 7 days → escalate → CDR gate opens for Whitehat DAO
```

### Three CDR Paths

| Path | Trigger | Who can read |
|------|---------|--------------|
| `PATH_VERIFY (0)` | Report is PENDING or ATTESTED | TEE operator / DAO members |
| `PATH_DISCLOSE (1)` | Report is SETTLED (company paid) | Company address only |
| `PATH_ESCALATE (2)` | Deadline passed, bounty unpaid | Anyone (DAO receives) |

---

## Architecture

```
contracts/
  BountyRegistry.sol          - core lifecycle: submit → attest → settle → escalate
  BountyReadCondition.sol     - CDR ICDRReadCondition: three-path state machine
  ResearcherWriteCondition.sol - CDR ICDRWriteCondition: only researcher can write
  MockTEEVerifier.sol         - DAO-governed operator registry, ECDSA attestation verify
  VulnerableVault.sol         - demo target: reentrancy bug for live exploit proof

sdk/
  src/vaultbounty.ts          - CDR vault allocation, registry interactions, TEE client
  src/clients.ts              - viem + CDR + Story client factories
  src/abis/                   - contract ABIs
  src/scripts/
    submit-report.ts          - researcher: allocate vault + submit on-chain
    attest-severity.ts        - TEE operator: sign + post attestation (TEE service or EOA)
    settle.ts                 - company: pay bounty, show gate flip
    escalate.ts               - anyone: escalate after deadline
    read-verify.ts            - verify path CDR read
    read-disclose.ts          - disclose path CDR read (post-payment)
    full-demo.ts              - end-to-end demo in one script

tee-service/
  src/index.ts                - Express API: POST /verify signs attestations
  src/sign-attestation.ts     - CLI: sign + post attestation directly on-chain

frontend/
  src/App.tsx                 - landing page + app shell
  src/components/landing.tsx  - hero, how-it-works, CDR paths, prize tracks
  src/components/panels.tsx   - Explorer, Submit Report, Company Portal
  src/lib/                    - viem clients, registry helpers, constants
```

---

---

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh)
- Node.js 20+ and pnpm
- Three funded Aeneid testnet wallets (get IP from [Story faucet](https://faucet.story.foundation))

### 1. Deploy Contracts

```bash
cd contracts
TEE_RELAYER_ADDRESS=0x<operator-addr> \
DAO_ADDRESS=0x<dao-addr> \
DEMO_MODE=true \
forge script script/Deploy.s.sol \
  --rpc-url https://aeneid.storyrpc.io \
  --broadcast \
  --private-key <deployer-private-key>
```

Output: 5 contract addresses. Copy them.

### 2. Configure SDK

```bash
cp sdk/.env.example sdk/.env
# Fill in: RESEARCHER_PRIVATE_KEY, COMPANY_PRIVATE_KEY, TEE_RELAYER_PRIVATE_KEY
# Fill in the 5 contract addresses from deploy output
# Set DAO_ADDRESS, DEMO_MODE=true
```

### 3. Start TEE Service

```bash
cp tee-service/.env.example tee-service/.env
# Fill in: TEE_OPERATOR_PRIVATE_KEY, BOUNTY_REGISTRY_ADDRESS

cd tee-service && pnpm install && pnpm start
```

### 4. Run the Full Demo

```bash
cd sdk && pnpm install && pnpm demo:full
```

This runs the complete lifecycle in one script:
1. Researcher encrypts exploit → CDR vault allocated with `BountyReadCondition`
2. TEE attests severity → CRITICAL posted on-chain
3. Shows CDR gate CLOSED before payment
4. Company pays → **ONE tx flips gate OPEN**
5. Company decrypts exploit from CDR vault

### 5. Run Step-by-Step

```bash
pnpm demo:submit    # allocate vault + submit report
pnpm demo:attest    # TEE service signs + posts attestation
pnpm demo:settle    # company pays, gate flips
pnpm demo:read-disclose  # company decrypts exploit
```

### 6. Frontend

```bash
cd frontend
cp .env.example .env  # fill contract addresses as VITE_*
pnpm install && pnpm dev
```

### 7. Run Contract Tests

```bash
cd contracts && forge test -v
```

All 11 tests pass:
- Full lifecycle via `attestWithProof`
- TEE attestation rejects failed exploits
- Unknown operator rejection
- Nonce replay protection
- Payment split 80/15/5
- Escalation deadline
- Live reentrancy drain of `VulnerableVault`

---



## Environment Variables

### `sdk/.env`

| Variable | Description |
|----------|-------------|
| `RESEARCHER_PRIVATE_KEY` | Researcher wallet (no 0x prefix) |
| `COMPANY_PRIVATE_KEY` | Company wallet |
| `TEE_RELAYER_PRIVATE_KEY` | TEE operator wallet |
| `DAO_ADDRESS` | DAO multisig address |
| `BOUNTY_REGISTRY_ADDRESS` | Deployed BountyRegistry |
| `BOUNTY_READ_CONDITION_ADDRESS` | Deployed BountyReadCondition |
| `RESEARCHER_WRITE_CONDITION_ADDRESS` | Deployed ResearcherWriteCondition |
| `MOCK_TEE_VERIFIER_ADDRESS` | Deployed MockTEEVerifier |
| `VULNERABLE_VAULT_ADDRESS` | Deployed VulnerableVault |
| `TEE_SERVICE_URL` | TEE service URL (default: http://localhost:3001) |
| `USE_TEE_SERVICE` | `true` = full proof path, `false` = EOA fallback |
| `DEMO_MODE` | `true` = 2min escalation window |

---

## CDR Integration Details

### Vault Allocation

```typescript
// Pre-read nextReportId so conditionData is correct from day one
const nextReportId = await publicClient.readContract({ functionName: "nextReportId" });
const expectedReportId = nextReportId + 1n;

await cdrClient.uploader.allocate({
  writeConditionAddr: RESEARCHER_WRITE_CONDITION,
  writeConditionData: abi.encode(researcherAddress),
  readConditionAddr:  BOUNTY_READ_CONDITION,
  readConditionData:  abi.encode(expectedReportId),  // wired at allocation
});
```

### Read Condition Logic

```solidity
function checkReadCondition(uint32, bytes calldata accessAuxData, bytes calldata conditionData, address caller)
  external view returns (bool)
{
  uint256 reportId = abi.decode(conditionData, (uint256));
  uint8 path = abi.decode(accessAuxData, (uint8));
  Report memory r = registry.getReport(reportId);

  if (path == PATH_VERIFY)   return r.state != SETTLED && r.state != ESCALATED;
  if (path == PATH_DISCLOSE) return caller == r.company && r.state == SETTLED;
  if (path == PATH_ESCALATE) return r.state == ESCALATED;
}
```

### TEE Attestation Flow

```
TEE service receives: { reportId, exploitPayload, targetContract }
  → forks target contract state in Anvil/EVM
  → executes exploit bytecode
  → signs: abi.encode(Attestation { reportId, severity, exploitSuccess, nonce, ... })
  → returns { attestation: hex, signature: hex }

On-chain: BountyRegistry.attestWithProof(reportId, attestationBytes, signature, bountyAmount)
  → MockTEEVerifier.verifyView() checks operator signature
  → nonce consumed (replay protection)
  → state = ATTESTED, severity set
```

---

## Story Protocol Integration

- Each exploit report is an ERC-721 → Story IP Asset via `IPAssetRegistry.register`
- IP Account (ERC-6551 TBA) holds royalty revenue
- `registerExploitAsIp()` in SDK registers and returns `ipId` stored in `BountyRegistry`
- `setIpId(reportId, ipId)` links the IP Asset to the on-chain report
- Royalty split enforced at settlement: 80% researcher / 15% DAO / 5% TEE operator

---

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Validator collusion | CDR threshold encryption - no single validator holds full key |
| Replay attack | `usedNonces` mapping in `MockTEEVerifier`, nonce in every attestation |
| Exploit leakage | Raw PoC never leaves TEE enclave; only signed result returned |
| Company sees exploit before paying | CDR gate physically closed until `State.SETTLED` |
| Malicious TEE operator | DAO-governed `approvedOperators` mapping; slash via `removeOperator` |
| Patch-and-ditch | 7-day escalation: if unpaid, exploit released to Whitehat DAO |

---

## Production Upgrade Path

| Hackathon | Production |
|-----------|-----------|
| `MockTEEVerifier` (ECDSA) | Intel TDX DCAP on-chain quote verifier |
| EOA operator | TDX Trust Domain with MRTD + RTMR pinning |
| In-memory EVM fork | Dedicated Anvil fork inside TDX guest |
| EOA DAO | Multi-sig or governance contract |
| Direct ETH transfer | Story Royalty Module with custom External Royalty Policy |

---

## Team

Built for the CDR Hackathon 2026 on Story Protocol Aeneid Testnet.

**Resources used:**
- [CDR SDK Docs](https://docs.story.foundation/developers/cdr-sdk/overview)
- [Story Protocol Core SDK](https://docs.story.foundation)
- [Live CDR Demo](https://usecdr.dev)
- [Story Aeneid Explorer](https://aeneid.storyscan.io)
