import { Plus } from "lucide-react";

export type WorkspaceTab = "analyze" | "projects" | "insights" | "market" | "reports";

interface TopNavProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onNewAnalysis: () => void;
}

const NAV_LINKS: { id: WorkspaceTab; label: string }[] = [
  { id: "analyze", label: "Analyze" },
  { id: "projects", label: "Projects" },
  { id: "insights", label: "Insights" },
  { id: "market", label: "Market" },
  { id: "reports", label: "Reports" },
];

export function TopNav({ activeTab, onSelectTab, onNewAnalysis }: TopNavProps) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#4a8fff]/15 bg-[#040814]/95">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Brand wordmark with crisp hexagonal emblem */}
        <button
          type="button"
          onClick={() => onSelectTab("analyze")}
          className="inline-flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#4a8fff]/45 bg-[#102046] text-[#60a5fa]"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
              <path
                d="M10 2L17 6V14L10 18L3 14V6L10 2Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M10 6.5V10L13.2 11.8"
                stroke="#34d399"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Groundly
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary workspace navigation"
          className="flex items-center gap-5 overflow-x-auto sm:gap-7"
        >
          {NAV_LINKS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? "border-[#4a8fff] text-white"
                    : "border-transparent text-slate-400 hover:text-slate-100"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewAnalysis}
            className="btn-primary-glow inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            New Analysis
          </button>
        </div>
      </div>
    </header>
  );
}
