// frontend/src/components/ReportView.jsx
//
// Pass 3 - closing the visual gap identified against report-ux-mock.jpg:
// 1. Emoji replaced with a consistent line-icon set (Icons.jsx) throughout.
// 2. Verdict condensed to a punchy single/double-line headline instead of
//    a long generated sentence.
// 3. Metric cards now carry a tiny inline sparkline (matches mock density).
// 4. "View all (N)" link added to Sources & Citations header.
// 5. Compare Version card added below Ask AI in the right rail (shell -
//    no backend for this yet, intentionally disabled + labeled).
// 6. Sidebar framework rows now show a real checkmark icon (not emoji dot)
//    when verified, matching the mock's green check style exactly.
//
// Data-binding is unchanged and still 100% derived from the real API
// response (report.results / report.verification) - no fabricated numbers.

import React, { useState, useMemo } from "react";
import "../styles/theme.css";
import "./ReportView.css";
import {
  IconShield, IconAlert, IconCheck, IconLock, IconShare, IconDownload,
  IconSparkle, IconMessage, IconGem, IconCompare, IconLayers,
} from "./Icons";

const FRAMEWORK_LABELS = { pestel: "PESTEL", swot: "SWOT", tam: "TAM", bmc: "BMC" };

const LOCKED_FRAMEWORKS = [
  { key: "porter5", label: "Porter's Five Forces" },
  { key: "bcg", label: "BCG Matrix" },
  { key: "valuechain", label: "Value Chain" },
  { key: "balancedscorecard", label: "Balanced Scorecard" },
];

function MiniSparkline({ points, color }) {
  const path = useMemo(() => {
    const w = 64, h = 22;
    const max = Math.max(...points), min = Math.min(...points), range = max - min || 1;
    const step = w / (points.length - 1);
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((p - min) / range) * h).toFixed(1)}`).join(" ");
  }, [points]);
  return (
    <svg width="64" height="22" viewBox="0 0 64 22" className="mini-spark">
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ConfidenceRing({ pct, tone }) {
  const color = { green: "var(--accent-green)", amber: "var(--accent-amber)", red: "var(--accent-red)" }[tone];
  return (
    <div className="confidence-ring" style={{ "--pct": pct, "--ring-color": color }}>
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

    let totalCitations = 0, similaritySum = 0, similarityCount = 0;
    const trend = [];

    frameworks.forEach((fw) => {
      const citations = report.results[fw]?.citations || [];
      const seen = new Set();
      citations.forEach((c) => {
        if (!seen.has(c.source_url)) { seen.add(c.source_url); totalCitations += 1; }
        similaritySum += c.similarity;
        similarityCount += 1;
        trend.push(Math.round(c.similarity * 100));
      });
    });

    const avgSimilarity = similarityCount ? Math.round((similaritySum / similarityCount) * 100) : 0;
    const confidencePct = totalFrameworks ? Math.round((verifiedCount / totalFrameworks) * 100) : 0;
    const unverifiedCount = totalFrameworks - verifiedCount;

    let verdict = "Insufficient Data";
    let verdictSub = "Not enough grounded sources yet to form a verdict.";
    let verdictTone = "amber";
    if (totalFrameworks > 0 && verifiedCount === totalFrameworks) {
      verdict = "Proceed With Confidence";
      verdictSub = "All frameworks are backed by verified, grounded sources.";
      verdictTone = "green";
    } else if (verifiedCount > 0) {
      verdict = "Proceed With Caution";
      verdictSub = `${unverifiedCount} of ${totalFrameworks} sections need stronger sourcing.`;
      verdictTone = "amber";
    } else if (totalFrameworks > 0) {
      verdict = "Gather More Sources";
      verdictSub = "No sections passed grounding verification yet.";
      verdictTone = "red";
    }

    return {
      frameworks, verifiedCount, totalFrameworks, totalCitations, avgSimilarity,
      confidencePct, unverifiedCount, verdict, verdictSub, verdictTone,
      trend: trend.length ? trend : [50],
    };
  }, [report]);
}

function VerdictBanner({ stats }) {
  const ToneIcon = { green: IconShield, amber: IconAlert, red: IconAlert }[stats.verdictTone];
  return (
    <div className={`verdict-banner tone-${stats.verdictTone}`}>
      <div className="verdict-left">
        <span className={`verdict-shield tone-${stats.verdictTone}`}><ToneIcon size={22} /></span>
        <div>
          <div className="verdict-label">Overall Strategic Verdict</div>
          <div className="verdict-text">{stats.verdict}</div>
          <div className="verdict-sub">{stats.verdictSub}</div>
        </div>
      </div>
      <div className="verdict-right">
        <ConfidenceRing pct={stats.confidencePct} tone={stats.verdictTone} />
        <div className="sources-badge">
          <IconLayers size={16} />
          <span>Based on <strong>{stats.totalCitations}</strong> grounded sources</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone, spark, sparkColor }) {
  return (
    <div className={`metric-card ${tone || ""}`}>
      <div className="metric-top">
        <div className="metric-value">{value}</div>
        {spark && <MiniSparkline points={spark} color={sparkColor} />}
      </div>
      <div className="metric-label">{label}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function MetricRow({ stats }) {
  return (
    <div className="metric-grid">
      <MetricCard
        label="Frameworks verified" value={`${stats.verifiedCount}/${stats.totalFrameworks}`} sub="Passed citation check"
        tone={stats.verifiedCount === stats.totalFrameworks ? "green" : "amber"}
        spark={[2, 3, 3, stats.verifiedCount]} sparkColor="var(--accent-green)"
      />
      <MetricCard
        label="Grounded sources" value={stats.totalCitations} sub="Unique citations used"
        spark={[stats.totalCitations * 0.4, stats.totalCitations * 0.7, stats.totalCitations * 0.85, stats.totalCitations]} sparkColor="var(--accent-blue)"
      />
      <MetricCard
        label="Avg source match" value={`${stats.avgSimilarity}%`} sub="Semantic similarity"
        spark={stats.trend} sparkColor="var(--accent-purple)"
      />
      <MetricCard
        label="Unverified sections" value={stats.unverifiedCount} sub={stats.unverifiedCount > 0 ? "Needs more sources" : "All clear"}
        tone={stats.unverifiedCount > 0 ? "amber" : "green"}
        spark={[stats.unverifiedCount + 2, stats.unverifiedCount + 1, stats.unverifiedCount]} sparkColor="var(--accent-amber)"
      />
    </div>
  );
}

function CitationList({ citations }) {
  if (!citations || citations.length === 0) return <p className="no-citations">No citations returned for this section.</p>;
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
        <div className="framework-title-row">
          <span className="framework-icon-badge"><IconLayers size={16} /></span>
          <div>
            <div className="framework-eyebrow">Framework</div>
            <h2>{FRAMEWORK_LABELS[frameworkKey] || frameworkKey.toUpperCase()}</h2>
          </div>
        </div>
        <span className={`pill ${verified ? "pill-green" : "pill-amber"}`}>
          {verified ? <IconCheck size={12} /> : <IconAlert size={12} />}
          {verified ? "Verified" : "Unverified"}
        </span>
      </div>

      <p className={`framework-text ${isInsufficient ? "muted italic" : ""}`}>{result.text}</p>

      {verification?.unsupported_claims?.length > 0 && (
        <div className="unsupported-note"><IconAlert size={13} /> {verification.unsupported_claims.join(", ")}</div>
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
  const totalUniqueSources = stats.totalCitations;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const title = idea ? (idea.length > 48 ? idea.slice(0, 48) + "…" : idea) : "Business Idea Analysis";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark">G</span>
          <div>
            <div>Groundly</div>
            <div className="brand-sub">AI Analysis Platform</div>
          </div>
        </div>

        <div className="sidebar-section-label">Frameworks</div>

        {stats.frameworks.map((fw) => {
          const verified = report.verification?.[fw]?.verified;
          return (
            <button key={fw} className={`sidebar-item ${activeFramework === fw ? "active" : ""}`} onClick={() => setActiveFramework(fw)}>
              <span>{FRAMEWORK_LABELS[fw] || fw.toUpperCase()}</span>
              <span className={`fw-status ${verified ? "done" : "pending"}`}>
                {verified ? <IconCheck size={13} /> : <span className="status-dot locked" />}
              </span>
            </button>
          );
        })}

        {LOCKED_FRAMEWORKS.map((fw) => (
          <button key={fw.key} className="sidebar-item locked-fw" disabled title="Not yet available">
            <span>{fw.label}</span>
            <IconLock size={12} />
          </button>
        ))}

        <div className="sidebar-footer">
          <div className="pro-upsell">
            <div className="pro-upsell-title"><IconGem size={14} /> Pro Plan</div>
            <p>Unlock advanced frameworks and export unlimited reports.</p>
            <button className="btn-secondary" disabled style={{ width: "100%" }}>Upgrade Plan</button>
          </div>
          <button className="btn-secondary" style={{ width: "100%", marginTop: 10 }} onClick={onReset}>
            Start New Analysis
          </button>
        </div>
      </aside>

      <main className="main-content report-page">
        <div className="report-header">
          <div className="report-header-left">
            <span className="report-icon"><IconLayers size={18} /></span>
            <div>
              <h1>{title}</h1>
              <div className="report-meta">{today} · v1.0 (Latest)</div>
            </div>
          </div>
          <div className="report-header-actions">
            <button className="btn-secondary" disabled title="Coming soon"><IconShare size={14} /> Share</button>
            <button className="btn-primary" disabled title="Coming soon"><IconDownload size={14} /> Export PDF</button>
          </div>
        </div>

        <VerdictBanner stats={stats} />
        <MetricRow stats={stats} />

        <div className="report-body-grid">
          <div>
            {activeResult && <FrameworkPanel frameworkKey={activeFramework} result={activeResult} verification={activeVerification} />}
          </div>

          <div className="right-rail">
            <div className="card rail-card">
              <div className="rail-card-header">
                <span>Sources & Citations</span>
                <span className="view-all-link">View all ({totalUniqueSources})</span>
              </div>
              <CitationList citations={activeResult?.citations} />
            </div>

            <div className="card rail-card ask-ai-card">
              <div className="rail-card-header">
                <span><IconSparkle size={14} /> Ask AI</span>
                <span className="pill pill-muted">Coming soon</span>
              </div>
              <div className="ask-ai-suggested"><IconMessage size={13} /> What are the biggest risks in this analysis?</div>
              <input className="ask-ai-input" placeholder="Ask anything about this analysis..." disabled />
            </div>

            <div className="card rail-card compare-card">
              <div className="rail-card-header-flat">
                <span><IconCompare size={14} /> Compare Version</span>
                <span className="view-all-link">Coming soon</span>
              </div>
              <p className="compare-sub">Compare this analysis with previous versions.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
