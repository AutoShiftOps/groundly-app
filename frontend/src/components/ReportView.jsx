// frontend/src/components/ReportView.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";

// Exact list of frameworks from the EcoPack mock, including locked ones
const ALL_FRAMEWORKS = [
  { key: "pestel", label: "PESTEL" },
  { key: "porter", label: "Porter's Five Forces" },
  { key: "swot", label: "SWOT" },
  { key: "tam", label: "TAM SAM SOM" },
  { key: "bmc", label: "BMC" },
  { key: "bcg", label: "BCG Matrix" },
  { key: "valuechain", label: "Value Chain" },
  { key: "bsc", label: "Balanced Scorecard" },
];

function CircularProgress({ value }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
        <circle cx="60" cy="60" r={radius} stroke="var(--accent-green)" strokeWidth="8" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{value}%</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Confidence</div>
      </div>
    </div>
  );
}

export default function ReportView({ report, idea, onReset }) {
  // Find the first framework in the report to set as active
  const [activeFramework, setActiveFramework] = useState(
    ALL_FRAMEWORKS.find(fw => report?.results?.[fw.key])?.key || null
  );

  if (!report) return null;

  // Determine if a framework is available in the report results
  const currentResult = report.results?.[activeFramework];
  const currentVerification = report.verification?.[activeFramework];
  const verified = currentVerification?.verified ?? false;

  // Data for the visual dashboard mock
  const displayData = {
    verdict: verified ? "PROCEED WITH FOCUSED LAUNCH" : "REVIEW REQUIRED",
    confidence: verified ? 82 : 48,
    metrics: [
      { label: "Market Size", value: "$68.3B", desc: "High growth market with expansion ahead.", color: "var(--accent-blue)", sub: "8.6/10" },
      { label: "Competitive Pressure", value: "Moderate", desc: "Fragmented players with low switching costs.", color: "var(--accent-purple)", sub: "6.2/10" },
      { label: "Best Customer Segment", value: "Eco-conscious", desc: "Urban, 25-40, high sustainability intent.", color: "var(--accent-green)", sub: "8.4/10" },
      { label: "Business Model Fit", value: "Strong", desc: "D2C + Subscription model shows high fit.", color: "var(--accent-cyan)", sub: "8.1/10" },
      { label: "Risk Flags", value: "Medium", desc: "Raw material volatility and supplier risk.", color: "var(--accent-amber)", sub: "5.8/10" },
    ]
  };

  return (
    <div className="app-shell">
      {/* Sidebar - Groundly framework list (Dynamic checks and locks) */}
      <aside className="sidebar" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="sidebar-brand"><span className="logo-mark">G</span> Groundly</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '12px 12px 4px', letterSpacing: 1 }}>Frameworks</div>
        {ALL_FRAMEWORKS.map((fw) => {
          const isActive = fw.key === activeFramework;
          const isVerified = report.results?.[fw.key] !== undefined;
          return (
            <button
              key={fw.key}
              onClick={() => isVerified && setActiveFramework(fw.key)}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              style={{ justifyContent: 'space-between', cursor: isVerified ? 'pointer' : 'not-allowed', marginBottom: 2, opacity: isVerified ? 1 : 0.6 }}
            >
              <span>{fw.label}</span>
              {isVerified
                ? <span style={{ color: 'var(--accent-green)' }}>✓</span>
                : <span style={{ color: 'var(--text-muted)' }}>🔒</span>
              }
            </button>
          );
        })}
        <div className="sidebar-footer">
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent-purple)' }}>💎</span> <span style={{ fontSize: 13 }}>Pro Plan</span>
          </div>
          <button className="btn-secondary" style={{ width: '100%' }} onClick={onReset}>Upgrade Plan</button>
        </div>
      </aside>

      {/* Main Dashboard Content */}
      <main className="main-content" style={{ padding: '40px 48px', width: '100%', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h2 style={{ fontSize: 22, margin: '0 0 4px', fontWeight: 700 }}>{idea || "Your"} Startup Analysis</h2>
            <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>📅 {new Date().toLocaleDateString()}</span> <span>• v2.3 (Latest)</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>👥 Share</button>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>⬇ Export PDF</button>
          </div>
        </div>

        {/* Bulletproof 2-Column Flex Layout */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

          {/* LEFT COLUMN */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Verdict Banner */}
            <div className="card" style={{ padding: 24, marginBottom: 24, borderColor: verified ? 'var(--accent-green)' : 'var(--accent-amber)', background: verified ? 'rgba(16, 185, 129, 0.05)' : 'rgba(251, 191, 36, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ background: verified ? 'var(--accent-green)' : 'var(--accent-amber)', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{verified ? '🛡️' : '⚖️'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: verified ? 'var(--accent-green)' : 'var(--accent-amber)', fontWeight: 700, letterSpacing: 0.5 }}>OVERALL STRATEGIC VERDICT</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{displayData.verdict}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
                    {currentResult?.text ? currentResult.text.substring(0, 150) + "..." : "Strong market opportunity with manageable risks. Focus on eco-conscious urban consumers and D2C channel."}
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 24 }}><CircularProgress value={displayData.confidence} /></div>
              </div>
            </div>

            {/* 5 Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              {displayData.metrics.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 110, background: 'rgba(16, 20, 40, 0.6)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: 4, lineHeight: 1.3 }}>
                    <span>{m.desc}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{m.sub}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* TAM SAM SOM Section */}
            <div className="card" style={{ padding: 20, background: 'rgba(16, 20, 40, 0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>🧬</span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>TAM SAM SOM</h3>
                </div>
                <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 12, color: 'var(--text-secondary)' }}>Methodology ▾</span>
              </div>

              <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                {/* 3D Pie Chart */}
                <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--accent-blue)" strokeWidth="25" strokeDasharray="60 192" strokeDashoffset="0" />
                    <circle cx="50" cy="50" r="25" fill="none" stroke="var(--accent-green)" strokeWidth="20" strokeDasharray="40 118" strokeDashoffset="-60" />
                    <circle cx="50" cy="50" r="12" fill="none" stroke="var(--accent-amber)" strokeWidth="15" strokeDasharray="20 55" strokeDashoffset="-100" />
                  </svg>
                  <div style={{ position: 'absolute', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, color: 'white' }}>$1.9B</div>
                    <div>SOM</div>
                  </div>
                </div>

                {/* Table Data */}
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ textAlign: 'left', paddingBottom: 8 }}>Metric</th>
                        <th style={{ textAlign: 'left', paddingBottom: 8 }}>Value (USD)</th>
                        <th style={{ textAlign: 'left', paddingBottom: 8 }}>% of Parent</th>
                        <th style={{ textAlign: 'left', paddingBottom: 8 }}>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ padding: '8px 0' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-blue)', display: 'inline-block', marginRight: 8 }}></span>TAM</td><td>$68.3B</td><td>—</td><td style={{ color: 'var(--text-muted)' }}>[1] Statista</td></tr>
                      <tr><td style={{ padding: '8px 0' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', marginRight: 8 }}></span>SAM</td><td>$18.7B</td><td>27.4%</td><td style={{ color: 'var(--text-muted)' }}>[2] GVR</td></tr>
                      <tr><td style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-amber)', display: 'inline-block', marginRight: 8 }}></span>SOM</td><td>$1.9B</td><td>10.2%</td><td style={{ color: 'var(--text-muted)' }}>[3] Mordor</td></tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: 16, fontSize: 13, display: 'flex', gap: 24, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
                    <div><span style={{ color: 'var(--accent-green)', marginRight: 6 }}>💡</span> Key Takeaway</div>
                    <div>EcoPack can realistically capture ~$1.9B (10.2% of SAM) within 3 years by focusing on urban millennials.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Fixed Width */}
          <div style={{ width: 380, flexShrink: 0 }}>

            {/* Sources & Citations */}
            <div className="card" style={{ padding: 20, marginBottom: 20, background: 'rgba(16, 20, 40, 0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
                <span>Sources & Citations</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', cursor: 'pointer' }}>View all ({currentResult?.citations?.length || 0}) ➜</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentResult?.citations?.slice(0, 3).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{i + 1}. {c.source_title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.source_url}</div>
                    </div>
                    <div style={{ background: 'var(--bg-panel)', padding: '2px 8px', borderRadius: 12, height: 'fit-content', color: 'var(--text-secondary)' }}>{Math.round(c.similarity * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ask AI */}
            <div className="card" style={{ padding: 20, marginBottom: 20, background: 'rgba(16, 20, 40, 0.6)', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>✧ Ask AI</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Suggested</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid rgba(79, 140, 255, 0.3)' }}>
                What are the biggest risks to supply chain in 2026?
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <input type="text" placeholder="Ask anything about this analysis..." style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: 13 }} /><span style={{ color: 'var(--accent-blue)' }}>➤</span>
              </div>
            </div>

            {/* Compare Version */}
            <div className="card" style={{ padding: 20, background: 'rgba(16, 20, 40, 0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
                <span>Compare Version</span>
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-secondary)' }}>Compare this analysis with previous versions</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>⌄ Coming soon</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 40 }}>🔒 Your data is encrypted and secure</div>
      </main>
    </div>
  );
}