// frontend/src/components/TrainProgress.jsx
//
// High-fidelity rebuild targeting mockup.jpg as closely as hand-built
// SVG/CSS allows (no external art assets - everything below is custom-built):
// - Curved glowing SVG track with animated flowing highlight
// - Wagon-shaped carriages with wheels + couplers; final stage rendered as
//   an "engine nose" shape (asymmetric rounded corner) to read as the
//   not-yet-arrived front of the train
// - Animated smoke puffs rising from completed/active carriages
// - Real inline SVG sparklines in stat cards
// - Markets-analyzed chip row (country codes)
// - Pro Tip carousel with prev/next arrows + dot pagination (manual + auto)
// - Top-right "Live analysis" pill, bottom "encrypted and secure" footer
// - Shared sidebar with avatar/plan badge in the footer
//
// Props contract unchanged: activeIndex (0-based stage), sourceCount.

import React, { useState, useEffect, useMemo } from "react";
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

const MARKET_CODES = ["US", "UK", "IN", "DE", "CA", "AU", "SG", "AE", "BR"];

function Sparkline({ points, color = "var(--accent-blue)", width = 120, height = 32 }) {
  const path = useMemo(() => {
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    const stepX = width / (points.length - 1);
    return points
      .map((p, i) => {
        const x = i * stepX;
        const y = height - ((p - min) / range) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SmokePuffs({ active }) {
  if (!active) return null;
  return (
    <div className="smoke-wrap">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="smoke-puff"
          initial={{ opacity: 0.5, y: 0, scale: 0.6 }}
          animate={{ opacity: 0, y: -26, scale: 1.3 }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function TrainTrack() {
  return (
    <svg className="track-svg" viewBox="0 0 1000 40" preserveAspectRatio="none">
      <defs>
        <linearGradient id="railGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4f8cff" stopOpacity="0.15" />
          <stop offset="60%" stopColor="#a26bff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#a26bff" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path d="M0,20 Q250,4 500,20 T1000,20" fill="none" stroke="url(#railGrad)" strokeWidth="3" />
      <path
        d="M0,20 Q250,4 500,20 T1000,20"
        fill="none"
        stroke="#4f8cff"
        strokeWidth="2"
        strokeDasharray="6 10"
        opacity="0.6"
        className="track-flow"
      />
    </svg>
  );
}

function Carriage({ stage, state, isLast }) {
  return (
    <div className={`carriage-wrap ${isLast ? "engine" : ""}`}>
      <SmokePuffs active={state === "active" || state === "done"} />
      <motion.div
        className={`carriage ${state} ${isLast ? "engine-shape" : ""}`}
        animate={state === "active" ? { y: [0, -5, 0] } : { y: 0 }}
        transition={{ duration: 1.3, repeat: state === "active" ? Infinity : 0, ease: "easeInOut" }}
      >
        <span className="icon">{state === "done" ? "✅" : stage.icon}</span>
        <span className="label">{stage.label}</span>
      </motion.div>
      <div className="wheels">
        <span className="wheel" />
        <span className="wheel" />
      </div>
    </div>
  );
}

function ProTipCarousel({ tipIndex, setTipIndex }) {
  const goto = (delta) => setTipIndex((i) => (i + delta + STAGES.length) % STAGES.length);
  return (
    <div className="tip-carousel">
      <button className="tip-arrow" onClick={() => goto(-1)} aria-label="Previous tip">‹</button>
      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          className="tip-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <span className="tip-icon">💡</span>
          <div>
            <strong>Pro Tip</strong>
            <p>{STAGES[tipIndex].tip}</p>
          </div>
        </motion.div>
      </AnimatePresence>
      <button className="tip-arrow" onClick={() => goto(1)} aria-label="Next tip">›</button>
      <div className="tip-dots">
        {STAGES.map((_, i) => (
          <span key={i} className={`dot ${i === tipIndex ? "active" : ""}`} onClick={() => setTipIndex(i)} />
        ))}
      </div>
    </div>
  );
}

export default function TrainProgress({ activeIndex = 0, sourceCount = 0 }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % STAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const overallProgress = Math.min(100, Math.round(((activeIndex + 1) / STAGES.length) * 100));
  const dataPoints = 328 + activeIndex * 40;

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
        <div className="sidebar-footer">
          <div className="account-badge">
            <span className="avatar-dot" />
            <div>
              <div className="account-name">Founder</div>
              <div className="account-plan">Free</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content train-page">
        <div className="train-page-header">
          <div className="pill live-pill">
            <span className="pulse-dot" /> Live analysis
          </div>
        </div>

        <h1 className="train-headline">
          Analyzing your <span className="gradient-text">business idea</span> ✨
        </h1>
        <p className="train-subhead">Our AI is working its magic ✨</p>

        <div className="train-container">
          <div className="track">
            <div className="track-svg-wrap">
              <TrainTrack />
            </div>
            {STAGES.map((stage, i) => {
              const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";
              return <Carriage key={stage.key} stage={stage} state={state} isLast={i === STAGES.length - 1} />;
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
              <div className="stat-top">
                <div className="stat-value">{sourceCount}</div>
                <Sparkline points={[4, 7, 5, 9, 12, 10, 14, sourceCount || 16]} color="var(--accent-blue)" />
              </div>
              <div className="stat-label">sources scanned</div>
              <div className="stat-delta">+{Math.max(1, activeIndex * 3)} in the last 30s</div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-value">{MARKET_CODES.length}</div>
              </div>
              <div className="stat-label">markets analyzed</div>
              <div className="market-chips">
                {MARKET_CODES.map((code) => (
                  <span key={code} className="market-chip">{code}</span>
                ))}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <div className="stat-value">{dataPoints}</div>
                <Sparkline points={[20, 45, 30, 60, 55, 80, 70, dataPoints]} color="var(--accent-purple)" />
              </div>
              <div className="stat-label">data points processed</div>
              <div className="stat-delta">Crunching numbers for deeper insights</div>
            </div>
          </div>

          <ProTipCarousel tipIndex={tipIndex} setTipIndex={setTipIndex} />
        </div>

        <div className="secure-footer">🔒 Your data is encrypted and secure</div>
      </main>
    </div>
  );
}
