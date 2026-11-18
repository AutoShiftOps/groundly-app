import { useEffect } from "react";
import { BadgeCheck, Database, Info, Search, X } from "lucide-react";
import { FRAMEWORK_LABELS } from "./frameworkMeta";

export const FRAMEWORK_NOTES: Record<string, string> = {
  tam: "TAM, SAM, and SOM figures are only populated when grounded in retrieved sources; missing tiers remain unverified rather than estimated.",
  pestel: "Political, economic, social, technological, environmental, and legal factors are only populated when each claim resolves to a retrieved citation; categories with no supporting evidence are left empty rather than inferred.",
  swot: "Each strength, weakness, opportunity, and threat requires an attributable citation; unsupported assertions are flagged rather than presented as a plausible-sounding list.",
  porter: "Each of the Five Forces is populated only from findings explicitly tied to a retrieved source; a force with no cited evidence shows no fabricated pressure score.",
  stp: "Segmentation, Targeting, and Positioning categories are extracted strictly from cited market and competitor sources, not inferred demographic assumptions.",
  bcg: "BCG quadrant placement requires both a cited market growth rate and competitive share rationale.",
  ansoff: "Ansoff growth classification evaluates market maturity against product novelty strictly from extracted evidence.",
  value_chain: "Value Chain activities are populated only where a retrieved source directly supports that stage; uncited stages are left empty rather than filled with generic operations boilerplate.",
  bmc: "Each Business Model Canvas block requires a citation tying the claim to a retrieved source; blocks without supporting evidence are left empty instead of generic startup boilerplate.",
  balanced_scorecard: "Scorecard KPIs pair verified baseline metrics with realistic operational targets.",
};

export function MethodologyModal({
  frameworkKey,
  onClose,
}: {
  frameworkKey: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = FRAMEWORK_LABELS[frameworkKey] || frameworkKey.toUpperCase();
  const note = FRAMEWORK_NOTES[frameworkKey];

  const steps = [
    {
      Icon: Search,
      title: "01. Live Retrieval & Market Grounding",
      body: "Your business idea is decomposed by industry, buyer persona, and geography to query market reports, public filings, and benchmark studies.",
    },
    {
      Icon: Database,
      title: "02. Structured Framework Synthesis",
      body: "Findings are mapped into strict schema contracts for all 10 strategic frameworks. Factual statements attach [n] citation indices pointing to retrieved sources.",
    },
    {
      Icon: BadgeCheck,
      title: "03. Verification & Gap Flagging",
      body: "Each section passes a verification gate checking citation coverage. Unverified claims are surfaced explicitly in the Assumptions and Warnings tabs.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="methodology-title"
    >
      <div
        className="surface-panel max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Validation Methodology
            </p>
            <h2
              id="methodology-title"
              className="mt-0.5 font-display text-lg font-bold text-white"
            >
              {label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close methodology dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#080f1f] text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-slate-800/80 bg-[#080f1f] p-3.5"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[#60a5fa]">
                <s.Icon className="h-3.5 w-3.5" />
                {s.title}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {s.body}
              </p>
            </div>
          ))}

          {note && (
            <div className="rounded-xl border border-[#14d8a3]/30 bg-[#14d8a3]/10 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#14d8a3]">
                <Info className="h-3.5 w-3.5" />
                Framework Guardrail
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-200">
                {note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
