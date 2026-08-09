// frontend/src/components/ReportView.jsx
//
// Full rebuild targeting report-ux-mock.jpg structure:
// - Header: title + date/version chip + Share/Export buttons (shells)
// - Verdict banner: shield icon + verdict text + confidence ring + sources badge
// - Metric card row (4 cards) computed from REAL data (no fabricated numbers)
// - Sidebar: real frameworks (clickable, filters main panel - this was the
//   bug before: sidebar clicks didn't filter anything) + locked/unbuilt
//   frameworks shown greyed out with a lock icon, matching mock's premium feel
// - Main panel shows ONLY the active framework (like TAM/SAM/SOM mock panel)
// - Right rail: Sources & Citations list + Ask AI shell
//
// Numbers shown are derived strictly from report.results / report.verification -
// nothing here is invented. Where the mock shows data we don't have (TAM/SAM/SOM
// split, dollar market size), that specific widget is intentionally omitted
// rather than faked.

import React, { useState, useMemo } from "react";
import "../styles/theme.css";
import "./ReportView.css";

const FRAMEWORK_LABELS = { pestel: "PESTEL", swot: "SWOT", tam: "TAM", bmc: "BMC" };

const LOCKED_FRAMEWORKS = [
  { key: "porter5", label: "Porter's Five Forces" },
  { key: "bcg", label: "BCG Matrix" },
  { key: "valuechain", label: "Value Chain" },
  { key: "balancedscorecard", label: "Balanced Scorecard" },
];

function ConfidenceRing({ pct }) {
  return (
    <div className="confidence-ring" style={{ "--pct": pct }}>
      <div className="confidence-ring-text">
        <span className="confidence-pct">{pct}%</span>
        <span className="confidence-caption">Confidence</span>
      </div>
    </div>
  );
}

function useReportStats(report) {
  return useMemo(() => {
    const frameworks = Object.keys(report?.results || {});
    const verifiedCount = frameworks.filter((fw) => report.verification?.[fw]?.verified).length;
    const totalFrameworks = frameworks.length;

    let totalCitations = 0;
    let similaritySum = 0;
    let similarityCount = 0;

    frameworks.forEach((fw) => {
      const citations = report.results[fw]?.citations || [];
      const seen = new Set();
      citations.forEach((c) => {
        if (!seen.has(c.source_url)) {
          seen.add(c.source_url);
          totalCitations += 1;
        }
        similaritySum += c.similarity;
        similarityCount += 1;
      });
    });

    const avgSimilarity = similarityCount ? Math.round((similaritySum / similarityCount) * 100) : 0;
    const confidencePct = totalFrameworks ? Math.round((verifiedCount / totalFrameworks) * 100) : 0;
    const unverifiedCount = totalFrameworks - verifiedCount;

    let verdict = "INSUFFICIENT DATA";
    let verdictTone = "amber";
    if (totalFrameworks > 0 && verifiedCount === totalFrameworks) {
      verdict = "PROCEED WITH CONFIDENCE";
      verdictTone = "green";
    } else if (verifiedCount > 0) {
      verdict = "PROCEED WITH CAUTION";
      verdictTone = "amber";
    } else {
      verdict = "GATHER MORE SOURCES FIRST";
      verdictTone = "red";
    }

    return { frameworks, verifiedCount, totalFrameworks, totalCitations, avgSimilarity, confidencePct, unverifiedCount, verdict, verdictTone };
  }, [report]);
}

function VerdictBanner({ stats }) {
  const toneIcon = { green: "🛡️", amber: "⚠️", red: "🚩" }[stats.verdictTone];
  return (
    <div className={`verdict-banner tone-${stats.verdictTone}`}>
      <div className="verdict-left">
        <span className="verdict-shield">{toneIcon}</span>
        <div>
          <div className="verdict-label">OVERALL STRATEGIC VERDICT</div>
          <div className="verdict-text">{stats.verdict}</div>
          <div className="verdict-sub">
            {stats.verifiedCount} of {stats.totalFrameworks} frameworks passed grounding verification.
          </div>
        </div>
      </div>
      <div className="verdict-right">
        <ConfidenceRing pct={stats.confidencePct} />
        <div className="sources-badge">
          Based on <strong>{stats.totalCitations}</strong> grounded sources
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone }) {
  return (
    <div className={`metric-card ${tone || ""}`}>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function MetricRow({ stats }) {
  return (
    <div className="metric-grid">
      <MetricCard label="Frameworks verified" value={`${stats.verifiedCount}/${stats.totalFrameworks}`} sub="Passed citation check" tone={stats.verifiedCount === stats.totalFrameworks ? "green" : "amber"} />
      <MetricCard label="Grounded sources" value={stats.totalCitations} sub="Unique citations used" />
      <MetricCard label="Avg source match" value={`${stats.avgSimilarity}%`} sub="Semantic similarity" />
      <MetricCard label="Unverified sections" value={stats.unverifiedCount} sub={stats.unverifiedCount > 0 ? "Needs more sources" : "All clear"} tone={stats.unverifiedCount > 0 ? "amber" : "green"} />
    </div>
  );
}

function CitationList({ citations }) {
  if (!citations || citations.length === 0) {
    return <p className="no-citations">No citations returned for this section.</p>;
  }
  const bySource = {};
  citations.forEach((c) => {
    const existing = bySource[c.source_url];
    if (!existing || c.similarity > existing.similarity) bySource[c.source_url] = c;
  });
  const unique = Object.values(bySource).sort((a, b) => b.similarity - a.similarity);

  return (
    <div className="citation-list">
      {unique.map((c) => (
        <a key={c.source_url + c.index} href={c.source_url} target="_blank" rel="noopener noreferrer" className="citation-row">
          <span className="citation-index">[{c.index}]</span>
          <span className="citation-title">{c.source_title}</span>
          <span className="citation-match">{Math.round(c.similarity * 100)}%</span>
        </a>
      ))}
    </div>
  );
}

function FrameworkPanel({ frameworkKey, result, verification }) {
  const isInsufficient = result.text?.trim() === "Insufficient grounded data available for this section.";
  const verified = verification?.verified ?? false;

  return (
    <div className="framework-panel">
      <div className="framework-panel-header">
        <div>
          <div className="framework-eyebrow">Framework</div>
          <h2>{FRAMEWORK_LABELS[frameworkKey] || frameworkKey.toUpperCase()}</h2>
        </div>
        <span className={`pill ${verified ? "pill-green" : "pill-amber"}`}>
          {verified ? "✅ Verified" : "⚠️ Unverified"}
        </span>
      </div>

      <p className={`framework-text ${isInsufficient ? "muted italic" : ""}`}>{result.text}</p>

      {verification?.unsupported_claims?.length > 0 && (
        <div className="unsupported-note">⚠ {verification.unsupported_claims.join(", ")}</div>
      )}
    </div>
  );
}

export default function ReportView({ report, idea, onReset }) {
  const stats = useReportStats(report);
  const [activeFramework, setActiveFramework] = useState(stats.frameworks[0] || null);

  if (!report) return null;

  const activeResult = activeFramework ? report.results[activeFramework] : null;
  const activeVerification = activeFramework ? report.verification?.[activeFramework] : null;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const title = idea ? (idea.length > 48 ? idea.slice(0, 48) + "…" : idea) : "Business Idea Analysis";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark">G</span>
          Groundly
        </div>

        <div className="sidebar-section-label">Frameworks</div>

        {stats.frameworks.map((fw) => {
          const verified = report.verification?.[fw]?.verified;
          return (
            <button
              key={fw}
              className={`sidebar-item ${activeFramework === fw ? "active" : ""}`}
              onClick={() => setActiveFramework(fw)}
            >
              <span>{FRAMEWORK_LABELS[fw] || fw.toUpperCase()}</span>
              <span className={`status-dot ${verified ? "done" : "locked"}`} />
            </button>
          );
        })}

        {LOCKED_FRAMEWORKS.map((fw) => (
          <button key={fw.key} className="sidebar-item locked-fw" disabled title="Not yet available">
            <span>{fw.label}</span>
            <span className="lock-icon">🔒</span>
          </button>
        ))}

        <div className="sidebar-footer">
          <div className="pro-upsell">
            <div className="pro-upsell-title">💎 Pro Plan</div>
            <p>Unlock advanced frameworks and export unlimited reports.</p>
            <button className="btn-secondary" disabled style={{ width: "100%" }}>
              Upgrade Plan
            </button>
          </div>
          <button className="btn-secondary" style={{ width: "100%", marginTop: 10 }} onClick={onReset}>
            Start New Analysis
          </button>
        </div>
      </aside>

      <main className="main-content report-page">
        <div className="report-header">
          <div className="report-header-left">
            <span className="report-icon">📊</span>
            <div>
              <h1>{title}</h1>
              <div className="report-meta">
                {today} · v1.0 (Latest)
              </div>
            </div>
          </div>
          <div className="report-header-actions">
            <button className="btn-secondary" disabled title="Coming soon">👥 Share</button>
            <button className="btn-primary" disabled title="Coming soon">⬇ Export PDF</button>
          </div>
        </div>

        <VerdictBanner stats={stats} />
        <MetricRow stats={stats} />

        <div className="report-body-grid">
          <div>
            {activeResult && (
              <FrameworkPanel frameworkKey={activeFramework} result={activeResult} verification={activeVerification} />
            )}
          </div>

          <div className="right-rail">
            <div className="card rail-card">
              <div className="rail-card-header">
                <span>Sources & Citations</span>
              </div>
              <CitationList citations={activeResult?.citations} />
            </div>

            <div className="card rail-card ask-ai-card">
              <div className="rail-card-header">
                <span>✨ Ask AI</span>
                <span className="pill" style={{ fontSize: 11 }}>Coming soon</span>
              </div>
              <div className="ask-ai-suggested">
                What are the biggest risks in this analysis?
              </div>
              <input className="ask-ai-input" placeholder="Ask anything about this analysis..." disabled />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
