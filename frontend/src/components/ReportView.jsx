// frontend/src/components/ReportView.jsx
// Fix: emoji written as literal characters instead of \uXXXX escapes.
// Logic/data-binding unchanged from previous version - still matches the
// real /api/analyze response shape (results.{fw}.text/.citations,
// verification.{fw}.verified/.unsupported_claims).

import React, { useState } from "react";
import "../styles/theme.css";

const FRAMEWORK_LABELS = {
  pestel: "PESTEL",
  swot: "SWOT",
  tam: "TAM",
  bmc: "BMC",
};

function StatusDot({ verified }) {
  return <span className={`status-dot ${verified ? "done" : "locked"}`} title={verified ? "Verified" : "Unverified"} />;
}

function CitationList({ citations }) {
  if (!citations || citations.length === 0) return null;
  const bySource = {};
  citations.forEach((c) => {
    const existing = bySource[c.source_url];
    if (!existing || c.similarity > existing.similarity) {
      bySource[c.source_url] = c;
    }
  });
  const unique = Object.values(bySource).sort((a, b) => b.similarity - a.similarity);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Sources
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {unique.map((c) => (
          <a
            key={c.source_url + c.index}
            href={c.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: "var(--accent-blue)", textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 8 }}
          >
            <span>[{c.index}] {c.source_title}</span>
            <span style={{ color: "var(--text-muted)" }}>{Math.round(c.similarity * 100)}% match</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function FrameworkSection({ frameworkKey, result, verification }) {
  const isInsufficient = result.text?.trim() === "Insufficient grounded data available for this section.";
  const verified = verification?.verified ?? false;

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{FRAMEWORK_LABELS[frameworkKey] || frameworkKey.toUpperCase()}</h3>
        <span
          className="pill"
          style={{
            color: verified ? "var(--accent-green)" : "var(--accent-amber)",
            borderColor: verified ? "var(--accent-green)" : "var(--accent-amber)",
          }}
        >
          {verified ? "✅ Verified" : "⚠️ Unverified"}
        </span>
      </div>

      <p
        style={{
          color: isInsufficient ? "var(--text-muted)" : "var(--text-primary)",
          fontStyle: isInsufficient ? "italic" : "normal",
          fontSize: 14,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {result.text}
      </p>

      {verification?.unsupported_claims?.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--accent-amber)" }}>
          {verification.unsupported_claims.join(", ")}
        </div>
      )}

      <CitationList citations={result.citations} />
    </div>
  );
}

export default function ReportView({ report, onReset }) {
  const frameworks = Object.keys(report?.results || {});
  const [activeFramework, setActiveFramework] = useState(frameworks[0] || null);

  if (!report) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark">G</span>
          Groundly
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 12px 4px" }}>
          Frameworks
        </div>

        {frameworks.map((fw) => {
          const verified = report.verification?.[fw]?.verified;
          return (
            <button
              key={fw}
              className={`sidebar-item ${activeFramework === fw ? "active" : ""}`}
              onClick={() => setActiveFramework(fw)}
            >
              <span>{FRAMEWORK_LABELS[fw] || fw.toUpperCase()}</span>
              <StatusDot verified={verified} />
            </button>
          );
        })}

        <div className="sidebar-footer">
          <button className="btn-secondary" style={{ width: "100%" }} onClick={onReset}>
            Start New Analysis
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Your Report</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
              {frameworks.length} framework{frameworks.length !== 1 ? "s" : ""} analyzed · stage: {report.stage}
            </p>
          </div>
        </div>

        {frameworks.map((fw) => (
          <FrameworkSection key={fw} frameworkKey={fw} result={report.results[fw]} verification={report.verification?.[fw]} />
        ))}
      </main>
    </div>
  );
}
