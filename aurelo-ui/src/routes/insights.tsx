import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lightbulb } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/lib/analysis/store";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

function InsightsPage() {
  const report = useAnalysis((s) => s.report);
  const projects = useAnalysis((s) => s.projects);
  const latest = report ?? projects[0]?.report;
  const navigate = useNavigate();
  const startCompose = useAnalysis((s) => s.startCompose);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-3xl font-medium tracking-tight">Insights</h1>
        <p className="mt-2 text-sm text-muted">The sharpest takes from the latest brief.</p>

        {!latest ? (
          <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
            <Lightbulb className="size-8 text-faint" />
            <p className="mt-4 text-lg font-medium">Nothing to show yet</p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Finish an analysis and the insight cards will land here.
            </p>
            <Button
              className="mt-6"
              variant="glow"
              onClick={() => {
                startCompose();
                void navigate({ to: "/" });
              }}
            >
              Analyze an idea
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {latest.insights.map((insight) => (
              <article key={insight.title} className="glass-card rounded-[24px] p-6">
                <p className="text-lg font-semibold">{insight.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{insight.body}</p>
              </article>
            ))}
            {latest.proTips.map((tip) => (
              <article key={tip} className="glass-card rounded-[24px] p-6">
                <p className="text-xs uppercase tracking-[0.14em] text-faint">Pro tip</p>
                <p className="mt-2 text-[15px] leading-relaxed">{tip}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
