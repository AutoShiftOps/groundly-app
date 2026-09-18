// frontend/src/components/ProjectsScreen.jsx
//
// GitHub visual-port task: aurelo-ui's actual projects.tsx renders a
// glass-card grid (badge + score + tagline + idea snippet + timestamp),
// backed by its own zustand-persisted `projects` array. Ported the same
// visual treatment here, backed by real localStorage history
// (lib/projectsStore.js) of actual completed /api/analyze responses --
// same real verdict/confidence numbers ReportView's own VerdictBanner
// computes (lib/reportStats.js), not a fabricated score or badge.
import { Sparkles, Folder, Plus, Layers } from "lucide-react";
import Sidebar from "./Sidebar";
import { computeReportStats } from "../lib/reportStats";
import { ToneColor } from "./ReportView";
import { relativeTime } from "../lib/projectsStore";

function ProjectCard({ project, onOpen }) {
  const stats = computeReportStats(project.report);
  const color = ToneColor(stats.tone);
  const title = project.idea?.length > 88 ? project.idea.slice(0, 88) + "…" : project.idea || "Business idea analysis";

  return (
    <button type="button" onClick={() => onOpen(project)}
      className="glass-card w-full rounded-[22px] p-5 text-left transition-transform duration-150 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 34, height: 34, background: `${color}1a`, color }}>
          <Layers size={17} />
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}1a`, color }}>
            {stats.verdict}
          </span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: "#7a8aaa" }}>{stats.confidencePct}% confidence</span>
        </div>
      </div>
      <p className="text-[15px] font-semibold leading-snug text-white">{title}</p>
      <p className="mt-2 text-xs" style={{ color: "#5a6a8a" }}>
        {stats.verifiedCount}/{stats.totalFrameworks} frameworks verified · {stats.totalCitations} sources
      </p>
      <p className="mt-4 text-xs" style={{ color: "#5a6a8a" }}>{relativeTime(project.createdAt)}</p>
    </button>
  );
}

function EmptyState({ onNewAnalysis }) {
  return (
    <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
      <Folder size={32} style={{ color: "#5a6a8a" }} />
      <p className="mt-4 text-lg font-semibold text-white">No projects yet</p>
      <p className="mt-2 max-w-sm text-sm" style={{ color: "#7a8aaa" }}>
        Finished analyses land here automatically, saved on this device.
      </p>
      <button onClick={onNewAnalysis} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(90deg,#4a8fff 0%,#7c3aed 100%)", boxShadow: "0 0 20px rgba(74,143,255,0.4)" }}>
        <Plus size={16} /> New analysis
      </button>
    </div>
  );
}

export default function ProjectsScreen({ projects, onOpenProject, onNewAnalysis, onNavigate }) {
  return (
    <div className="flex min-h-screen w-full overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar activeNav="Projects" onNavChange={onNavigate} />
      <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(99,140,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#4a8fff]" strokeWidth={2} />
            <span className="text-sm font-semibold text-[#c0cce8] tracking-wide">AI Business Analyst</span>
          </div>
        </header>
        <main className="flex-1 px-8 pt-8 pb-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white leading-tight">Projects</h1>
              <p className="mt-2 text-sm" style={{ color: "#7a8aaa" }}>Analyses saved on this device.</p>
            </div>
            {projects.length > 0 && (
              <button onClick={onNewAnalysis} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 shrink-0"
                style={{ background: "linear-gradient(90deg,#4a8fff 0%,#7c3aed 100%)", boxShadow: "0 0 20px rgba(74,143,255,0.4)" }}>
                <Plus size={16} /> New analysis
              </button>
            )}
          </div>

          {projects.length === 0 ? (
            <EmptyState onNewAnalysis={onNewAnalysis} />
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={onOpenProject} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
