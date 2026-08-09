import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./TrainProgress.css";

const STAGES = [
  { key: "ideating", label: "Ideating", tip: "A clear one-line problem statement predicts pivot success." },
  { key: "researching", label: "Researching", tip: "TAM measures total addressable market; SAM narrows it to what you can serve." },
  { key: "prototyping", label: "Prototyping", tip: "The BCG Matrix was created by Bruce Henderson in 1970." },
  { key: "testing", label: "Testing", tip: "We cross-check every claim against its original source before it reaches you." },
  { key: "finalizing", label: "Finalizing", tip: "Structured decision frameworks improve first-pitch funding odds." },
];

export default function TrainProgress({ activeIndex = 0, sourceCount = 0 }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % STAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="train-container" role="status" aria-live="polite">
      <div className="track">
        {STAGES.map((stage, i) => {
          const status = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
          return (
            <motion.div
              key={stage.key}
              className={`carriage ${status}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: status === "active" ? [1, 1.05, 1] : 1,
              }}
              transition={
                status === "active"
                  ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.4 }
              }
            >
              <span className="icon">
                {status === "done" ? "\u2714" : status === "active" ? "\u25CF" : "\u25CB"}
              </span>
              <span className="label">{stage.label}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="status-line">
        {sourceCount > 0 && <span>{sourceCount} sources scanned...</span>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          className="tip-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
        >
          Did you know? {STAGES[tipIndex].tip}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* Respect prefers-reduced-motion: fallback handled in TrainProgress.css */
