import React, { useState } from "react";
import TrainProgress from "./components/TrainProgress";
import { trackEvent } from "./lib/ga4";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Simulated stage timings while we wait for the real API call to resolve.
// Backend currently returns one final response (not streaming), so we advance
// the train visually while the request is in flight, then jump to "done" on response.
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

    // Visual stage progression while the real request is in flight.
    let stage = 0;
    const stageTimer = setInterval(() => {
      stage = Math.min(stage + 1, STAGE_COUNT - 1); // hold at "Testing" until response arrives
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
      setActiveStage(STAGE_COUNT); // marks all stages as done
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

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 32, fontFamily: "system-ui" }}>
      <h1>Groundly</h1>
      <p>Describe your business idea to generate a grounded, multi-framework decision report.</p>

      {!isAnalyzing && (
        <>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 12, fontSize: 16 }}
            placeholder="e.g., A subscription box for eco-friendly packaging aimed at small e-commerce brands..."
          />
          <button
            onClick={handleLaunch}
            style={{ marginTop: 16, padding: "10px 24px", fontSize: 16, cursor: "pointer" }}
          >
            Launch Analysis
          </button>
        </>
      )}

      {isAnalyzing && !report && !error && (
        <TrainProgress activeIndex={activeStage} sourceCount={activeStage * 12} />
      )}

      {error && (
        <div style={{ marginTop: 24, padding: 16, background: "#fdecea", color: "#611a15", borderRadius: 8 }}>
          <strong>Error:</strong> {error}
          <div style={{ marginTop: 12 }}>
            <button onClick={handleReset} style={{ padding: "8px 16px", cursor: "pointer" }}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {report && (
        <div style={{ marginTop: 24 }}>
          <h2>Your Report</h2>
          {report.frameworks_allowed.map((framework) => (
            <div key={framework} style={{ marginBottom: 20, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
              <h3 style={{ textTransform: "uppercase", fontSize: 14, color: "#555" }}>{framework}</h3>
              <p>{report.results[framework]?.text}</p>
              {report.results[framework]?.citations?.length > 0 && (
                <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                  Sources:{" "}
                  {report.results[framework].citations.map((c) => (
                    <span key={c.index} style={{ marginRight: 8 }}>
                      [{c.index}] {c.source_title || c.source_url || "unknown"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button onClick={handleReset} style={{ padding: "10px 24px", cursor: "pointer" }}>
            Start New Analysis
          </button>
        </div>
      )}
    </div>
  );
}