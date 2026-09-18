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

import { useState, useEffect } from "react";
import HomeScreen from "./components/HomeScreen";
import LoadingScreen from "./components/LoadingScreen";
import ReportView from "./components/ReportView";
import ProjectsScreen from "./components/ProjectsScreen";
import InsightsScreen from "./components/InsightsScreen";
import MarketScreen from "./components/MarketScreen";
import ReportsScreen from "./components/ReportsScreen";
import { trackEvent } from "./lib/ga4";
import { decodeReportLinkFromHash, clearSharedHash } from "./lib/reportLink";
import { loadProjects, saveProject } from "./lib/projectsStore";
import "./styles/theme.css";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

const STAGE_COUNT = 5;
const SIMULATED_STAGE_INTERVAL_MS = 2000;

type Page = "home" | "projects" | "insights" | "market" | "reports";

export default function App() {
  const [idea, setIdea] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("home");
  // GitHub visual-port task (Projects/Insights/Market/Reports nav):
  // real history of completed analyses, persisted to this browser's
  // localStorage (lib/projectsStore.js) -- loaded once on mount, then
  // grown in memory as real analyses complete below. Not fabricated;
  // every entry is a real past /api/analyze response.
  const [projects, setProjects] = useState<any[]>(() => loadProjects());

  // GitHub issue #17 (Share): a shared link encodes the whole report
  // directly in the URL hash (see lib/reportLink.js) since there's no
  // backend persistence -- restore it on mount if present, same as any
  // other "load state from the URL" router would. Only runs once; a
  // shared link is meant to open straight into its report, not run
  // handleLaunch again.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const shared = await decodeReportLinkFromHash();
      if (shared && !cancelled) {
        setIdea(shared.idea || "");
        setReport(shared.report);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          frameworks: ["pestel", "swot", "tam", "bmc", "porter", "stp", "bcg", "value_chain", "balanced_scorecard", "ansoff"],
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
      const saved = saveProject(idea, data);
      if (saved) setProjects((prev) => [saved, ...prev].slice(0, 24));
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
    setPage("home");
    clearSharedHash();
  };

  // GitHub visual-port task: the icon-rail Sidebar's nav items
  // (Projects/Insights/Market/Reports) previously just highlighted
  // themselves and did nothing -- this is the real switch. "Analyze" is
  // handled separately by each screen's own onReset call (unchanged),
  // matching aurelo-ui's own nav semantics.
  const handleNavigate = (label: string) => {
    const map: Record<string, Page> = { Projects: "projects", Insights: "insights", Market: "market", Reports: "reports" };
    if (map[label]) setPage(map[label]);
  };

  const handleOpenProject = (project: { idea: string; report: any }) => {
    setIdea(project.idea);
    setReport(project.report);
    setError(null);
    setIsAnalyzing(false);
    setPage("home");
  };

  const sourceCount = report
    ? Object.values(report.results || {}).reduce((sum: number, r: any) => sum + (r.citations?.length || 0), 0)
    : 0;

  if (page === "projects") {
    return <ProjectsScreen projects={projects} onOpenProject={handleOpenProject} onNewAnalysis={handleReset} onNavigate={handleNavigate} />;
  }
  if (page === "insights") {
    return <InsightsScreen report={report ?? projects[0]?.report ?? null} onNewAnalysis={handleReset} onNavigate={handleNavigate} />;
  }
  if (page === "market") {
    return <MarketScreen report={report ?? projects[0]?.report ?? null} idea={report ? idea : projects[0]?.idea ?? ""} onNewAnalysis={handleReset} onNavigate={handleNavigate} />;
  }
  if (page === "reports") {
    return (
      <ReportsScreen
        report={report ?? projects[0]?.report ?? null}
        idea={report ? idea : projects[0]?.idea ?? ""}
        onNewAnalysis={handleReset}
        onNavigate={handleNavigate}
      />
    );
  }

  if (report) {
    return <ReportView report={report} idea={idea} onReset={handleReset} onNavigate={handleNavigate} />;
  }

  if (isAnalyzing) {
    return <LoadingScreen activeStageIndex={activeStage} sourceCount={sourceCount} onNavigate={handleNavigate} />;
  }

  return <HomeScreen idea={idea} setIdea={setIdea} onLaunch={handleLaunch} error={error} onNavigate={handleNavigate} />;
}
