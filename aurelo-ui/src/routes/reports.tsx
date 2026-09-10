import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/lib/analysis/store";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const idea = useAnalysis((s) => s.idea);
  const report = useAnalysis((s) => s.report);
  const projects = useAnalysis((s) => s.projects);
  const latest = report
    ? { idea, report }
    : projects[0]
      ? { idea: projects[0].idea, report: projects[0].report }
      : null;

  function copy() {
    if (!latest) return;
    const r = latest.report;
    const text = [
      `Aurelo brief`,
      r.tagline,
      latest.idea,
      `Verdict: ${r.verdict} (${r.score})`,
      `TAM ${r.tam} · SAM ${r.sam} · SOM ${r.som}`,
      r.tamNote,
      "",
      "Insights",
      ...r.insights.map((i) => `- ${i.title}: ${i.body}`),
      "",
      "Next moves",
      ...r.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    ].join("\n");
    void navigator.clipboard.writeText(text);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Reports</h1>
            <p className="mt-2 text-sm text-muted">A readable export of the latest brief.</p>
          </div>
          {latest ? (
            <Button variant="outline" size="sm" onClick={copy}>
              Copy brief
            </Button>
          ) : null}
        </div>

        {!latest ? (
          <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
            <FileText className="size-8 text-faint" />
            <p className="mt-4 text-lg font-medium">No report yet</p>
            <p className="mt-2 text-sm text-muted">Complete an analysis to generate a brief.</p>
          </div>
        ) : (
          <article className="glass-card mt-8 rounded-[28px] p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-faint">Aurelo brief</p>
            <h2 className="mt-2 text-2xl font-semibold">{latest.report.tagline}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{latest.idea}</p>
            <p className="mt-6 text-sm">
              Verdict <span className="font-semibold">{latest.report.verdict}</span> · score{" "}
              <span className="tabular-nums">{latest.report.score}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              TAM {latest.report.tam} · SAM {latest.report.sam} · SOM {latest.report.som}
            </p>
            <p className="mt-2 text-sm text-faint">{latest.report.tamNote}</p>
            <div className="mt-8 space-y-4">
              {latest.report.insights.map((i) => (
                <section key={i.title}>
                  <h3 className="text-[15px] font-semibold">{i.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{i.body}</p>
                </section>
              ))}
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}
