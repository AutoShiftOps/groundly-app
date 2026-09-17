import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/lib/analysis/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const founderName = useAnalysis((s) => s.founderName);
  const reducedMotion = useAnalysis((s) => s.reducedMotion);
  const setFounderName = useAnalysis((s) => s.setFounderName);
  const setReducedMotion = useAnalysis((s) => s.setReducedMotion);
  const clearProjects = useAnalysis((s) => s.clearProjects);
  const startDemo = useAnalysis((s) => s.startDemo);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl">
        <h1 className="text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted">Local only. Nothing is sent until you run an analysis.</p>

        <label className="mt-8 block text-sm font-medium text-muted" htmlFor="founder">
          Display name
        </label>
        <input
          id="founder"
          value={founderName}
          onChange={(e) => setFounderName(e.target.value.slice(0, 32))}
          className="mt-2 h-12 w-full rounded-[14px] bg-elevated px-4 text-sm text-fg shadow-[0_0_0_1px_rgba(148,180,255,0.16)] outline-none focus:shadow-[0_0_0_1px_rgba(139,124,255,0.55)]"
        />

        <label className="mt-6 flex items-center justify-between gap-4 rounded-[18px] bg-elevated px-4 py-4 shadow-[0_0_0_1px_rgba(148,180,255,0.12)]">
          <span>
            <span className="block text-sm font-medium">Reduce motion</span>
            <span className="mt-1 block text-xs text-faint">Shorten the analysis theater.</span>
          </span>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
            className="size-4 accent-violet"
          />
        </label>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="outline" onClick={startDemo}>
            Reset live theater
          </Button>
          <Button variant="ghost" onClick={clearProjects}>
            Clear saved briefs
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
