import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Folder, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/lib/analysis/store";

export const Route = createFileRoute("/projects")({ component: ProjectsPage });

function ProjectsPage() {
  const projects = useAnalysis((s) => s.projects);
  const openProject = useAnalysis((s) => s.openProject);
  const startCompose = useAnalysis((s) => s.startCompose);
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Projects</h1>
            <p className="mt-2 text-sm text-muted">Briefs stored on this device.</p>
          </div>
          <Button
            variant="glow"
            onClick={() => {
              startCompose();
              void navigate({ to: "/" });
            }}
          >
            <Plus className="size-4" />
            New analysis
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
            <Folder className="size-8 text-faint" />
            <p className="mt-4 text-lg font-medium">No briefs yet</p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Run the live theater, or start a new idea. Finished analyses land here.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    openProject(p.id);
                    void navigate({ to: "/" });
                  }}
                  className="glass-card w-full rounded-[24px] p-5 text-left transition-[transform] duration-150 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted">
                      {p.report.verdict}
                    </span>
                    <span className="text-sm tabular-nums text-cyan">{p.report.score}</span>
                  </div>
                  <p className="mt-3 text-[15px] font-semibold leading-snug">{p.report.tagline}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{p.idea}</p>
                  <p className="mt-4 text-xs text-faint">
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
