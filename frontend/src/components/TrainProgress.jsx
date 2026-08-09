// frontend/src/components/TrainProgress.jsx
//
// Drop-in replacement for the existing TrainProgress component.
// Same props contract as before: activeIndex (0-based stage), sourceCount.
// Keeps the original STAGES data (labels + tips) — only the visuals change,
// so App.jsx's handleLaunch stage-timer logic needs no edits.

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./TrainProgress.css";

const STAGES = [
  { key: "ideating", label: "Ideating", icon: "\uD83D\uDCA1", tip: "A clear one-line problem statement predicts pivot success." },
  { key: "researching", label: "Researching", icon: "\uD83D\uDD0D", tip: "TAM measures total addressable market; SAM narrows it to what you can serve." },
  { key: "prototyping", label: "Prototyping", icon: "\uD83E\uDDEA", tip: "The BCG Matrix was created by Bruce Henderson in 1970." },
  { key: "testing", label: "Testing", icon: "\u2697\uFE0F", tip: "We cross-check every claim against its original source before it reaches you." },
  { key: "finalizing", label: "Finalizing", icon: "\u2728", tip: "Structured decision frameworks improve first-pitch funding odds." },
];

export default function TrainProgress({ activeIndex = 0, sourceCount = 0 }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % STAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const overallProgress = Math.min(
    100,
    Math.round(((activeIndex + 1) / STAGES.length) * 100)
  );

  return (
    <div className="app-shell">
      <main className="main-content" style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="pill" style={{ marginBottom: 16 }}>
          <span>\uD83D\uDCE1</span> Live analysis
        </div>

        <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 8px" }}>
          Analyzing your <span className="gradient-text">business idea</span> \u2728
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
          Our AI is working its magic \u2728
        </p>

        <div className="train-container">
          <div className="track">
            {STAGES.map((stage, i) => {
              const state =
                i < activeIndex ? "done" : i === activeIndex ? "active" : "";
              return (
                <motion.div
                  key={stage.key}
                  className={`carriage ${state}`}
                  animate={
                    state === "active"
                      ? { y: [0, -4, 0] }
                      : { y: 0 }
                  }
                  transition={{ duration: 1.2, repeat: state === "active" ? Infinity : 0 }}
                >
                  <span className="icon">
                    {state === "done" ? "\u2705" : stage.icon}
                  </span>
                  <span className="label">{stage.label}</span>
                </motion.div>
              );
            })}
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
              <span>Overall progress</span>
              <span style={{ color: "var(--accent-blue)", fontWeight: 700 }}>{overallProgress}%</span>
            </div>
            <div style={{ height: 8, background: "var(--bg-panel)", borderRadius: 999, overflow: "hidden" }}>
              <motion.div
                style={{ height: "100%", background: "var(--gradient-primary)" }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <p className="status-line" style={{ marginTop: 8 }}>
              Sit tight — great insights take time.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 28 }}>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{sourceCount}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>sources scanned</div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>4</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>frameworks analyzed</div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{activeIndex + 1}/{STAGES.length}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>stages complete</div>
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
              style={{ marginTop: 20 }}
            >
              <strong>Pro Tip:</strong> {STAGES[tipIndex].tip}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
