import { ArrowRight, ShieldAlert, Sparkles, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisReport, Verdict } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

const VERDICT_COPY: Record<Verdict, { label: string; accent: string }> = {
  strong: { label: "Strong", accent: "#4ade80" },
  promising: { label: "Promising", accent: "#67e8f9" },
  risky: { label: "Risky", accent: "#fbbf24" },
  weak: { label: "Weak", accent: "#f87171" },
};

export function ResultReport({
  idea,
  report,
  onNew,
}: {
  idea: string;
  report: AnalysisReport;
  onNew: () => void;
}) {
  const verdict = VERDICT_COPY[report.verdict];

  return (
    <div className="mx-auto w-full max-w-6xl pb-4">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="size-3.5 text-violet" />
            Brief ready
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight md:text-4xl">{report.tagline}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{idea}</p>
        </div>
        <div className="flex items-center gap-4">
          <ScoreRing score={report.score} accent={verdict.accent} label={verdict.label} />
          <Button variant="glow" onClick={onNew}>
            New analysis
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metric label="TAM" value={report.tam} note="Total addressable market" />
        <Metric label="SAM" value={report.sam} note="Serviceable available market" />
        <Metric label="SOM" value={report.som} note="Serviceable obtainable market" />
      </div>
      <p className="mt-3 text-sm text-faint">{report.tamNote}</p>

      <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {report.insights.map((insight) => (
          <article key={insight.title} className="glass-card rounded-[24px] p-5">
            <p className="text-[15px] font-semibold text-fg">{insight.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{insight.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <article className="glass-card rounded-[24px] p-5">
          <p className="text-sm font-medium text-muted">Market opportunity</p>
          <ul className="mt-4 space-y-3">
            {report.markets.map((m) => (
              <li key={m.code}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {m.code}
                    <span className="ml-2 font-normal text-muted">{m.name}</span>
                  </span>
                  <span className="tabular-nums text-cyan">{m.opportunity}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-deep to-violet"
                    style={{ width: `${m.opportunity}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <div className="flex flex-col gap-3">
          <article className="glass-card rounded-[24px] p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted">
              <TrendingUp className="size-4 text-green" />
              Strengths
            </p>
            <ul className="mt-3 space-y-2">
              {report.strengths.map((s) => (
                <li key={s} className="text-sm leading-relaxed text-fg">
                  {s}
                </li>
              ))}
            </ul>
          </article>
          <article className="glass-card rounded-[24px] p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-muted">
              <ShieldAlert className="size-4 text-amber" />
              Risks
            </p>
            <ul className="mt-3 space-y-2">
              {report.risks.map((s) => (
                <li key={s} className="text-sm leading-relaxed text-fg">
                  {s}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <article className="glass-card rounded-[24px] p-5">
          <p className="text-sm font-medium text-muted">Competitive set</p>
          <ul className="mt-4 space-y-4">
            {report.competitors.map((c) => (
              <li key={c.name}>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="mt-1 text-sm text-muted">{c.note}</p>
              </li>
            ))}
          </ul>
        </article>
        <article className="glass-card rounded-[24px] p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <Target className="size-4 text-violet" />
            Next moves
          </p>
          <ol className="mt-4 space-y-3">
            {report.nextSteps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/5 text-xs tabular-nums text-muted">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="glass-card rounded-[24px] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </article>
  );
}

function ScoreRing({
  score,
  accent,
  label,
}: {
  score: number;
  accent: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="score-ring grid size-16 place-items-center rounded-full p-[3px]"
        style={{
          ["--ring-accent" as string]: accent,
          ["--ring-pct" as string]: `${score}%`,
        }}
      >
        <span className="grid size-full place-items-center rounded-full bg-bg text-sm font-semibold tabular-nums">
          {score}
        </span>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-faint">Verdict</p>
        <p className={cn("text-lg font-semibold")} style={{ color: accent }}>
          {label}
        </p>
      </div>
    </div>
  );
}
