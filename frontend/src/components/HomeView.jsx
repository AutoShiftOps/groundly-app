// frontend/src/components/HomeView.jsx
//
// Idle-state screen: sidebar + idea input + "Launch Analysis" CTA.
// Drop this into App.jsx in place of the current plain-light idle markup.
// Props are the same state/handlers App.jsx already owns — no new logic added.

import React from "react";
import "../styles/theme.css";

const NAV_ITEMS = [
  { key: "analyze", label: "Analyze", icon: "\u26A1", active: true },
  { key: "projects", label: "Projects", icon: "\uD83D\uDCC1" },
  { key: "insights", label: "Insights", icon: "\uD83D\uDCA1" },
  { key: "market", label: "Market", icon: "\uD83D\uDCCA" },
  { key: "reports", label: "Reports", icon: "\uD83D\uDCC4" },
  { key: "settings", label: "Settings", icon: "\u2699\uFE0F" },
];

export default function HomeView({ idea, setIdea, onLaunch, error }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark">G</span>
          Groundly
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`sidebar-item ${item.active ? "active" : ""}`}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
        <div className="sidebar-footer">Your data is encrypted and secure</div>
      </aside>

      <main className="main-content">
        <div className="pill" style={{ marginBottom: 16 }}>
          <span>\u2728</span> AI Business Analyst
        </div>

        <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, margin: "0 0 12px" }}>
          Describe your <span className="gradient-text">business idea</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15, marginBottom: 32 }}>
          Generate a grounded, multi-framework decision report backed by real sources.
        </p>

        <div className="card" style={{ padding: 24, maxWidth: 640 }}>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g., A subscription box for eco-friendly packaging aimed at small e-commerce brands..."
            rows={5}
            style={{
              width: "100%",
              background: "var(--bg-panel)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: 14,
              padding: 14,
              resize: "vertical",
              fontFamily: "var(--font-sans)",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              className="btn-primary"
              onClick={onLaunch}
              disabled={!idea.trim()}
            >
              Launch Analysis
            </button>
          </div>
        </div>

        {error && (
          <div
            className="card"
            style={{
              marginTop: 20,
              maxWidth: 640,
              padding: 16,
              borderColor: "var(--accent-red)",
              color: "var(--accent-red)",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
