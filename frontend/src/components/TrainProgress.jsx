// frontend/src/components/TrainProgress.jsx
//
// Fixes vs previous version:
// 1. Emoji written as literal characters (not \uXXXX escapes) - JSX text
//    nodes are not JS string literals, so escape sequences rendered as
//    raw text instead of being interpreted. This was the "\uD83D\uDCE1"
//    garbage text bug.
// 2. Full sidebar + train track + connecting rail + glow to match mockup.jpg
//    pixel-for-pixel structure: carriages sit on a horizontal rail, active
//    carriage glows amber, done carriages are green with a checkmark,
//    locked/upcoming carriages are outlined only.
//
// Same props contract as before: activeIndex (0-based stage), sourceCount.

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./TrainProgress.css";

const STAGES = [
  { key: "ideating", label: "Ideating", icon: "💡", tip: "A clear one-line problem statement predicts pivot success." },
  { key: "researching", label: "Researching", icon: "🔍", tip: "TAM measures total addressable market; SAM narrows it to what you can serve." },
  { key: "prototyping", label: "Prototyping", icon: "🧪", tip: "The BCG Matrix was created by Bruce Henderson in 1970." },
  { key: "testing", label: "Testing", icon: "⚗️", tip: "We cross-check every claim against its original source before it reaches you." },
  { key: "finalizing", label: "Finalizing", icon: "✨", tip: "Structured decision frameworks improve first-pitch funding odds." },
];

const SIDEBAR_ITEMS = [
  { key: "analyze", label: "Analyze", icon: "⚡", active: true },
  { key: "projects", label: "Projects", icon: "📁" },
  { key: "insights", label: "Insights", icon: "💡" },
  { key: "market", label: "Market", icon: "📊" },
  { key: "reports", label: "Reports", icon: "📄" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

export default function TrainProgress({ activeIndex = 0, sourceCount = 0 }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % STAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const overallProgress = Math.min(100, Math.round(((activeIndex + 1) / STAGES.length) * 100));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark">G</span>
          Groundly
        </div>
        {SIDEBAR_ITEMS.map((item) => (
          <button key={item.key} className={`sidebar-item ${item.active ? "active" : ""}`}>
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
        <div className="sidebar-footer">Your data is encrypted and secure</div>
      </aside>

      <main className="main-content train-page">
        <div className="train-page-header">
          <div className="pill">📡 Live analysis</div>
        </div>

        <h1 className="train-headline">
          Analyzing your <span className="gradient-text">business idea</span> ✨
        </h1>
        <p className="train-subhead">Our AI is working its magic ✨</p>

        <div className="train-container">
          <div className="track">
            <div className="rail" />
            {STAGES.map((stage, i) => {
              const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";
              return (
                <motion.div
                  key={stage.key}
                  className={`carriage ${state}`}
                  animate={state === "active" ? { y: [0, -5, 0] } : { y: 0 }}
                  transition={{ duration: 1.3, repeat: state === "active" ? Infinity : 0, ease: "easeInOut" }}
                >
                  <span className="icon">{state === "done" ? "✅" : stage.icon}</span>
                  <span className="label">{stage.label}</span>
                </motion.div>
              );
            })}
          </div>

          <div className="progress-block">
            <div className="progress-row">
              <span>Overall progress</span>
              <span className="progress-pct">{overallProgress}%</span>
            </div>
            <div className="progress-track">
              <motion.div
                className="progress-fill"
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <p className="status-line">Sit tight — great insights take time.</p>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{sourceCount}</div>
              <div className="stat-label">sources scanned</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">4</div>
              <div className="stat-label">frameworks analyzed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{activeIndex + 1}/{STAGES.length}</div>
              <div className="stat-label">stages complete</div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tipIndex}
              className="tip-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <strong>Pro Tip:</strong> {STAGES[tipIndex].tip}
            </motion.div>
          </AnimatePresence>

          <div className="tip-dots">
            {STAGES.map((_, i) => (
              <span key={i} className={`dot ${i === tipIndex ? "active" : ""}`} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
