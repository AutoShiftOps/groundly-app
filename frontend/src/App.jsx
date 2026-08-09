// frontend/src/App.jsx
// Same state/handlers/API contract as before. Only change: pass `idea` into
// ReportView so the report header can show the actual idea text as its title.

import React, { useState } from "react";
import TrainProgress from "./components/TrainProgress";
import HomeView from "./components/HomeView";
import ReportView from "./components/ReportView";
import { trackEvent } from "./lib/ga4";
import "./styles/theme.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const STAGE_COUNT = 5;
const SIMULATED_STAGE_INTERVAL_MS = 2000;

export default function App() {
  const [idea, setIdea] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleLaunch = async () => {
    if (!idea.trim()) return;

    trackEvent("analysis_launched", { idea_length: idea.length });
    setIsAnalyzing(true);
    setReport(null);
    setError(null);
    setActiveStage(0);

    let stage = 0;
    const stageTimer = setInterval(() => {
      stage = Math.min(stage + 1, STAGE_COUNT - 1);
      setActiveStage(stage);
    }, SIMULATED_STAGE_INTERVAL_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          frameworks: ["pestel", "swot", "tam", "bmc"],
          tier: "free",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      clearInterval(stageTimer);
      setActiveStage(STAGE_COUNT);
      setReport(data);
      trackEvent("report_completed");
    } catch (err) {
      clearInterval(stageTimer);
      setError(err.message || "Something went wrong while generating your report.");
      trackEvent("report_failed", { error: err.message });
    }
  };

  const handleReset = () => {
    setIsAnalyzing(false);
    setReport(null);
    setError(null);
    setIdea("");
  };

  const sourceCount = report
    ? Object.values(report.results || {}).reduce((sum, r) => sum + (r.citations?.length || 0), 0)
    : 0;

  if (report) {
    return <ReportView report={report} idea={idea} onReset={handleReset} />;
  }

  if (isAnalyzing) {
    return <TrainProgress activeIndex={activeStage} sourceCount={sourceCount} />;
  }

  return <HomeView idea={idea} setIdea={setIdea} onLaunch={handleLaunch} error={error} />;
}
