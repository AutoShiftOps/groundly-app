import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Box,
  ChevronLeft,
  ChevronRight,
  Globe,
  Lightbulb,
  Lock,
  Search,
  Sparkles,
} from "lucide-react";
import { STAGE_DEFINITIONS } from "../../lib/reportStats";
import type { StageStatus } from "../../types/groundly";
import TrainScene3D from "../three/TrainScene3D";

interface AnalyzeScreenProps {
  mode: "idea" | "business";
  setMode: (val: "idea" | "business") => void;
  businessName: string;
  setBusinessName: (val: string) => void;
  dataSourceUrl: string;
  setDataSourceUrl: (val: string) => void;
  idea: string;
  setIdea: (val: string) => void;
  industry: string;
  setIndustry: (val: string) => void;
  geography: string;
  setGeography: (val: string) => void;
  isRunning: boolean;
  progress: number;
  activeStageIndex: number;
  // One entry per stage, from real stream events (or the timer fallback).
  stageStatuses: StageStatus[];
  stageLabels: string[];
  error: string | null;
  onLaunch: () => void;
}

const PRO_TIPS = [
  "TAM measures total addressable demand; SOM measures what your initial distribution wedge can capture in 3 years.",
  "Every factual claim in your Groundly report links to a retrieved source or is explicitly flagged for founder validation.",
  "A specific buyer persona and painful trigger event beat broad horizontal positioning at seed stage.",
  "Porter's Five Forces highlights margin compression risks before you commit engineering cycles.",
];

// Sample ideas just fill the textarea with real prose for the user to
// edit and submit -- they never load a canned/pre-baked report. (The
// AI-Studio original paired these same three names with fully fabricated
// demo reports in data/demoReports.ts, served instead of a real analysis
// whenever the typed idea matched; that trapdoor is removed entirely.)
const SAMPLE_IDEAS = [
  "Halo Ledger — a financial OS that forecasts founder runway from the books.",
  "NightShift — chef-grade meal kits for people who work 7pm to 7am.",
  "PeerCharge — a neighborhood network for sharing home EV chargers.",
];

export function AnalyzeScreen({
  mode,
  setMode,
  businessName,
  setBusinessName,
  dataSourceUrl,
  setDataSourceUrl,
  idea,
  setIdea,
  industry,
  setIndustry,
  geography,
  setGeography,
  isRunning,
  progress,
  activeStageIndex,
  stageStatuses,
  stageLabels,
  error,
  onLaunch,
}: AnalyzeScreenProps) {
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [wireframeMode, setWireframeMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("wireframe");
  });

  useEffect(() => {
    if (isRunning) {
      setSelectedStage(null);
    }
  }, [isRunning]);

  const trimmedLen = idea.trim().length;
  const canLaunch =
    (mode === "business" ? businessName.trim().length >= 2 : trimmedLen >= 12) &&
    !isRunning;
  const pct = Math.min(100, Math.round(progress));

  if (isRunning) {
    const activeIdx = Math.max(0, Math.min(4, activeStageIndex));
    const activeStage = STAGE_DEFINITIONS[activeIdx];
    const activeLabel = stageLabels[activeIdx] ?? activeStage?.label;

    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#818cf8]">
              <Sparkles className="h-3.5 w-3.5 text-[#60a5fa]" />
              AI Business Analyst
            </p>
            <h1
              className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl"
              style={{ textWrap: "balance" }}
            >
              {mode === "business" && businessName.trim() ? (
                <>
                  Analyzing{" "}
                  <span className="idea-gradient">{businessName.trim()}</span>
                </>
              ) : (
                <>
                  Analyzing your{" "}
                  <span className="idea-gradient">business idea</span>
                </>
              )}
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
              Our AI is working its magic ·{" "}
              <span className="text-slate-300">
                0{activeIdx + 1} {activeLabel}:
              </span>{" "}
              {activeStage?.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setWireframeMode((w) => !w)}
              aria-pressed={wireframeMode}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                wireframeMode
                  ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-200"
                  : "surface-panel border-slate-700/70 text-slate-300 hover:border-slate-600 hover:text-white"
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              <span>Wireframe Mode</span>
            </button>
            <div className="surface-panel inline-flex items-center gap-2 rounded-xl border border-slate-700/70 px-3 py-1.5 text-xs font-medium text-slate-200">
              <Activity className="h-3.5 w-3.5 text-[#22f59d]" />
              <span>Live analysis</span>
            </div>
          </div>
        </div>

        {/* Full-Width 3D Bullet Express Train Theater */}
        <TrainScene3D
          activeStageIndex={activeStageIndex}
          progress={progress}
          stageStatuses={stageStatuses}
          stageLabels={stageLabels}
          isRunning
          selectedStageIndex={selectedStage}
          onSelectStage={setSelectedStage}
          heightClass="h-[290px] md:h-[326px]"
          wireframeMode={wireframeMode}
          onToggleWireframeMode={() => setWireframeMode((w) => !w)}
        />

        {/* Centered Overall Progress Bar matching mockup */}
        <div className="mt-0.5 flex flex-col items-center text-center">
          <p className="text-[11px] font-medium text-slate-400">Overall progress</p>
          <p className="mt-0.5 bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] bg-clip-text font-display text-2xl font-extrabold leading-none text-transparent tabular-nums">
            {pct}%
          </p>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall analysis progress"
            className="mt-1.5 h-2 w-full max-w-md overflow-hidden rounded-full bg-[#131d36]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#38bdf8] via-[#6366f1] to-[#a855f7] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Sit tight — great insights take time.
          </p>
        </div>

        {/* Live Status Strip. Previously showed 3 cards with invented
            "sources scanned" / "markets analyzed" / "data points
            processed" counters -- numbers computed purely from a linear
            formula on the loading-bar percentage, with zero connection to
            anything the backend had actually done. There is no real
            partial-progress signal available client-side during a run
            (the backend returns the full report in one response), so
            rather than fabricate one, these now show only what's actually
            true: the real stage definition, the real user-entered
            geography, and the real, fixed framework count. */}
        <div className="mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="surface-panel flex flex-col justify-between rounded-2xl p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#4a8fff]/40 bg-[#4a8fff]/15 text-[#60a5fa]">
                <Search className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-extrabold leading-snug text-white">
                  {activeLabel}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-300">
                  {activeStage?.subtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="surface-panel flex flex-col justify-between rounded-2xl p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#14d8a3]/40 bg-[#14d8a3]/15 text-[#22f59d]">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-extrabold leading-snug text-white">
                  Target geography
                </p>
                <p className="mt-0.5 font-mono text-[11px] leading-snug text-slate-300">
                  {geography.trim() || "Not specified"}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
              <span>10 Strategic Frameworks</span>
              <span className="font-mono text-[#14d8a3]">Active</span>
            </div>
          </div>

          <div className="surface-panel flex flex-col justify-between rounded-2xl p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#818cf8]/45 bg-[#6366f1]/20 text-[#a5b4fc]">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#93c5fd]">
                  Analyst Pro Tip
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-200">
                  {PRO_TIPS[tipIndex]}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
              <button
                type="button"
                aria-label="Previous analyst note"
                onClick={() =>
                  setTipIndex((i) => (i - 1 + PRO_TIPS.length) % PRO_TIPS.length)
                }
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-1.5">
                {PRO_TIPS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`View tip ${idx + 1}`}
                    onClick={() => setTipIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      tipIndex === idx ? "w-4 bg-[#60a5fa]" : "w-1.5 bg-slate-600"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next analyst note"
                onClick={() => setTipIndex((i) => (i + 1) % PRO_TIPS.length)}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2.5 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Lock className="h-3 w-3" />
          Analysis runs privately and stores directly in your local workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Compose Workbench */}
        <section className="lg:col-span-5">
          <p className="font-mono text-xs uppercase tracking-wider text-[#60a5fa]">
            Grounded Validation Workspace
          </p>
          <h1
            className="mt-1.5 font-display text-3xl font-extrabold leading-[1.12] tracking-tight text-white md:text-4xl"
            style={{ textWrap: "balance" }}
          >
            {mode === "business" ? (
              <>
                Audit an existing <span className="idea-gradient">business</span>
              </>
            ) : (
              <>
                Describe your business <span className="idea-gradient">idea</span>
              </>
            )}
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
            Enter one or two sentences. Groundly dispatches a 5-stage analysis
            train across PESTEL, Porter&apos;s Five Forces, SWOT, TAM/SAM/SOM,
            STP, BCG, Ansoff, Value Chain, BMC, and Balanced Scorecard.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canLaunch) onLaunch();
            }}
            className="surface-panel mt-5 rounded-2xl p-5"
          >
            <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-[#050a18] p-1">
              <button
                type="button"
                onClick={() => setMode("idea")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === "idea"
                    ? "bg-[#4a8fff] text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                New Business Idea
              </button>
              <button
                type="button"
                onClick={() => setMode("business")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === "business"
                    ? "bg-[#4a8fff] text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Existing Business
              </button>
            </div>

            {mode === "business" && (
              <div className="mb-4">
                <label
                  htmlFor="business-name-input"
                  className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-300"
                >
                  Existing Business Name
                </label>
                <input
                  id="business-name-input"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Port Credit Roast or Credit Valley Physio"
                  className="mt-2 w-full rounded-xl border border-slate-700/80 bg-[#050a18] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-[#4a8fff] focus:outline-none"
                />
              </div>
            )}

            <label
              htmlFor="idea-textarea"
              className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-300"
            >
              {mode === "business" ? "Additional Context (Optional)" : "Venture Concept"}
            </label>
            <textarea
              id="idea-textarea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Describe the product, target customer, pricing wedge, and why now…"
              className="mt-2 w-full resize-y rounded-xl border border-slate-700/80 bg-[#050a18] p-3.5 text-sm leading-relaxed text-white placeholder:text-slate-500 focus:border-[#4a8fff] focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {mode === "business"
                  ? "Enter an existing business name (min 2 chars)"
                  : "Minimum 12 characters to run validation"}
              </span>
              <span className="font-mono tabular-nums">{trimmedLen}/600</span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="industry-input"
                  className="block text-[11px] font-medium text-slate-400"
                >
                  Industry (Optional)
                </label>
                <input
                  id="industry-input"
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. FinTech SaaS"
                  className="mt-1 w-full rounded-lg border border-slate-700/80 bg-[#050a18] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#4a8fff] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="geography-input"
                  className="block text-[11px] font-medium text-slate-400"
                >
                  Target Geography (Optional)
                </label>
                <input
                  id="geography-input"
                  type="text"
                  value={geography}
                  onChange={(e) => setGeography(e.target.value)}
                  placeholder="e.g. Mississauga, ON"
                  className="mt-1 w-full rounded-lg border border-slate-700/80 bg-[#050a18] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#4a8fff] focus:outline-none"
                />
              </div>
            </div>

            {mode === "business" && (
              <div className="mt-3">
                <label
                  htmlFor="datasource-url-input"
                  className="block text-[11px] font-medium text-slate-400"
                >
                  Advanced: Business Directory Source URL (optional)
                </label>
                <input
                  id="datasource-url-input"
                  type="url"
                  value={dataSourceUrl}
                  onChange={(e) => setDataSourceUrl(e.target.value)}
                  placeholder="https://services6.arcgis.com/.../FeatureServer/0/query"
                  className="mt-1 w-full rounded-lg border border-slate-700/80 bg-[#050a18] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-[#4a8fff] focus:outline-none"
                />
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Only a real City of Mississauga or Esri ArcGIS open-data URL is accepted; anything
                  else is rejected before analysis runs. Leave blank to use the default directory.
                </p>
              </div>
            )}

            <div className="mt-4 border-t border-slate-800/80 pt-4">
              <p className="text-[11px] font-medium text-slate-400">
                Load a sample venture
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SAMPLE_IDEAS.map((sample) => {
                  const shortName = sample.split("—")[0]?.trim() || sample;
                  return (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setMode("idea");
                        setIdea(sample);
                      }}
                      className="surface-subpanel surface-interactive rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white"
                    >
                      {shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-[#f05252]/40 bg-[#f05252]/10 p-3 text-xs leading-relaxed text-[#fca5a5]"
              >
                {/429|rate.?limit/i.test(error)
                  ? "The analysis service is rate-limited right now. Wait a moment and retry."
                  : /503|unavailable/i.test(error)
                    ? "The analysis service is temporarily unavailable. Please retry in a few seconds."
                    : error.length > 220
                      ? `${error.slice(0, 217)}…`
                      : error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Outputs 10 verified frameworks
              </span>
              <button
                type="submit"
                disabled={!canLaunch}
                className="btn-primary-glow inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                Launch Analysis
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>

        {/* Right Interactive 3D Bullet Train Showcase */}
        <section className="lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-white">
                3D Validation Pipeline Preview
              </h2>
              <p className="text-xs text-slate-400">
                Drag to orbit · Click any train car to inspect stage role
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setWireframeMode((w) => !w)}
                aria-pressed={wireframeMode}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  wireframeMode
                    ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-200"
                    : "border-slate-700/70 bg-[#080f1f] text-slate-300 hover:border-[#4a8fff] hover:text-white"
                }`}
              >
                <Box className="h-3 w-3" />
                <span>Wireframe Mode</span>
              </button>
              <span className="font-mono text-[11px] text-[#60a5fa]">
                5 Stage Cars · Interactive WebGL
              </span>
            </div>
          </div>

          <TrainScene3D
            activeStageIndex={-1}
            progress={0}
            isRunning={false}
            selectedStageIndex={selectedStage}
            onSelectStage={(idx) =>
              setSelectedStage((prev) => (prev === idx ? null : idx))
            }
            heightClass="h-[360px] md:h-[440px]"
            wireframeMode={wireframeMode}
            onToggleWireframeMode={() => setWireframeMode((w) => !w)}
          />

          {/* Selected Stage Quick Brief */}
          <div className="surface-panel mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] text-[#60a5fa]">
                Stage 0{(selectedStage ?? 3) + 1} ·{" "}
                {STAGE_DEFINITIONS[selectedStage ?? 3].label}
                {selectedStage === null ? " · Showcase Glide" : " · Selected"}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {STAGE_DEFINITIONS[selectedStage ?? 3].subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedStage !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedStage(null)}
                  className="mr-1 rounded-md border border-slate-700/70 bg-[#080f1f] px-2.5 py-1 font-mono text-[11px] font-medium text-slate-300 transition-colors hover:border-[#4a8fff] hover:text-white"
                >
                  Glide
                </button>
              )}
              {STAGE_DEFINITIONS.map((st, idx) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() =>
                    setSelectedStage((prev) => (prev === idx ? null : idx))
                  }
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                    selectedStage === idx
                      ? "bg-[#4a8fff] text-white"
                      : "bg-[#080f1f] text-slate-400 hover:text-white"
                  }`}
                >
                  0{idx + 1}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
