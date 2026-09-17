import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_IDEA, DEMO_REPORT } from "./demo";
import { MARKET_CODES, PRO_TIPS, stageIndexFromProgress } from "./types";
import type { AnalysisReport, Project, View } from "./types";
import { deriveBrief } from "@/lib/groundly/brief";
import { buildGroundlyFallback } from "@/lib/groundly/fallback";
import { hydrateReport } from "@/lib/groundly/hydrate";
import type { GroundlyReport } from "@/lib/groundly/types";

interface AnalysisStore {
  view: View;
  idea: string;
  progress: number;
  sources: number;
  dataPoints: number;
  markets: string[];
  tipIndex: number;
  report: AnalysisReport | null;
  pendingReport: AnalysisReport | null;
  groundly: GroundlyReport | null;
  pendingGroundly: GroundlyReport | null;
  projects: Project[];
  founderName: string;
  isDemo: boolean;
  reducedMotion: boolean;
  startCompose: () => void;
  startDemo: () => void;
  startRun: (idea: string, isDemo?: boolean) => void;
  attachReport: (report: AnalysisReport) => void;
  attachGroundly: (report: GroundlyReport) => void;
  tick: () => void;
  nextTip: () => void;
  prevTip: () => void;
  setTip: (index: number) => void;
  openProject: (id: string) => void;
  setFounderName: (name: string) => void;
  setReducedMotion: (value: boolean) => void;
  clearProjects: () => void;
}

function uid(): string {
  return `prj_${Math.random().toString(36).slice(2, 10)}`;
}

function commitProject(
  idea: string,
  brief: AnalysisReport,
  groundly: GroundlyReport,
  projects: Project[],
): Project[] {
  const project: Project = {
    id: uid(),
    idea,
    createdAt: Date.now(),
    report: brief,
    groundly,
  };
  return [project, ...projects].slice(0, 24);
}

export const useAnalysis = create<AnalysisStore>()(
  persist(
    (set, get) => ({
      view: "compose",
      idea: "",
      progress: 0,
      sources: 0,
      dataPoints: 0,
      markets: [],
      tipIndex: 0,
      report: null,
      pendingReport: null,
      groundly: null,
      pendingGroundly: null,
      projects: [],
      founderName: "Neon Founder",
      isDemo: false,
      reducedMotion: false,

      startCompose: () =>
        set({
          view: "compose",
          progress: 0,
          sources: 0,
          dataPoints: 0,
          markets: [],
          report: null,
          pendingReport: null,
          groundly: null,
          pendingGroundly: null,
          isDemo: false,
          idea: "",
        }),

      startDemo: () => {
        const groundly = buildGroundlyFallback(DEMO_IDEA, "local");
        set({
          view: "running",
          idea: DEMO_IDEA,
          progress: 72,
          sources: 47,
          dataPoints: 328,
          markets: [...MARKET_CODES],
          tipIndex: 0,
          report: null,
          pendingReport: DEMO_REPORT,
          groundly: null,
          pendingGroundly: groundly,
          isDemo: true,
        });
      },

      startRun: (idea, isDemo = false) =>
        set({
          view: "running",
          idea,
          progress: 0,
          sources: 3,
          dataPoints: 12,
          markets: ["US"],
          tipIndex: 0,
          report: null,
          pendingReport: isDemo ? DEMO_REPORT : null,
          groundly: null,
          pendingGroundly: isDemo ? buildGroundlyFallback(idea, "local") : null,
          isDemo,
        }),

      attachReport: (report) => {
        const { progress } = get();
        set({ pendingReport: report });
        if (progress >= 100) {
          const { idea, projects, pendingGroundly } = get();
          const groundly = pendingGroundly ?? buildGroundlyFallback(idea, "local");
          set({
            view: "report",
            report,
            groundly,
            projects: commitProject(idea, report, groundly, projects),
          });
        }
      },

      attachGroundly: (groundly) => {
        const hydrated = hydrateReport(groundly);
        const brief = deriveBrief(get().idea, hydrated);
        const { progress } = get();
        set({ pendingGroundly: hydrated, pendingReport: brief });
        if (progress >= 100) {
          const { idea, projects } = get();
          set({
            view: "report",
            report: brief,
            groundly: hydrated,
            projects: commitProject(idea, brief, hydrated, projects),
          });
        }
      },

      tick: () => {
        const state = get();
        if (state.view !== "running") return;

        const waiting = state.progress >= 94 && !state.pendingReport && !state.pendingGroundly;
        const increment = waiting
          ? 0
          : state.progress < 70
            ? 0.32
            : state.progress < 90
              ? 0.18
              : 0.12;
        const progress = Math.min(waiting ? 96 : 100, state.progress + increment);

        let sources = state.sources;
        let dataPoints = state.dataPoints;
        if (progress < 100) {
          if (Math.random() > 0.45) sources += Math.random() > 0.5 ? 1 : 2;
          dataPoints += 1 + Math.floor(Math.random() * 4);
        }

        const unlocked = 1 + Math.min(MARKET_CODES.length - 1, Math.floor(progress / 11));
        const markets = MARKET_CODES.slice(0, unlocked).map(String);

        const shouldAdvanceTip = Math.floor(progress) % 12 === 0 && Math.floor(state.progress) % 12 !== 0;

        if (progress >= 100 && (state.pendingGroundly || state.pendingReport)) {
          const groundly = hydrateReport(state.pendingGroundly ?? buildGroundlyFallback(state.idea, "local"));
          const brief = state.pendingReport ?? deriveBrief(state.idea, groundly);
          set({
            progress: 100,
            sources,
            dataPoints,
            markets,
            view: "report",
            report: brief,
            groundly,
            projects: commitProject(state.idea, brief, groundly, state.projects),
            tipIndex: shouldAdvanceTip ? (state.tipIndex + 1) % PRO_TIPS.length : state.tipIndex,
          });
          return;
        }

        set({
          progress,
          sources: Math.min(186, sources),
          dataPoints: Math.min(2400, dataPoints),
          markets,
          tipIndex: shouldAdvanceTip ? (state.tipIndex + 1) % PRO_TIPS.length : state.tipIndex,
        });
      },

      nextTip: () =>
        set({ tipIndex: (get().tipIndex + 1) % PRO_TIPS.length }),
      prevTip: () =>
        set({ tipIndex: (get().tipIndex + PRO_TIPS.length - 1) % PRO_TIPS.length }),
      setTip: (index) => set({ tipIndex: index }),

      openProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        if (!project) return;
        const groundly = project.groundly ?? buildGroundlyFallback(project.idea, "local");
        set({
          view: "report",
          idea: project.idea,
          report: project.report,
          groundly,
          pendingReport: project.report,
          pendingGroundly: groundly,
          progress: 100,
          sources: 64,
          dataPoints: 512,
          markets: project.report.markets?.map((m) => m.code) ?? ["US"],
          isDemo: false,
        });
      },

      setFounderName: (founderName) => set({ founderName }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      clearProjects: () => set({ projects: [] }),
    }),
    {
      name: "aurelo-analysis",
      partialize: (state) => ({
        projects: state.projects,
        founderName: state.founderName,
        reducedMotion: state.reducedMotion,
      }),
    },
  ),
);

export { stageIndexFromProgress };
