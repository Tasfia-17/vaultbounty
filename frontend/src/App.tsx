import { useState } from "react";
import { connectWallet } from "./lib/wallet.js";
import { Spinner } from "./components/common.js";
import { CONTRACTS } from "./lib/constants.js";
import { Nav, Hero, HowItWorks, ThreePaths, Tracks, CTABanner, Footer } from "./components/landing.js";
import { Explorer, SubmitReport, CompanyPortal } from "./components/panels.js";

type Tab = "explorer" | "submit" | "company";

// ── App shell (shown after "Launch App") ─────────────────────────────

function AppShell({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("explorer");
  const [walletAddr, setWalletAddr] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function connect() {
    setConnecting(true);
    try { setWalletAddr(await connectWallet()); }
    catch (e: any) { alert(e.message); }
    finally { setConnecting(false); }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "explorer", label: "Explorer" },
    { id: "submit",   label: "Submit Report" },
    { id: "company",  label: "Company Portal" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas-white)" }}>
      {/* Top bar */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #e5e5e5",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", height: 56,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={onBack} style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 14, fontWeight: 700, color: "#525252", fontFamily: "var(--font)",
            }}>← Back</button>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.2px" }}>
              Vault<span style={{ background: "#a3e635", padding: "0 4px", borderRadius: 3 }}>Bounty</span>
            </span>
            <span style={{ fontSize: 11, color: "#737373", fontFamily: "var(--font-mono)" }}>Aeneid Testnet</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {walletAddr && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#525252" }}>
                {walletAddr.slice(0, 6)}…{walletAddr.slice(-4)}
              </span>
            )}
            <button
              className={walletAddr ? "btn-ghost" : "btn-primary"}
              style={walletAddr ? { background: "var(--card-mint)", borderColor: "#065f46" } : {}}
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? <Spinner /> : walletAddr ? "✓ Connected" : "Connect Wallet"}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ borderTop: "1px solid #f0f0f0", maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4 }}>
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background: "none", border: "none", borderBottom: tab === id ? "2px solid #000" : "2px solid transparent",
                color: tab === id ? "#000" : "#737373",
                fontFamily: "var(--font)", fontSize: 13, fontWeight: tab === id ? 700 : 500,
                padding: "10px 16px", cursor: "pointer", borderRadius: 0, boxShadow: "none",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }} className="fade-up">
        {tab === "explorer" && <Explorer walletAddr={walletAddr} />}
        {tab === "submit"   && <SubmitReport walletAddr={walletAddr} />}
        {tab === "company"  && <CompanyPortal walletAddr={walletAddr} />}
      </main>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────

export default function App() {
  const [inApp, setInApp] = useState(false);

  if (inApp) return <AppShell onBack={() => setInApp(false)} />;

  return (
    <>
      <Nav onLaunch={() => setInApp(true)} />
      <Hero onLaunch={() => setInApp(true)} />
      <HowItWorks />
      <ThreePaths />
      <Tracks />
      <CTABanner onLaunch={() => setInApp(true)} />
      <Footer />
    </>
  );
}
