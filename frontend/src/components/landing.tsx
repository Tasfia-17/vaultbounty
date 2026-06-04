// Landing page sections for VaultBounty
import type React from "react";
import { Tag } from "./common.js";

const S = {
  section: { maxWidth: 1100, margin: "0 auto", padding: "0 24px" } as React.CSSProperties,
};

export function Nav({ onLaunch }: { onLaunch: () => void }) {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
      borderBottom: "1px solid #e5e5e5",
    }}>
      <div style={{ ...S.section, display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.4px" }}>
            Vault<span style={{ background: "#a3e635", padding: "0 4px", borderRadius: 4 }}>Bounty</span>
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="#how" style={{ fontSize: 14, fontWeight: 500, color: "#525252" }}>How it works</a>
          <a href="#tracks" style={{ fontSize: 14, fontWeight: 500, color: "#525252" }}>Tracks</a>
          <button className="btn-primary" onClick={onLaunch}>Launch App →</button>
        </div>
      </div>
    </nav>
  );
}

export function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section style={{ background: "linear-gradient(135deg, rgb(137,229,240), rgb(182,239,246) 27%, rgb(204,243,250) 35%, rgb(197,243,248) 55%)", padding: "80px 24px 100px" }}>
      <div style={{ ...S.section, textAlign: "center" }}>
        <div style={{ marginBottom: 20 }}>
          <Tag color="#a3e635">Powered by CDR × Story Protocol</Tag>
        </div>
        <h1 style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.14, letterSpacing: "-1.3px", marginBottom: 24, maxWidth: 800, margin: "0 auto 24px" }}>
          Prove the bug exists.<br />
          <span style={{ background: "#a3e635", borderRadius: 8, padding: "0 12px", display: "inline-block" }}>Without showing it.</span>
        </h1>
        <p style={{ fontSize: 20, fontWeight: 500, color: "#1a1a1a", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Researchers encrypt exploit proofs inside CDR vaults. TEEs verify severity on-chain.
          Companies pay <em>before</em> they see the code. No trusted middleman.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn-primary" style={{ fontSize: 16, padding: "12px 28px" }} onClick={onLaunch}>
            Launch App →
          </button>
          <a href="#how">
            <button className="btn-ghost" style={{ fontSize: 16, padding: "12px 28px" }}>
              How it works
            </button>
          </a>
        </div>
        {/* Stats row */}
        <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 64, flexWrap: "wrap" }}>
          {[
            { v: "$2B+", l: "Q1 2025 exploit losses" },
            { v: "0", l: "trusted middlemen" },
            { v: "3", l: "disclosure paths" },
            { v: "80/15/5", l: "researcher / DAO / TEE split" },
          ].map(({ v, l }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.5px" }}>{v}</div>
              <div style={{ fontSize: 13, color: "#525252", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { n: "01", title: "Researcher encrypts", desc: "Exploit bytecode + PoC are encrypted into a CDR vault. The company never sees it — only the vault UUID goes on-chain.", color: "var(--card-mint)" },
    { n: "02", title: "TEE verifies severity", desc: "A Trusted Execution Environment forks the target contract, runs the exploit inside the enclave, and signs an attestation. Severity is now on-chain proof.", color: "var(--card-lavender)" },
    { n: "03", title: "Company pays atomically", desc: "One transaction pays the bounty and flips the CDR gate. The decrypt key is released to the company — only after payment clears.", color: "var(--card-saffron)" },
    { n: "04", title: "7-day escalation window", desc: "No payment? After the deadline, the CDR vault auto-releases to the Whitehat DAO. The researcher still gets paid. The company gets tagged.", color: "var(--card-pink)" },
  ];

  return (
    <section id="how" style={{ padding: "80px 24px", background: "var(--canvas-white)" }}>
      <div style={S.section}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#525252", textTransform: "uppercase", marginBottom: 12 }}>How it works</p>
          <h2 style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.96px", lineHeight: 1.16 }}>
            Four steps.<br />Zero trust required.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {steps.map(({ n, title, desc, color }) => (
            <div key={n} className="card" style={{ background: color, border: "1px solid #171717", boxShadow: "rgb(10,10,13) 4px 4px 0px 0px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#525252", marginBottom: 12 }}>{n}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.18px", marginBottom: 10 }}>{title}</h3>
              <p style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ThreePaths() {
  return (
    <section style={{ padding: "80px 24px", background: "linear-gradient(rgb(219,244,181), rgb(198,238,137))" }}>
      <div style={S.section}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#3a5a00", textTransform: "uppercase", marginBottom: 12 }}>CDR vault gates</p>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.6px", marginBottom: 20, lineHeight: 1.33 }}>
              Three paths.<br />One vault.
            </h2>
            <p style={{ fontSize: 16, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 24 }}>
              The CDR read condition is a state machine. Each path is mutually exclusive,
              gated by on-chain payment state, caller identity, and block timestamp.
            </p>
            <p style={{ fontSize: 14, color: "#3a5a00", fontWeight: 500 }}>
              The exploit never leaves the TEE until the correct state is reached.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { path: "PATH_VERIFY", desc: "TEE reads + runs exploit → severity attestation. No exploit leaked.", bg: "var(--canvas-white)" },
              { path: "PATH_DISCLOSE", desc: "Company paid → gate opens → exploit decrypted to company only.", bg: "#a3e635" },
              { path: "PATH_ESCALATE", desc: "7-day deadline passed, bounty unpaid → DAO receives exploit.", bg: "var(--card-pink)" },
            ].map(({ path, desc, bg }) => (
              <div key={path} style={{
                background: bg, border: "1px solid #171717",
                borderRadius: 8, padding: "16px 20px",
                boxShadow: "rgb(10,10,13) 2px 2px 0px 0px",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{path}</div>
                <div style={{ fontSize: 14, color: "#1a1a1a" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Tracks() {
  return (
    <section id="tracks" style={{ padding: "80px 24px", background: "var(--pale-ash)" }}>
      <div style={S.section}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.6px" }}>Built to win both tracks</h2>
          <p style={{ fontSize: 16, color: "#525252", marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>
            One project. Two prize tracks. Three paths in the CDR vault.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {[
            {
              track: "Technical Implementation",
              prize: "$1,000",
              bg: "var(--card-lavender)",
              items: [
                "Three-branch CDR read condition state machine",
                "TEE attestation with ECDSA operator signature",
                "Nonce-based replay protection on-chain",
                "Atomic payment + vault unlock in one tx",
                "Composable: exploits as Story IP Assets",
              ],
            },
            {
              track: "Best CDR Application",
              prize: "$1,000 + $1,000",
              bg: "#fbbf25",
              items: [
                "$2B+ quarterly exploit losses — real market pain",
                "Live reentrancy demo: drain honeypot on testnet",
                "Researcher never trusts company. Company never trusts researcher.",
                "TEE attestation hash = cryptographic receipt",
                "Platform for infinite bounties, not a one-off demo",
              ],
            },
          ].map(({ track, prize, bg, items }) => (
            <div key={track} className="card-lg" style={{ background: bg, border: "1px solid #171717", boxShadow: "rgb(10,10,13) 4px 4px 0px 0px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, color: "#525252" }}>Track</div>
              <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.24px", marginBottom: 4 }}>{track}</h3>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 20 }}>{prize}</div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map(i => (
                  <li key={i} style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "flex-start" }}>
                    <span style={{ color: "#16a34a", fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTABanner({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section style={{ padding: "80px 24px", background: "var(--canvas-white)", borderTop: "1px solid #e5e5e5" }}>
      <div style={{ ...S.section, textAlign: "center" }}>
        <h2 style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.96px", lineHeight: 1.16, marginBottom: 20 }}>
          The TEE attestation hash<br />is the receipt.
        </h2>
        <p style={{ fontSize: 18, color: "#525252", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
          Encrypt your exploit. Get paid. No trust, no middleman, no CFAA exposure.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn-primary" style={{ fontSize: 16, padding: "12px 28px" }} onClick={onLaunch}>
            Open the app →
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#737373", marginTop: 16 }}>
          Story Aeneid Testnet · Powered by CDR Vaults
        </p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer style={{ background: "var(--pale-ash)", borderTop: "1px solid #e5e5e5", padding: "32px 24px" }}>
      <div style={{ ...S.section, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          Vault<span style={{ background: "#a3e635", padding: "0 4px", borderRadius: 3 }}>Bounty</span>
        </div>
        <div style={{ fontSize: 13, color: "#525252" }}>
          CDR Hackathon 2026 · Built on Story Protocol
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#525252" }}>
          <a href="https://docs.story.foundation/developers/cdr-sdk/overview" target="_blank" rel="noreferrer">CDR Docs</a>
          <a href="https://aeneid.storyscan.io" target="_blank" rel="noreferrer">Explorer</a>
        </div>
      </div>
    </footer>
  );
}
