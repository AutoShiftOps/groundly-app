// frontend/src/components/HomeView.jsx
// Fix: emoji written as literal characters instead of \uXXXX escapes,
// which rendered as raw garbage text in JSX (same bug as TrainProgress).

import React from "react";
import "../styles/theme.css";

const NAV_ITEMS = [
  { key: "analyze", label: "Analyze", icon: "⚡", active: true },
  { key: "projects", label: "Projects", icon: "📁" },
  { key: "insights", label: "Insights", icon: "💡" },
  { key: "market", label: "Market", icon: "📊" },
  { key: "reports", label: "Reports", icon: "📄" },
  { key: "settings", label: "Settings", icon: "⚙️" },
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
          <button key={item.key} className={`sidebar-item ${item.active ? "active" : ""}`}>
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
        <div className="sidebar-footer">Your data is encrypted and secure</div>
      </aside>

      <main className="main-content">
        <div className="pill" style={{ marginBottom: 16 }}>
          <span>✨</span> AI Business Analyst
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
            <button className="btn-primary" onClick={onLaunch} disabled={!idea.trim()}>
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
