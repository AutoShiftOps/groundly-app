import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileText,
  Folder,
  Lightbulb,
  LineChart,
  Menu,
  PieChart,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAnalysis } from "@/lib/analysis/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Analyze", icon: LineChart },
  { to: "/projects", label: "Projects", icon: Folder },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/market", label: "Market", icon: PieChart },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className={cn(
        "flex",
        compact ? "flex-row justify-around w-full" : "flex-col items-center gap-2",
      )}
    >
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn("nav-item", active && "active", compact && "w-auto min-w-14 px-2")}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-[18px]" strokeWidth={1.75} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LogoMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center">
        <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan via-violet to-magenta opacity-90" />
        <span className="relative grid size-[30px] place-items-center rounded-[7px] bg-sidebar">
          <Sparkles className="size-3.5 text-cyan" strokeWidth={2.2} />
        </span>
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-fg">Aurelo</span>
    </Link>
  );
}

export function AppShell({
  children,
  actions,
}: {
  children: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  const founderName = useAnalysis((s) => s.founderName);
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell relative flex min-h-dvh flex-col">
      <div className="app-grid pointer-events-none absolute inset-0" />

      <header className="relative z-20 flex items-center gap-3 px-4 py-4 md:px-5">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-[14px] bg-white/5 text-fg md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>
        <LogoMark />
        <div className="ml-3 hidden items-center gap-2 text-sm text-muted md:flex">
          <Sparkles className="size-3.5 text-violet" />
          <span>AI Business Analyst</span>
        </div>
        <div className="ml-auto flex items-center gap-3">{actions}</div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="hidden w-[92px] shrink-0 flex-col items-center border-r border-line/80 py-2 md:flex">
          <div className="flex flex-1 flex-col items-center">
            <NavList />
          </div>
          <div className="mt-4 flex flex-col items-center gap-2 px-2 pb-4">
            <div className="orb size-11 rounded-full shadow-[0_0_18px_rgba(139,124,255,0.45)]" />
            <p className="max-w-[76px] text-center text-[11px] font-medium leading-tight text-fg">
              {founderName}
            </p>
            <span className="rounded-full bg-violet/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet">
              Pro
            </span>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden px-4 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-sidebar/95 px-2 py-1 backdrop-blur md:hidden">
        <NavList compact />
      </nav>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <LogoMark />
              <button
                type="button"
                className="grid size-10 place-items-center rounded-[12px] bg-white/5"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
