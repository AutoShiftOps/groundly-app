// frontend/src/components/ReportsScreen.jsx
//
// GitHub visual-port task: aurelo-ui's actual reports.tsx is refreshingly
// simple -- if a report exists (active, or the most recent saved one),
// it just reopens the real ReportView; otherwise an honest empty state.
// Matched exactly, no new "reports list" UI invented -- the real report
// IS the report, same component every other nav item already uses.
import { Sparkles, FileText } from "lucide-react";
import Sidebar from "./Sidebar";
import ReportView from "./ReportView";

export default function ReportsScreen({ report, idea, onNewAnalysis, onNavigate }) {
  if (report) {
    return <ReportView report={report} idea={idea} onReset={onNewAnalysis} onNavigate={onNavigate} activeNav="Reports" />;
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar activeNav="Reports" onNavChange={onNavigate} />
      <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(99,140,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#4a8fff]" strokeWidth={2} />
            <span className="text-sm font-semibold text-[#c0cce8] tracking-wide">AI Business Analyst</span>
          </div>
        </header>
        <main className="flex-1 px-8 pt-8 pb-8">
          <h1 className="text-3xl font-extrabold text-white leading-tight">Reports</h1>
          <p className="mt-2 text-sm" style={{ color: "#7a8aaa" }}>Finished analyses open in the full framework report.</p>
          <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
            <FileText size={32} style={{ color: "#5a6a8a" }} />
            <p className="mt-4 text-lg font-semibold text-white">No report yet</p>
            <p className="mt-2 max-w-sm text-sm" style={{ color: "#7a8aaa" }}>Complete an analysis to generate a full framework report.</p>
            <button onClick={onNewAnalysis} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(90deg,#4a8fff 0%,#7c3aed 100%)", boxShadow: "0 0 20px rgba(74,143,255,0.4)" }}>
              Analyze an idea
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
