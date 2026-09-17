import { Activity, Lock, Sparkles } from "lucide-react";
import { AnalysisTrain } from "./analysis-train";
import { StatCards } from "./stat-cards";
import { useAnalysis } from "@/lib/analysis/store";

export function AnalysisTheater() {
  const progress = useAnalysis((s) => s.progress);
  const sources = useAnalysis((s) => s.sources);
  const dataPoints = useAnalysis((s) => s.dataPoints);
  const markets = useAnalysis((s) => s.markets);
  const tipIndex = useAnalysis((s) => s.tipIndex);
  const nextTip = useAnalysis((s) => s.nextTip);
  const prevTip = useAnalysis((s) => s.prevTip);
  const setTip = useAnalysis((s) => s.setTip);

  const pct = Math.round(progress);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative pt-2 md:pt-4">
        <Sparkles
          className="sparkle absolute left-[42%] top-2 hidden size-4 md:block"
          style={{ animationDelay: "0.2s" }}
        />
        <Sparkles
          className="sparkle absolute right-[18%] top-8 hidden size-5 text-cyan md:block"
          style={{ animationDelay: "0.9s" }}
        />
        <Sparkles
          className="sparkle absolute left-[28%] top-16 hidden size-3.5 text-magenta md:block"
          style={{ animationDelay: "1.4s" }}
        />

        <h1 className="max-w-2xl text-4xl font-medium leading-[1.08] tracking-tight text-fg md:text-[3.35rem]">
          Analyzing your
          <br />
          <span className="idea-gradient">business idea</span>
        </h1>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted md:text-[15px]">
          <Sparkles className="size-3.5 text-violet" />
          Our AI is working its magic
        </p>
      </div>

      <div className="mt-8 md:mt-12">
        <AnalysisTrain progress={progress} />
      </div>

      <div className="mx-auto mt-2 w-full max-w-md text-center">
        <div className="flex items-baseline justify-center gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">
            Overall progress
          </p>
          <p className="text-2xl font-semibold tabular-nums text-fg">{pct}%</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="progress-fill h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-faint">Sit tight — great insights take time.</p>
      </div>

      <div className="mt-8">
        <StatCards
          sources={sources}
          dataPoints={dataPoints}
          markets={markets}
          tipIndex={tipIndex}
          onPrevTip={prevTip}
          onNextTip={nextTip}
          onSetTip={setTip}
        />
      </div>

      <p className="mt-auto flex items-center justify-center gap-2 pt-6 text-xs text-faint">
        <Lock className="size-3" />
        Your data is encrypted and secure
      </p>
    </div>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-fg shadow-[0_0_0_1px_rgba(148,180,255,0.16)]">
      <Activity className="size-3.5 text-green" />
      Live analysis
      <span className="live-dot" />
    </span>
  );
}
