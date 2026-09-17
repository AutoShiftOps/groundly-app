import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { AnalysisTrain } from "./analysis-train";
import { Button } from "@/components/ui/button";
import { DEMO_IDEA } from "@/lib/analysis/demo";
import { cn } from "@/lib/utils";

const SAMPLES = [
  "NightShift — chef-grade meal kits for people who work 7pm to 7am.",
  "Halo Ledger — a financial OS that forecasts founder runway from the books.",
  "Lumen Desk — turn a one-line startup idea into a full market and GTM brief.",
  "PeerCharge — a neighborhood network for sharing home EV chargers.",
];

export function IdeaForm({
  onSubmit,
  busy,
}: {
  onSubmit: (idea: string) => void;
  busy?: boolean;
}) {
  const [idea, setIdea] = useState("");
  const trimmed = idea.trim();
  const ready = trimmed.length >= 12;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col py-4 md:py-6">
      <div className="mx-auto w-full max-w-3xl">
        <p className="rise-in flex items-center gap-2 text-sm text-muted">
          <Sparkles className="size-3.5 text-violet" />
          Aurelo · AI business analyst
        </p>
        <h1 className="rise-in mt-3 max-w-2xl text-[2.1rem] font-medium leading-[1.12] tracking-tight md:text-5xl">
          What’s the <span className="idea-gradient">business idea</span>
          <br />
          we should pressure-test?
        </h1>
        <p className="rise-in mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Drop one or two sentences. Groundly runs PESTEL, Porter, SWOT, TAM/SAM/SOM,
          STP, BCG, Ansoff, Value Chain, BMC and Balanced Scorecard — with citations,
          not guesses.
        </p>

        <label className="sr-only" htmlFor="idea">
          Business idea
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          maxLength={600}
          placeholder="Describe the product, who it’s for, and why now…"
          className={cn(
            "rise-in mt-8 w-full resize-none rounded-[22px] bg-elevated px-5 py-4 text-[15px] leading-relaxed text-fg",
            "shadow-[0_0_0_1px_rgba(148,180,255,0.16)] placeholder:text-faint",
            "outline-none transition-[box-shadow] duration-150",
            "focus:shadow-[0_0_0_1px_rgba(139,124,255,0.55),0_0_32px_rgba(139,124,255,0.18)]",
          )}
        />
        <div className="mt-3 flex items-center justify-between text-xs text-faint">
          <span>Stays on this device until you run it.</span>
          <span className="tabular-nums">{trimmed.length}/600</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setIdea(sample)}
              className="rounded-full bg-white/5 px-3 py-1.5 text-left text-xs text-muted shadow-[0_0_0_1px_rgba(148,180,255,0.12)] hover:bg-white/10 hover:text-fg"
            >
              {sample.split("—")[0]?.trim()}
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            variant="glow"
            size="lg"
            disabled={!ready || busy}
            onClick={() => onSubmit(trimmed)}
          >
            Analyze idea
            <ArrowRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => onSubmit(DEMO_IDEA)}
          >
            Run the live demo
          </Button>
        </div>
      </div>

      <div className="mt-10 opacity-90">
        <AnalysisTrain progress={-1} compact />
      </div>
    </div>
  );
}
