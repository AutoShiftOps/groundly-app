import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AnalysisTheater, LiveBadge } from "@/components/analyze/analysis-theater";
import { IdeaForm } from "@/components/analyze/idea-form";
import ReportView from "@/components/report/ReportView";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { analyzeIdeaGroundly } from "@/lib/groundly/analyze";
import { buildGroundlyFallback } from "@/lib/groundly/fallback";
import { DEMO_IDEA } from "@/lib/analysis/demo";
import { useAnalysis } from "@/lib/analysis/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const view = useAnalysis((s) => s.view);
  const idea = useAnalysis((s) => s.idea);
  const groundly = useAnalysis((s) => s.groundly);
  const tick = useAnalysis((s) => s.tick);
  const startCompose = useAnalysis((s) => s.startCompose);
  const startRun = useAnalysis((s) => s.startRun);
  const attachGroundly = useAnalysis((s) => s.attachGroundly);
  const reducedMotion = useAnalysis((s) => s.reducedMotion);
  const inFlight = useRef(false);

  useEffect(() => {
    if (view !== "running") return;
    const ms = reducedMotion ? 32 : 160;
    const id = window.setInterval(() => tick(), ms);
    return () => window.clearInterval(id);
  }, [view, tick, reducedMotion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { decodeReportLinkFromHash } = await import("@/lib/groundly/report-link");
      const shared = await decodeReportLinkFromHash();
      if (!shared || cancelled) return;
      if (shared.report?.results) {
        useAnalysis.setState({
          idea: shared.idea || "",
          groundly: shared.report,
          view: "report",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(nextIdea: string) {
    const isDemo = nextIdea === DEMO_IDEA;
    startRun(nextIdea, isDemo);
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = (await analyzeIdeaGroundly({ data: { idea: nextIdea } })) as {
        ok: boolean;
        report?: import("@/lib/groundly/types").GroundlyReport;
      };
      if (result.ok && result.report) attachGroundly(result.report);
      else attachGroundly(buildGroundlyFallback(nextIdea));
    } catch {
      attachGroundly(buildGroundlyFallback(nextIdea));
    } finally {
      inFlight.current = false;
    }
  }

  if (view === "report" && groundly) {
    return <ReportView report={groundly} idea={idea} onReset={startCompose} />;
  }

  return (
    <AppShell
      actions={
        view === "running" ? (
          <div className="flex items-center gap-2">
            <LiveBadge />
            <Button variant="ghost" size="sm" onClick={startCompose} className="hidden sm:inline-flex">
              New analysis
            </Button>
          </div>
        ) : null
      }
    >
      {view === "compose" ? <IdeaForm onSubmit={run} busy={inFlight.current} /> : null}
      {view === "running" ? <AnalysisTheater /> : null}
    </AppShell>
  );
}
