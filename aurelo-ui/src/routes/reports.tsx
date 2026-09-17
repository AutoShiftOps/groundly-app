import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import ReportView from "@/components/report/ReportView";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/lib/analysis/store";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const idea = useAnalysis((s) => s.idea);
  const groundly = useAnalysis((s) => s.groundly);
  const projects = useAnalysis((s) => s.projects);
  const startCompose = useAnalysis((s) => s.startCompose);
  const navigate = useNavigate();
  const latestGroundly = groundly ?? projects[0]?.groundly ?? null;
  const latestIdea = groundly ? idea : projects[0]?.idea || "";

  function handleNav(label: string) {
    if (label === "Analyze") {
      startCompose();
      void navigate({ to: "/" });
      return;
    }
    const map: Record<string, string> = {
      Projects: "/projects",
      Insights: "/insights",
      Market: "/market",
      Reports: "/reports",
      Settings: "/settings",
    };
    if (map[label]) void navigate({ to: map[label] });
  }

  if (latestGroundly) {
    return (
      <ReportView
        report={latestGroundly}
        idea={latestIdea}
        onReset={() => {
          startCompose();
          void navigate({ to: "/" });
        }}
        onNavChange={handleNav}
        activeNav="Reports"
      />
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-medium tracking-tight">Reports</h1>
        <p className="mt-2 text-sm text-muted">Finished analyses open in the Groundly report view.</p>
        <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
          <FileText className="size-8 text-faint" />
          <p className="mt-4 text-lg font-medium">No report yet</p>
          <p className="mt-2 text-sm text-muted">Complete an analysis to generate a full framework report.</p>
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
      </div>
    </AppShell>
  );
}
