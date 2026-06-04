import { useState, useEffect, useCallback } from "react";
import { formatEther } from "viem";
import { getWalletClient, publicClient } from "../lib/wallet.js";
import { fetchReport, fetchNextReportId, checkAllGates, type Report } from "../lib/registry.js";
import { CONTRACTS, BOUNTY_REGISTRY_ABI, EXPLORER } from "../lib/constants.js";
import { TxLink, AddrLink, StateBadge, SeverityTag, GateStatus, Spinner } from "./common.js";

// ── ReportCard ────────────────────────────────────────────────────────

function ReportCard({ report: initialReport, reportId, walletAddr }: { report: Report; reportId: bigint; walletAddr: string }) {
  const [report, setReport] = useState(initialReport);
  const [gates, setGates] = useState<{ verify: boolean; disclose: boolean; escalate: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastTx, setLastTx] = useState("");

  const refreshGates = useCallback(async () => {
    if (!walletAddr || !CONTRACTS.BOUNTY_READ_CONDITION) return;
    checkAllGates(reportId, walletAddr as `0x${string}`).then(setGates).catch(() => {});
  }, [reportId, walletAddr]);

  useEffect(() => { refreshGates(); }, [refreshGates, report.state]);

  async function txAction(fn: string, value?: bigint) {
    setBusy(true);
    try {
      const wc = getWalletClient();
      const [account] = await wc.requestAddresses();
      const hash = await wc.writeContract({
        address: CONTRACTS.BOUNTY_REGISTRY,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: fn as any,
        args: [reportId],
        value,
        account,
        chain: null as any,
      });
      setLastTx(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      // Refresh report state and gates after tx
      const updated = await fetchReport(reportId);
      setReport(updated);
      await refreshGates();
    } catch (e: any) { alert(e.shortMessage ?? e.message); }
    finally { setBusy(false); }
  }

  const deadline = new Date(Number(report.escalateAt) * 1000);
  const past = Date.now() > deadline.getTime();
  const isCompany = walletAddr.toLowerCase() === report.company.toLowerCase();

  return (
    <div className="card" style={{ marginBottom: 12, boxShadow: "rgb(10,10,13) 2px 2px 0px 0px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Report #{reportId.toString()}</span>
          <StateBadge state={report.stateLabel} />
          {report.severity > 0 && <SeverityTag label={report.severityLabel} />}
        </div>
        <span className="mono muted" style={{ fontSize: 11 }}>vault {report.vaultUuid}</span>
      </div>

      {/* Fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", marginBottom: 12 }}>
        <div style={{ fontSize: 13 }}>Researcher <AddrLink address={report.researcher} /></div>
        <div style={{ fontSize: 13 }}>Company <AddrLink address={report.company} /></div>
        <div style={{ fontSize: 13 }}>Target <AddrLink address={report.targetContract} /></div>
        {report.severity > 0 && (
          <div style={{ fontSize: 13 }}>Bounty <span className="mono" style={{ fontWeight: 700 }}>{formatEther(report.bountyAmount)} IP</span></div>
        )}
      </div>

      {/* TEE attestation */}
      {report.attestationHash && report.attestationHash !== "0x" + "0".repeat(64) && (
        <div style={{ background: "var(--card-mint)", border: "1px solid #065f46", borderRadius: 6, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", marginBottom: 4 }}>✓ TEE ATTESTATION ON-CHAIN</div>
          <div className="mono" style={{ fontSize: 11, wordBreak: "break-all", color: "#374151" }}>{report.attestationHash}</div>
        </div>
      )}

      {/* CDR gates */}
      {gates && (
        <div style={{ background: "var(--pale-ash)", borderRadius: 6, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#525252", marginBottom: 6 }}>CDR gate status</div>
          <GateStatus label="PATH_VERIFY (0)" open={gates.verify} />
          <GateStatus label="PATH_DISCLOSE (1)" open={gates.disclose} />
          <GateStatus label="PATH_ESCALATE (2)" open={gates.escalate} />
        </div>
      )}

      <div style={{ fontSize: 12, color: past ? "#dc2626" : "#737373", marginBottom: 12 }}>
        Escalation deadline: {deadline.toLocaleString()} {past && "• PASSED"}
      </div>

      {lastTx && <div style={{ fontSize: 12, marginBottom: 12 }}>TX: <TxLink hash={lastTx} /></div>}

      <div style={{ display: "flex", gap: 8 }}>
        {report.stateLabel === "ATTESTED" && isCompany && (
          <button className="btn-primary" onClick={() => txAction("settle", report.bountyAmount)} disabled={busy}>
            {busy ? <Spinner /> : `Pay ${formatEther(report.bountyAmount)} IP & unlock exploit`}
          </button>
        )}
        {(report.stateLabel === "PENDING" || report.stateLabel === "ATTESTED") && past && (
          <button className="btn-ghost" style={{ borderColor: "#dc2626", color: "#dc2626" }}
            onClick={() => txAction("escalate")} disabled={busy}>
            {busy ? <Spinner /> : "Escalate to DAO"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Explorer ──────────────────────────────────────────────────────────

export function Explorer({ walletAddr }: { walletAddr: string }) {
  const [reports, setReports] = useState<{ id: bigint; report: Report }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!CONTRACTS.BOUNTY_REGISTRY) return;
    setLoading(true);
    try {
      const next = await fetchNextReportId();
      const ids = Array.from({ length: Number(next) }, (_, i) => BigInt(i + 1));
      const fetched = await Promise.all(ids.map(async (id) => ({ id, report: await fetchReport(id) })));
      setReports(fetched.reverse());
    } catch (e: any) { alert("Error: " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.24px" }}>All Reports</h2>
          <p style={{ fontSize: 14, color: "#525252", marginTop: 4 }}>Live from Story Aeneid testnet</p>
        </div>
        <button className="btn-ghost" onClick={load} disabled={loading}>
          {loading ? <Spinner /> : "↺ Refresh"}
        </button>
      </div>

      {!CONTRACTS.BOUNTY_REGISTRY && (
        <div className="card" style={{ background: "var(--card-saffron)", borderColor: "#92400e", textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Contracts not deployed yet</div>
          <div style={{ fontSize: 14, color: "#525252" }}>Set VITE_BOUNTY_REGISTRY in .env and rebuild.</div>
        </div>
      )}
      {loading && reports.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "#525252" }}>
          <Spinner /> <span style={{ marginLeft: 10 }}>Loading reports…</span>
        </div>
      )}
      {!loading && CONTRACTS.BOUNTY_REGISTRY && reports.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "#525252", background: "var(--pale-ash)" }}>
          No reports yet — submit the first one.
        </div>
      )}
      {reports.map(({ id, report }) => (
        <ReportCard key={id.toString()} reportId={id} report={report} walletAddr={walletAddr} />
      ))}
    </div>
  );
}

// ── SubmitReport ──────────────────────────────────────────────────────

export function SubmitReport({ walletAddr }: { walletAddr: string }) {
  const [form, setForm] = useState({ targetContract: "", company: "", vaultUuid: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ reportId: string; tx: string } | null>(null);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddr) { alert("Connect wallet first."); return; }
    setBusy(true);
    try {
      const wc = getWalletClient();
      const [account] = await wc.requestAddresses();
      const hash = await wc.writeContract({
        address: CONTRACTS.BOUNTY_REGISTRY,
        abi: BOUNTY_REGISTRY_ABI,
        functionName: "submitReport",
        args: [Number(form.vaultUuid), form.targetContract as `0x${string}`, form.company as `0x${string}`],
        account, chain: null as any,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const reportId = receipt.logs[0]?.topics[1] ? BigInt(receipt.logs[0].topics[1]).toString() : "?";
      setResult({ reportId, tx: hash });
    } catch (e: any) { alert(e.shortMessage ?? e.message); }
    finally { setBusy(false); }
  }

  if (result) return (
    <div className="card" style={{ maxWidth: 520, boxShadow: "rgb(10,10,13) 4px 4px 0px 0px" }}>
      <div style={{ background: "var(--card-mint)", border: "1px solid #065f46", borderRadius: 6, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#065f46", marginBottom: 8 }}>✓ Report submitted on-chain</div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Report ID: <span className="mono" style={{ fontWeight: 700 }}>#{result.reportId}</span></div>
        <div style={{ fontSize: 13 }}>TX: <TxLink hash={result.tx} /></div>
      </div>
      <div style={{ background: "var(--card-saffron)", borderRadius: 6, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "#92400e" }}>
        <strong>Next:</strong> Run <span className="mono">pnpm demo:attest</span> with your TEE operator key to post the severity attestation, then share the Report ID with the company.
      </div>
      <button className="btn-ghost" onClick={() => setResult(null)}>Submit another report</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.24px" }}>Submit Exploit Report</h2>
        <p style={{ fontSize: 14, color: "#525252", marginTop: 6 }}>
          Allocate a CDR vault first using <span className="mono">pnpm demo:submit</span>, then link the vault UUID here.
        </p>
      </div>
      <form className="card" style={{ boxShadow: "rgb(10,10,13) 2px 2px 0px 0px" }} onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label>CDR Vault UUID</label>
            <input type="number" placeholder="42" value={form.vaultUuid} onChange={e => set("vaultUuid", e.target.value)} required />
          </div>
          <div>
            <label>Target Contract Address</label>
            <input type="text" placeholder="0x..." value={form.targetContract} onChange={e => set("targetContract", e.target.value)} required />
          </div>
          <div>
            <label>Company Address (who pays)</label>
            <input type="text" placeholder="0x..." value={form.company} onChange={e => set("company", e.target.value)} required />
          </div>
          <div>
            <label>Vulnerability Summary <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(off-chain only)</span></label>
            <textarea placeholder="Reentrancy in withdraw()…" value={form.description} onChange={e => set("description", e.target.value)} style={{ minHeight: 80 }} />
          </div>
          <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy || !walletAddr}>
            {busy ? <><Spinner /> Submitting…</> : "Submit Report on-chain"}
          </button>
          {!walletAddr && <p style={{ fontSize: 12, color: "#737373", textAlign: "center" }}>Connect wallet to submit.</p>}
        </div>
      </form>
    </div>
  );
}

// ── CompanyPortal ─────────────────────────────────────────────────────

export function CompanyPortal({ walletAddr }: { walletAddr: string }) {
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [gates, setGates] = useState<{ verify: boolean; disclose: boolean; escalate: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetchReport(BigInt(reportId));
      setReport(r);
      if (walletAddr && CONTRACTS.BOUNTY_READ_CONDITION) {
        const g = await checkAllGates(BigInt(reportId), walletAddr as `0x${string}`);
        setGates(g);
      }
    } catch (e: any) { alert("Not found: " + e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.24px" }}>Company Portal</h2>
        <p style={{ fontSize: 14, color: "#525252", marginTop: 6 }}>
          View TEE attestation. Pay bounty. Unlock exploit. All in one transaction.
        </p>
      </div>

      <form className="card" style={{ marginBottom: 16, boxShadow: "rgb(10,10,13) 2px 2px 0px 0px" }} onSubmit={lookup}>
        <label>Report ID</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" placeholder="1" value={reportId} onChange={e => setReportId(e.target.value)} required />
          <button type="submit" className="btn-primary" disabled={loading} style={{ whiteSpace: "nowrap" }}>
            {loading ? <Spinner /> : "Look up"}
          </button>
        </div>
      </form>

      {report && (
        <div className="card" style={{ boxShadow: "rgb(10,10,13) 4px 4px 0px 0px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <StateBadge state={report.stateLabel} />
            {report.severity > 0 && <SeverityTag label={report.severityLabel} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#525252" }}>Target contract</span>
              <AddrLink address={report.targetContract} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "#525252" }}>Researcher</span>
              <AddrLink address={report.researcher} />
            </div>
            {report.severity > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "#525252" }}>Bounty required</span>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)" }}>{formatEther(report.bountyAmount)} IP</span>
              </div>
            )}
          </div>

          {/* TEE attestation box */}
          {report.attestationHash && report.attestationHash !== "0x" + "0".repeat(64) && (
            <div style={{ background: "var(--card-mint)", border: "1px solid #065f46", borderRadius: 8, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                ✓ TEE Attestation — Exploit verified on-chain
              </div>
              <div className="mono" style={{ fontSize: 11, wordBreak: "break-all", color: "#374151", marginBottom: 8 }}>
                {report.attestationHash}
              </div>
              <div style={{ fontSize: 13 }}>
                Severity confirmed: <strong><SeverityTag label={report.severityLabel} /></strong> · Exploit ran inside TEE enclave. PoC never exposed.
              </div>
              <a href={`${EXPLORER}/tx/${report.attestationHash}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: "#065f46", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                Verify on-chain ↗
              </a>
            </div>
          )}

          {/* CDR gates */}
          {gates && (
            <div style={{ background: "var(--pale-ash)", borderRadius: 6, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#525252", marginBottom: 8 }}>
                CDR gate status (as {walletAddr.slice(0,6)}…)
              </div>
              <GateStatus label="PATH_VERIFY (0)" open={gates.verify} />
              <GateStatus label="PATH_DISCLOSE (1)" open={gates.disclose} />
              <GateStatus label="PATH_ESCALATE (2)" open={gates.escalate} />
            </div>
          )}

          {report.stateLabel === "ATTESTED" && (
            <div style={{ background: "var(--card-saffron)", borderRadius: 6, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
              <strong>Action required:</strong> Pay the bounty to unlock the exploit. Your wallet address must match the registered company address.
            </div>
          )}

          {report.stateLabel === "SETTLED" && (
            <div style={{ background: "var(--card-mint)", borderRadius: 6, padding: "12px 14px", fontSize: 13, color: "#065f46" }}>
              ✓ Bounty paid. Run <span className="mono">pnpm demo:read-disclose</span> to decrypt the exploit.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
