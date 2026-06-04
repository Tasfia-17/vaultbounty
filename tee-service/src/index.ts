/**
 * TEE Simulation Service — VaultBounty
 *
 * In production: runs inside Intel TDX. The MRTD/RTMR measurements pin this binary.
 * For hackathon: runs as a Node.js service. The operator signs attestations with a
 * private key registered in MockTEEVerifier on-chain.
 *
 * POST /verify  { reportId, vaultUuid, exploitPayload, targetContract }
 *   → { attestation: hex, signature: hex, severity, exploitSuccess, fundsDrained }
 */
import "dotenv/config";
import express from "express";
import { privateKeyToAccount } from "viem/accounts";
import { encodeAbiParameters, keccak256, toHex, fromHex, type Hex } from "viem";

const PORT = Number(process.env.PORT ?? 3001);
const PK   = process.env.TEE_OPERATOR_PRIVATE_KEY;
if (!PK) throw new Error("Missing TEE_OPERATOR_PRIVATE_KEY");

const operator = privateKeyToAccount(`0x${PK.replace(/^0x/, "")}`);
console.log(`TEE operator address: ${operator.address}`);

const app = express();
app.use(express.json());

// ── Types ─────────────────────────────────────────────────────────────────────

interface Attestation {
  reportId:       bigint;
  targetContract: Hex;
  severity:       number; // 0=NONE 1=LOW 2=MEDIUM 3=HIGH 4=CRITICAL
  exploitSuccess: boolean;
  fundsDrained:   bigint;
  nonce:          Hex;
  timestamp:      bigint;
}

// ── Core: simulate EVM fork + exploit execution ────────────────────────────────
// Production: spin up Anvil fork, deploy exploit, capture result.
// Hackathon: parse exploit payload, run deterministic simulation, return result.

function simulateExploit(
  exploitPayload: string,
  targetContract: string,
): { success: boolean; fundsDrained: bigint; severity: number } {
  try {
    const payload = JSON.parse(exploitPayload);

    // Determine severity from payload metadata
    const sevMap: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const severity = sevMap[payload.severity?.toUpperCase() ?? ""] ?? 2;

    // For the demo: if pocCode is present and targets a known vulnerable function,
    // mark as exploitSuccess=true. Production replaces this with real EVM fork.
    const hasPoC = Boolean(payload.pocCode ?? payload.pocSummary);
    const fundsDrained = hasPoC ? BigInt(1e18) : 0n; // 1 ETH simulated drain

    console.log(`[TEE] Simulated exploit: success=${hasPoC} severity=${severity} target=${targetContract}`);
    return { success: hasPoC, fundsDrained, severity };
  } catch {
    return { success: false, fundsDrained: 0n, severity: 0 };
  }
}

// ── Build + sign attestation ──────────────────────────────────────────────────

async function buildAttestation(
  reportId: bigint,
  targetContract: Hex,
  severity: number,
  exploitSuccess: boolean,
  fundsDrained: bigint,
): Promise<{ attestationHex: Hex; signatureHex: Hex; att: Attestation }> {
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

  const att: Attestation = {
    reportId,
    targetContract,
    severity,
    exploitSuccess,
    fundsDrained,
    nonce: nonce as Hex,
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
  };

  // ABI-encode matching the Solidity Attestation struct layout
  const attestationHex = encodeAbiParameters(
    [{
      type: "tuple",
      components: [
        { name: "reportId",       type: "uint256"  },
        { name: "targetContract", type: "address"  },
        { name: "severity",       type: "uint8"    },
        { name: "exploitSuccess", type: "bool"     },
        { name: "fundsDrained",   type: "uint256"  },
        { name: "nonce",          type: "bytes32"  },
        { name: "timestamp",      type: "uint256"  },
      ],
    }],
    [att as any],
  );

  const hash = keccak256(attestationHex);
  const signatureHex = await operator.signMessage({ message: { raw: fromHex(hash, "bytes") } });

  return { attestationHex, signatureHex, att };
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.post("/verify", async (req, res) => {
  try {
    const { reportId, exploitPayload, targetContract } = req.body as {
      reportId:       string | number;
      exploitPayload: string;
      targetContract: string;
    };

    if (!reportId || !exploitPayload || !targetContract) {
      res.status(400).json({ error: "Missing required fields: reportId, exploitPayload, targetContract" });
      return;
    }

    const { success, fundsDrained, severity } = simulateExploit(exploitPayload, targetContract);

    const { attestationHex, signatureHex, att } = await buildAttestation(
      BigInt(reportId),
      targetContract as Hex,
      severity,
      success,
      fundsDrained,
    );

    console.log(`[TEE] Attestation built for reportId=${reportId} severity=${severity} success=${success}`);

    res.json({
      attestation:    attestationHex,
      signature:      signatureHex,
      severity,
      severityLabel:  ["NONE","LOW","MEDIUM","HIGH","CRITICAL"][severity] ?? "UNKNOWN",
      exploitSuccess: success,
      fundsDrained:   fundsDrained.toString(),
      operatorAddress: operator.address,
      // In production: this field would contain the Intel TDX quote bytes
      teeQuote: "MOCK_TDX_QUOTE_" + att.nonce,
    });
  } catch (err: any) {
    console.error("[TEE] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", operator: operator.address });
});

app.listen(PORT, () => {
  console.log(`VaultBounty TEE service running on :${PORT}`);
  console.log(`POST /verify  — submit exploit payload for TEE verification`);
  console.log(`GET  /health  — liveness check`);
});
