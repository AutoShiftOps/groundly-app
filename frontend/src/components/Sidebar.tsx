// frontend/src/components/Sidebar.tsx
//
// Extracted from the Figma-generated App.tsx so Home and Loading screens
// share one sidebar instead of duplicating it. Purely presentational -
// no hardcoded app state.

import { TrendingUp, FolderOpen, Lightbulb, BarChart2, FileText, Settings, ChevronLeft } from "lucide-react";

const NAV_ITEMS = [
  { icon: TrendingUp, label: "Analyze" },
  { icon: FolderOpen, label: "Projects" },
  { icon: Lightbulb, label: "Insights" },
  { icon: BarChart2, label: "Market" },
  { icon: FileText, label: "Reports" },
];

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`relative flex flex-col items-center gap-1 w-full py-3 px-2 rounded-xl transition-all duration-200
        ${active ? "bg-[#1a2d50] text-[#4a8fff]" : "text-[#7a8aaa] hover:text-[#c0cce8] hover:bg-[#0f1d35]"}`}>
      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-[#4a8fff]"
          style={{ boxShadow: "0 0 8px #4a8fff" }} />
      )}
    </button>
  );
}

export default function Sidebar({ activeNav, onNavChange }: { activeNav: string; onNavChange: (l: string) => void }) {
  return (
    <aside className="relative flex flex-col items-center w-[76px] min-h-screen py-4 gap-1 shrink-0"
      style={{ background: "#080f1e", borderRight: "1px solid rgba(99,140,255,0.1)" }}>
      <div className="flex flex-col items-center gap-1 mb-6 mt-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #4a8fff 0%, #7c3aed 100%)" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 14H2L9 2Z" fill="white" fillOpacity="0.9" />
          </svg>
        </div>
        <span className="text-[10px] font-semibold text-white tracking-wider">Groundly</span>
      </div>
      <nav className="relative flex flex-col items-center gap-1 w-full px-2">
        {NAV_ITEMS.map(({ icon, label }) => (
          <NavItem key={label} icon={icon} label={label}
            active={activeNav === label} onClick={() => onNavChange(label)} />
        ))}
      </nav>
      <div className="flex flex-col items-center gap-3 mt-auto w-full px-2">
        <button className="flex flex-col items-center gap-1 w-full py-3 text-[#7a8aaa] hover:text-[#c0cce8] transition-colors rounded-xl hover:bg-[#0f1d35]">
          <Settings size={20} strokeWidth={1.8} />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #1d4ed8)" }}>
            <span className="text-xs font-bold text-white">F</span>
          </div>
          <span className="text-[9px] text-[#7a8aaa] font-medium text-center leading-tight">
            Founder
          </span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: "linear-gradient(90deg, #7c3aed, #4a8fff)", color: "#fff" }}>
            Free
          </span>
        </div>
        <button className="text-[#7a8aaa] hover:text-white transition-colors mt-1">
          <ChevronLeft size={14} />
        </button>
      </div>
    </aside>
  );
}
