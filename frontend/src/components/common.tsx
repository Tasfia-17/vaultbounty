import { EXPLORER } from "../lib/constants.js";

export function TxLink({ hash }: { hash: string }) {
  return (
    <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer"
      className="mono muted" style={{ borderBottom: "1px solid #e5e5e5" }}>
      {hash.slice(0, 10)}…{hash.slice(-6)} ↗
    </a>
  );
}

export function AddrLink({ address }: { address: string }) {
  return (
    <a href={`${EXPLORER}/address/${address}`} target="_blank" rel="noreferrer"
      className="mono" style={{ color: "#525252", borderBottom: "1px solid #e5e5e5" }}>
      {address.slice(0, 6)}…{address.slice(-4)}
    </a>
  );
}

export function StateBadge({ state }: { state: string }) {
  return <span className={`badge badge-${state.toLowerCase()}`}>{state}</span>;
}

export function SeverityTag({ label }: { label: string }) {
  return <span className={`severity-${label}`}>{label}</span>;
}

export function GateStatus({ label, open }: { label: string; open: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: "1px solid #f5f5f5",
    }}>
      <span className="mono" style={{ fontSize: 11, color: "#525252" }}>{label}</span>
      <span className={open ? "gate-open" : "gate-closed"}>
        {open ? "✓ OPEN" : "✗ CLOSED"}
      </span>
    </div>
  );
}

export function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 13, height: 13,
      border: "2px solid #e5e5e5", borderTopColor: "#000",
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
      verticalAlign: "middle",
    }} />
  );
}

export function Tag({ children, color = "#f5f5f5" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: color, color: "#000", fontSize: 12, fontWeight: 700,
      border: "1px solid #171717", borderRadius: 100, padding: "3px 12px",
    }}>
      {children}
    </span>
  );
}
