import { useEffect, useRef, useState } from "react";
import {
  deleteProject,
  loadProjects,
  saveProject,
} from "./lib/projectsStore";
import {
  clearSharedHash,
  decodeReportLinkFromHash,
} from "./lib/reportLink";
import { hydrateReport } from "./lib/hydrate";
import { trackEvent } from "./lib/ga4";
import { formatIdeaTitle } from "./lib/reportStats";
import { runAnalysis, type ProgressMode } from "./lib/analyzeStream";
import {
  applyStreamEvent,
  initialLiveProgress,
  runningStageView,
  type LiveProgress,
} from "./lib/liveProgress";
import { FRAMEWORKS, type GroundlyReport, type SavedProject } from "./types/groundly";
import ReportView from "./components/report/ReportView";
import { AnalyzeScreen } from "./components/workspace/AnalyzeScreen";
import {
  InsightsScreen,
  MarketScreen,
  ProjectsScreen,
} from "./components/workspace/SecondaryScreens";
import { TopNav, type WorkspaceTab } from "./components/workspace/TopNav";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

const STAGE_INTERVAL_MS = 220;

export default function App() {
  const [projects, setProjects] = useState<SavedProject[]>(() => loadProjects());
  const [activeProject, setActiveProject] = useState<SavedProject | null>(
    () => loadProjects()[0] ?? null,
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("analyze");

  const [mode, setMode] = useState<"idea" | "business">("idea");
  const [businessName, setBusinessName] = useState("");
  const [dataSourceUrl, setDataSourceUrl] = useState("");
  const [idea, setIdea] = useState("");
  const [industry, setIndustry] = useState("");
  const [geography, setGeography] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reportArrived, setReportArrived] = useState(false);
  const [progressMode, setProgressMode] = useState<ProgressMode>("live");
  const [liveProgress, setLiveProgress] = useState<LiveProgress>(initialLiveProgress);
  const [error, setError] = useState<string | null>(null);

  const runTokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Restore a shared report from the URL hash (see lib/reportLink.js --
  // same genuine gzip-in-the-hash mechanism main already shipped for
  // GitHub issue #17, no backend persistence involved).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const shared = await decodeReportLinkFromHash();
      if (mounted && shared?.report && shared?.idea) {
        const sharedProj: SavedProject = {
          id: `shared-${Date.now()}`,
          title: formatIdeaTitle(shared.idea),
          idea: shared.idea,
          createdAt: Date.now(),
          versionLabel: "Shared",
          report: shared.report,
        };
        setActiveProject(sharedProj);
        setActiveTab("reports");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLaunchAnalysis() {
    const trimmed =
      mode === "business"
        ? businessName.trim() + (idea.trim() ? ` — ${idea.trim()}` : "")
        : idea.trim();
    if (
      (mode === "business" ? businessName.trim().length < 2 : idea.trim().length < 12) ||
      isRunning
    ) {
      return;
    }

    const token = ++runTokenRef.current;
    trackEvent("analysis_launched", { idea_length: trimmed.length });
    setError(null);
    setReportArrived(false);
    setIsRunning(true);
    setProgressMode("live");
    setLiveProgress(initialLiveProgress());
    setProgress(0);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Fallback-only simulated progress (the backend's /api/analyze returns
    // the full report in one response): it moves stages to "passed", never
    // to done. It only starts if streaming real progress isn't possible.
    let stageInterval: number | undefined;
    const startTimerFallback = () => {
      if (runTokenRef.current !== token) return;
      // Never mix: drop any real-event state before the timer takes over.
      setLiveProgress(initialLiveProgress());
      setProgressMode("timer");
      setProgress(8);
      stageInterval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 92) return prev;
          const step = prev < 45 ? 2.8 : prev < 75 ? 1.8 : 0.9;
          return Math.min(92, prev + step);
        });
      }, STAGE_INTERVAL_MS);
    };

    try {
      const { report: data } = await runAnalysis({
        apiBase: API_BASE_URL,
        body: {
          idea: idea.trim() || trimmed,
          mode,
          businessName: businessName.trim() || undefined,
          industry: industry.trim() || undefined,
          geography: geography.trim() || undefined,
          dataSourceUrl: dataSourceUrl.trim() || undefined,
          frameworks: [...FRAMEWORKS],
          tier: "free",
        },
        signal: controller.signal,
        onEvent: (event) => {
          if (runTokenRef.current === token) setLiveProgress((prev) => applyStreamEvent(prev, event));
        },
        onFallback: (reason) => {
          trackEvent("analysis_stream_fallback", { reason });
          startTimerFallback();
        },
      });
      const report = hydrateReport(data) as GroundlyReport;

      if (runTokenRef.current !== token) return;

      clearInterval(stageInterval);
      setProgress(100);
      setReportArrived(true);
      await new Promise((r) => setTimeout(r, 380));
      if (runTokenRef.current !== token) return;

      const newProj: SavedProject = {
        id: `proj-${Date.now()}`,
        title: formatIdeaTitle(trimmed),
        idea: trimmed,
        industry: industry.trim() || undefined,
        geography: geography.trim() || undefined,
        createdAt: Date.now(),
        versionLabel: "v1.0",
        report,
      };
      const updated = saveProject(newProj);
      setProjects(updated);
      setActiveProject(newProj);
      setIsRunning(false);
      trackEvent("report_completed");
      setActiveTab("reports");
    } catch (err) {
      clearInterval(stageInterval);
      if (runTokenRef.current !== token) return;
      setIsRunning(false);
      setProgress(0);
      setReportArrived(false);
      setLiveProgress(initialLiveProgress());
      const message =
        err instanceof Error
          ? err.message
          : "Unable to complete analysis. Please retry.";
      setError(message);
      trackEvent("report_failed", { error: message });
    }
  }

  function handleStartNewAnalysis() {
    runTokenRef.current += 1;
    abortRef.current?.abort();
    clearSharedHash();
    setIsRunning(false);
    setProgress(0);
    setReportArrived(false);
    setError(null);
    setActiveTab("analyze");
  }

  function handleOpenProject(proj: SavedProject) {
    setActiveProject(proj);
    setActiveTab("reports");
  }

  function handleDeleteProject(projectId: string) {
    const updated = deleteProject(projectId);
    setProjects(updated);
    if (activeProject?.id === projectId) {
      setActiveProject(updated[0] ?? null);
    }
  }

  const stageView = runningStageView({
    mode: progressMode,
    live: liveProgress,
    timerProgress: progress,
    reportArrived,
  });

  return (
    <div
      className="workspace-canvas min-h-screen text-slate-100"
      data-active-tab={activeTab}
      data-running={isRunning ? "true" : "false"}
    >
      <TopNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === "reports" && !activeProject && projects.length > 0) {
            setActiveProject(projects[0]);
          }
          setActiveTab(tab);
        }}
        onNewAnalysis={handleStartNewAnalysis}
      />

      {activeTab === "analyze" && (
        <AnalyzeScreen
          mode={mode}
          setMode={setMode}
          businessName={businessName}
          setBusinessName={setBusinessName}
          dataSourceUrl={dataSourceUrl}
          setDataSourceUrl={setDataSourceUrl}
          idea={idea}
          setIdea={setIdea}
          industry={industry}
          setIndustry={setIndustry}
          geography={geography}
          setGeography={setGeography}
          isRunning={isRunning}
          progress={stageView.progress}
          activeStageIndex={stageView.activeStageIndex}
          stageStatuses={stageView.stageStatuses}
          stageLabels={stageView.stageLabels}
          error={error}
          onLaunch={handleLaunchAnalysis}
        />
      )}

      {activeTab === "projects" && (
        <ProjectsScreen
          projects={projects}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
          onNewAnalysis={handleStartNewAnalysis}
        />
      )}

      {activeTab === "insights" && (
        <InsightsScreen
          projects={projects}
          onOpenProject={handleOpenProject}
        />
      )}

      {activeTab === "market" && (
        <MarketScreen
          project={activeProject ?? projects[0] ?? null}
          projects={projects}
          onNewAnalysis={handleStartNewAnalysis}
          onOpenReport={() => {
            if (!activeProject && projects[0]) setActiveProject(projects[0]);
            setActiveTab("reports");
          }}
        />
      )}

      {activeTab === "reports" &&
        (activeProject ? (
          <ReportView
            project={activeProject}
            projects={projects}
            onStartNewAnalysis={handleStartNewAnalysis}
          />
        ) : (
          <div className="mx-auto max-w-xl px-4 py-20 text-center">
            <h1 className="font-display text-2xl font-bold text-white">
              No active report selected
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Start a new business idea validation or pick a saved project.
            </p>
            <button
              type="button"
              onClick={handleStartNewAnalysis}
              className="mt-5 rounded-xl bg-[#4a8fff] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Launch New Analysis
            </button>
          </div>
        ))}
    </div>
  );
}
