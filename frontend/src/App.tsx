// frontend/src/App.tsx
//
// Restored router. The Figma import commit replaced this entire file with
// just the static loading-screen mockup (hardcoded stage 4 "active", 72%
// progress, no idea input, no API call, no report view). This rebuild:
// - Keeps the exact same real /api/analyze contract and stage-timer logic
//   from the working version before the Figma import.
// - Routes between HomeScreen -> LoadingScreen -> ReportView based on real
//   state (idea / isAnalyzing / report), same pattern as before.
// - Passes real activeStageIndex + sourceCount into LoadingScreen instead
//   of the hardcoded constants that were in the Figma export.

import { useState } from "react";
import HomeScreen from "./components/HomeScreen";
import LoadingScreen from "./components/LoadingScreen";
import ReportView from "./components/ReportView";
import { trackEvent } from "./lib/ga4";
import "./styles/theme.css";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

const STAGE_COUNT = 5;
const SIMULATED_STAGE_INTERVAL_MS = 2000;

export default function App() {
  const [idea, setIdea] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
          frameworks: ["pestel", "swot", "tam", "bmc", "porter", "stp", "bcg"],
          tier: "free",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      clearInterval(stageTimer);
      setActiveStage(STAGE_COUNT - 1);
      setReport(data);
      trackEvent("report_completed");
    } catch (err: any) {
      clearInterval(stageTimer);
      setError(err.message || "Something went wrong while generating your report.");
      trackEvent("report_failed", { error: err.message });
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setIsAnalyzing(false);
    setReport(null);
    setError(null);
    setIdea("");
  };

  const sourceCount = report
    ? Object.values(report.results || {}).reduce((sum: number, r: any) => sum + (r.citations?.length || 0), 0)
    : 0;

  if (report) {
    return <ReportView report={report} idea={idea} onReset={handleReset} />;
  }

  if (isAnalyzing) {
    return <LoadingScreen activeStageIndex={activeStage} sourceCount={sourceCount} />;
  }

  return <HomeScreen idea={idea} setIdea={setIdea} onLaunch={handleLaunch} error={error} />;
}
