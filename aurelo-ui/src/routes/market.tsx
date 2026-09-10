import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { DEMO_REPORT } from "@/lib/analysis/demo";
import { useAnalysis } from "@/lib/analysis/store";

export const Route = createFileRoute("/market")({ component: MarketPage });

function MarketPage() {
  const report = useAnalysis((s) => s.report);
  const projects = useAnalysis((s) => s.projects);
  const latest = report ?? projects[0]?.report ?? DEMO_REPORT;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-3xl font-medium tracking-tight">Market</h1>
        <p className="mt-2 text-sm text-muted">{latest.tamNote}</p>

        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Stat k="TAM" v={latest.tam} />
          <Stat k="SAM" v={latest.sam} />
          <Stat k="SOM" v={latest.som} />
        </div>

        <div className="glass-card mt-6 rounded-[28px] p-6">
          <p className="text-sm font-medium text-muted">Opportunity by market</p>
          <ul className="mt-6 space-y-4">
            {latest.markets.map((m) => (
              <li key={m.code} className="grid grid-cols-[72px_1fr_40px] items-center gap-3">
                <span className="text-sm font-semibold">{m.code}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-deep via-violet to-magenta"
                    style={{ width: `${m.opportunity}%` }}
                  />
                </div>
                <span className="text-right text-sm tabular-nums text-cyan">{m.opportunity}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <article className="glass-card rounded-[24px] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-faint">{k}</p>
      <p className="mt-2 text-3xl font-semibold">{v}</p>
    </article>
  );
}
