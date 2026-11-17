import { useEffect, useRef, useState } from "react";
import { matchDemoReportForIdea } from "./data/demoReports";
import {
  deleteProject,
  loadProjects,
  saveProject,
} from "./lib/projectsStore";
import {
  clearSharedHash,
  decodeReportLinkFromHash,
} from "./lib/reportLink";
import {
  formatIdeaTitle,
  stageIndexFromProgress,
} from "./lib/reportStats";
import { FRAMEWORKS, type GroundlyReport, type SavedProject } from "./types/groundly";
import ReportView from "./components/report/ReportView";
import { AnalyzeScreen } from "./components/workspace/AnalyzeScreen";
import {
  InsightsScreen,
  MarketScreen,
  ProjectsScreen,
} from "./components/workspace/SecondaryScreens";
import { TopNav, type WorkspaceTab } from "./components/workspace/TopNav";

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
  const [error, setError] = useState<string | null>(null);

  const runTokenRef = useRef(0);

  // Restore shared report from URL hash or jump straight to report via ?autostart=1
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
        return;
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get("autostart") === "1") {
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
    setError(null);
    setIsRunning(true);
    setProgress(8);

    const demoMatch = matchDemoReportForIdea(trimmed);

    // Unhurried advance through stages 0 -> 4 (~2.5s per stage)
    const stageInterval = window.setInterval(() => {
      setProgress((prev) => {
        if (demoMatch) {
          if (prev >= 96) return prev;
          return Math.min(96, prev + 1.75);
        }
        if (prev >= 92) return prev;
        const step = prev < 45 ? 2.8 : prev < 75 ? 1.8 : 0.9;
        return Math.min(92, prev + step);
      });
    }, 220);

    try {
      let report: GroundlyReport;

      if (demoMatch) {
        // Give the 3D train 11.4s for unhurried traversal across all 5 Stage Station Gates
        await new Promise((r) => setTimeout(r, 11400));
        report = demoMatch;
      } else {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            businessName: businessName.trim() || undefined,
            idea: idea.trim() || trimmed,
            industry: industry.trim() || undefined,
            geography: geography.trim() || "Mississauga, ON",
            dataSourceUrl: dataSourceUrl.trim() || undefined,
            frameworks: [...FRAMEWORKS],
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || "Analysis service could not complete this request.",
          );
        }
        report = data as GroundlyReport;
      }

      if (runTokenRef.current !== token) return;

      clearInterval(stageInterval);
      setProgress(100);
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
      setActiveTab("reports");
    } catch (err) {
      clearInterval(stageInterval);
      if (runTokenRef.current !== token) return;
      setIsRunning(false);
      setProgress(0);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete analysis. Please retry.",
      );
    }
  }

  function handleStartNewAnalysis() {
    runTokenRef.current += 1;
    clearSharedHash();
    setIsRunning(false);
    setProgress(0);
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

  const activeStageIndex = stageIndexFromProgress(progress);

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
          progress={progress}
          activeStageIndex={activeStageIndex}
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
