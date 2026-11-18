import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  FileText,
  Info,
  LayoutGrid,
  Lightbulb,
  Share2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { encodeReportLink } from "../../lib/reportLink";
import {
  collectAllCitations,
  computeEvidenceScore,
  computeInsightSparkline,
  computeReportStats,
  dedupeCitations,
  formatIdeaTitle,
  type VerdictTone,
} from "../../lib/reportStats";
import type { FrameworkKey, SavedProject } from "../../types/groundly";
import { CompareModal } from "./CompareModal";
import {
  FrameworkDiagramBody,
  TamConcentricDiagram,
  renderTextWithInlineCitations,
} from "./FrameworkDiagrams";
import {
  BUSINESS_METRIC_CARDS,
  FRAMEWORK_LABELS,
  FRAMEWORK_NAV_ITEMS,
} from "./frameworkMeta";
import { MethodologyModal } from "./MethodologyModal";
import { ReportRightRail } from "./ReportRightRail";

type FrameworkSubTab = "summary" | "evidence" | "assumptions" | "actions";

interface ReportViewProps {
  project: SavedProject;
  projects: SavedProject[];
  onStartNewAnalysis: () => void;
}

const TONE_HEX: Record<VerdictTone, string> = {
  teal: "#22f59d",
  amber: "#ffc142",
  red: "#f05252",
};

function MiniSparkline({
  data,
  color,
}: {
  data: { v: number }[] | null;
  color: string;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.v), 1);
  const min = Math.min(...data.map((d) => d.v), 0);
  const range = Math.max(1, max - min);
  const w = 160;
  const h = 32;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 5 - ((d.v - min) / range) * (h - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M ${pts.join(" L ")}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={areaPath} fill={color} fillOpacity={0.16} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConfidenceRing({ pct, tone }: { pct: number; tone: VerdictTone }) {
  const color = TONE_HEX[tone];
  const size = 132;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circumference;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <defs>
          <filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,176,235,0.14)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          filter="url(#ring-glow)"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-extrabold text-white tabular-nums">
          {pct}%
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Confidence
        </span>
      </div>
    </div>
  );
}

export default function ReportView({
  project,
  projects,
  onStartNewAnalysis,
}: ReportViewProps) {
  const { idea, report } = project;
  const [activeFramework, setActiveFramework] = useState<"overview" | FrameworkKey>(
    "overview",
  );
  const [subTab, setSubTab] = useState<FrameworkSubTab>("summary");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [methodologyFw, setMethodologyFw] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");
  const [highlightedCitation, setHighlightedCitation] = useState<{
    index: number;
    framework?: string;
  } | null>(null);

  const stats = useMemo(() => computeReportStats(report), [report]);
  const allCitations = useMemo(() => collectAllCitations(report), [report]);
  // unify/2c-claim-quality: overall "X of Y facts supported" across
  // every framework's verification, for the report header.
  const overallFactCounts = useMemo(() => {
    const entries = Object.values(report.verification || {});
    return entries.reduce(
      (acc, v) => ({
        total: acc.total + (v.facts_total ?? 0),
        supported: acc.supported + (v.facts_supported ?? 0),
      }),
      { total: 0, supported: 0 },
    );
  }, [report.verification]);

  const title = project.title || formatIdeaTitle(idea);
  const dateLabel = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isOverview = activeFramework === "overview";
  const activeResult = !isOverview ? report.results?.[activeFramework] : undefined;
  const activeVerification = !isOverview
    ? report.verification?.[activeFramework]
    : undefined;
  const tamResult = report.results?.tam;

  const railCitations = isOverview
    ? allCitations
    : dedupeCitations(activeResult?.citations).map((c) => ({
        ...c,
        framework: activeFramework,
      }));

  function handleSelectFramework(key: "overview" | FrameworkKey) {
    setActiveFramework(key);
    setSubTab("summary");
    setPanelCollapsed(false);
  }

  function handleSelectCitation(citationIndex: number, frameworkKey?: string) {
    setHighlightedCitation({ index: citationIndex, framework: frameworkKey });
    const targetId = `citation-${frameworkKey || "all"}-${citationIndex}`;
    const el =
      document.getElementById(targetId) ||
      document.getElementById(`citation-all-${citationIndex}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function handleShare() {
    const url = await encodeReportLink({ idea, report });
    if (!url) {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 2600);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
    } catch {
      window.history.replaceState(null, "", url);
      setShareState("copied");
    }
    setTimeout(() => setShareState("idle"), 2600);
  }

  const [pdfState, setPdfState] = useState<"idle" | "generating" | "error">("idle");

  async function handleExportPdf() {
    setPdfState("generating");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportPdfDocument } = await import("../../lib/reportPdfDocument.jsx");
      const blob = await pdf(
        <ReportPdfDocument
          report={report}
          idea={idea}
          title={title}
          today={dateLabel}
          frameworkOrder={FRAMEWORK_NAV_ITEMS}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const slug =
        (idea || title || "groundly-analysis")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "groundly-analysis";
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-groundly-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfState("idle");
    } catch (err) {
      console.error("handleExportPdf: failed to generate PDF", err);
      setPdfState("error");
      setTimeout(() => setPdfState("idle"), 2500);
    }
  }

  const toneColor = TONE_HEX[stats.tone];
  const VerdictIcon =
    stats.tone === "red"
      ? ShieldAlert
      : stats.tone === "amber"
        ? AlertTriangle
        : ShieldCheck;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Report Action Header */}
      <header className="mb-6 flex flex-col gap-4 border-b border-slate-800/80 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={onStartNewAnalysis}
              className="no-print inline-flex items-center gap-1 font-medium text-slate-300 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              New Analysis
            </button>
            <span aria-hidden="true">·</span>
            <span>{dateLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{project.versionLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {allCitations.length} {allCitations.length === 1 ? "source" : "sources"}
            </span>
            {overallFactCounts.total > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums" title="Facts supported across all frameworks, per the real claim verifier">
                  {overallFactCounts.supported} of {overallFactCounts.total} facts supported
                </span>
              </>
            )}
            {report.geography && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-400" title={report.geography_defaulted ? "No geography was entered -- this is the server's default." : undefined}>
                  {report.geography}
                  {report.geography_defaulted ? " (default)" : ""}
                </span>
              </>
            )}
            {report.directory_status && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-mono ${
                    report.directory_status === "found"
                      ? "text-[#22f59d]"
                      : report.directory_status === "sector_context"
                        ? "text-[#60a5fa]"
                        : "text-[#ffc142]"
                  }`}
                >
                  {report.directory_status === "found"
                    ? `Directory: ${report.directory_matches ?? 1} exact match`
                    : report.directory_status === "sector_context"
                      ? `Directory: Trade name unlisted · ${report.directory_total_sector ?? report.directory_matches ?? 0} sector peers`
                      : "Directory: Not listed in Mississauga Open Data"}
                </span>
              </>
            )}
            {report.rag_status && report.rag_status !== "grounded" && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#ffc142]">
                  {report.rag_status === "search_text_only" ? "Partial grounding" : "Retrieval unavailable"}
                </span>
              </>
            )}
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{idea}</p>
        </div>

        <div className="no-print flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={handleShare}
            className="surface-subpanel inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-[#4a8fff] hover:text-white whitespace-nowrap shrink-0"
          >
            {shareState === "copied" ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#22f59d]" />
                Link Copied
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                Share Report
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={pdfState === "generating"}
            className="btn-primary-glow inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {pdfState === "generating"
              ? "Generating…"
              : pdfState === "error"
                ? "Couldn't generate PDF"
                : "Export PDF"}
          </button>
        </div>
      </header>

      {/* 3-Column Report Workspace: Left Framework Rail + Center Canvas + Right Utility Rail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Framework Segments Rail */}
        <nav
          aria-label="Report frameworks"
          className="no-print lg:col-span-3 xl:col-span-2"
        >
          <div className="surface-panel rounded-2xl p-2.5 lg:sticky lg:top-20">
            <p className="px-2.5 pb-2 pt-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Frameworks
            </p>
            <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              <button
                type="button"
                onClick={() => handleSelectFramework("overview")}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isOverview
                    ? "border border-[#4a8fff]/55 bg-[#4a8fff]/18 text-white shadow-[0_0_18px_-8px_rgba(74,143,255,0.6)]"
                    : "border border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5 text-[#60a5fa]" />
                  Overview
                </span>
                <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                  {stats.totalFrameworks}
                </span>
              </button>

              {FRAMEWORK_NAV_ITEMS.map((item) => {
                const active = activeFramework === item.key;
                const isVerified = report.verification?.[item.key]?.verified;
                const citCount =
                  report.results?.[item.key]?.citations?.length || 0;
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      handleSelectFramework(item.key as FrameworkKey)
                    }
                    className={`flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-left text-[11.5px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? "border border-[#4a8fff]/55 bg-[#4a8fff]/18 text-white shadow-[0_0_18px_-8px_rgba(74,143,255,0.6)]"
                        : "border border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <NavIcon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: active ? "#60a5fa" : item.color }}
                      />
                      <span className="truncate">{item.shortLabel}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 pl-1">
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {citCount}
                      </span>
                      {isVerified ? (
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-[#22f59d]"
                          aria-label="Verified"
                        />
                      ) : (
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-[#ffc142]"
                          aria-label="Needs sourcing"
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Center Main Canvas */}
        <main className="min-w-0 space-y-5 lg:col-span-9 xl:col-span-7">
          {isOverview ? (
            <>
              {/* Hero Verdict Banner matching report-ux-mock.png */}
              <section
                className="surface-panel relative overflow-hidden rounded-2xl p-6"
                style={{
                  borderColor: `${toneColor}55`,
                  background: `linear-gradient(125deg, ${toneColor}16 0%, rgba(11, 20, 44, 0.92) 48%, rgba(6, 11, 26, 0.98) 100%)`,
                }}
                data-testid="verdict-banner"
              >
                {/* Subtle Constellation Mesh SVG Backdrop */}
                <svg
                  viewBox="0 0 400 140"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 20 110 L 95 45 L 185 88 L 270 30 L 365 78"
                    fill="none"
                    stroke={toneColor}
                    strokeWidth="0.9"
                    strokeDasharray="3 4"
                  />
                  {[
                    [95, 45],
                    [185, 88],
                    [270, 30],
                    [365, 78],
                  ].map(([cx, cy], idx) => (
                    <circle key={idx} cx={cx} cy={cy} r="2.2" fill={toneColor} />
                  ))}
                </svg>

                <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: `${toneColor}22`,
                        color: toneColor,
                        border: `1px solid ${toneColor}55`,
                        boxShadow: `0 0 28px -8px ${toneColor}`,
                      }}
                    >
                      <VerdictIcon className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-300">
                        <span>Overall Strategic Verdict</span>
                        <span aria-hidden="true">·</span>
                        <span style={{ color: toneColor }}>
                          {stats.verdictShort}
                        </span>
                      </div>
                      <h2
                        className="mt-1 font-display text-2xl font-extrabold uppercase tracking-tight md:text-3xl"
                        style={{ color: toneColor }}
                      >
                        {stats.verdict}
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-200">
                        {stats.verdictSub}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 self-start md:self-center">
                    <ConfidenceRing
                      pct={stats.confidencePct}
                      tone={stats.tone}
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#4a8fff]/35 bg-[#0f1d3e] text-[#60a5fa]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="text-xs text-slate-300">
                        <p className="text-[11px] text-slate-400">Based on</p>
                        <p className="font-display text-sm font-bold text-white tabular-nums">
                          {allCitations.length} grounded {allCitations.length === 1 ? "source" : "sources"}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-[#22f59d] tabular-nums">
                          {stats.verifiedCount}/{stats.totalFrameworks} frameworks
                          {stats.avgSimilarity != null && ` · ${stats.avgSimilarity}% match`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 5 Business Insight Cards in 1 cohesive horizontal strip matching report-ux-mock.png */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-300">
                    Key Decision Signals
                  </h3>
                  <span className="font-mono text-[11px] text-slate-500">
                    Evidence-weighted summary · Click to drill down
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {BUSINESS_METRIC_CARDS.map((card) => {
                    const metric = report.business_metrics?.[card.key];
                    const score = computeEvidenceScore(metric, report);
                    const sparkData = computeInsightSparkline(metric, report);
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={card.key}
                        className="surface-panel surface-interactive flex flex-col justify-between rounded-2xl p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: `${card.accent}22`,
                                border: `1px solid ${card.accent}44`,
                                color: card.accent,
                              }}
                            >
                              <CardIcon className="h-3.5 w-3.5" />
                            </div>
                            <p className="text-[11px] font-medium leading-tight text-slate-400">
                              {card.label}
                            </p>
                          </div>
                          <p className="mt-2 font-display text-[13px] font-extrabold leading-snug text-white">
                            {metric?.label || "Insufficient data"}
                          </p>

                          <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-400">
                            {metric?.rationale
                              ? renderTextWithInlineCitations(
                                  metric.rationale,
                                  handleSelectCitation,
                                  metric.source_framework,
                                )
                              : "No verified claim synthesized."}
                          </p>
                        </div>

                        <div className="mt-2.5">
                          <div className="relative">
                            <MiniSparkline
                              data={sparkData}
                              color={card.accent}
                            />
                            {score != null && (
                              <span
                                className="mt-1 inline-block font-mono text-[10px] font-bold tabular-nums"
                                style={{ color: card.accent }}
                              >
                                {score.toFixed(1)}/10 evidence
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-slate-800/80 pt-2">
                            <span className="truncate font-mono text-[10px] text-slate-500">
                              {FRAMEWORK_NAV_ITEMS.find(
                                (fw) => fw.key === card.targetFramework,
                              )?.shortLabel || FRAMEWORK_LABELS[card.targetFramework]}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectFramework(
                                  card.targetFramework as FrameworkKey,
                                )
                              }
                              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-[#60a5fa] transition-colors hover:text-white"
                            >
                              Inspect
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Featured TAM SAM SOM Panel right on Overview matching report-ux-mock.png */}
              {tamResult?.market_sizing && (
                <section className="surface-panel rounded-2xl p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                    <div>
                      <h3 className="font-display text-base font-bold text-white">
                        TAM SAM SOM Market Sizing
                      </h3>
                      <p className="text-xs text-slate-400">
                        Grounded addressable, serviceable, and 3-year obtainable opportunity for {title}.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMethodologyFw("tam")}
                        className="surface-subpanel inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:border-[#4a8fff] hover:text-white"
                      >
                        <Info className="h-3.5 w-3.5" />
                        Methodology
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectFramework("tam")}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#4a8fff]/18 px-3 py-1.5 text-[11px] font-semibold text-[#93c5fd] hover:bg-[#4a8fff]/30 hover:text-white"
                      >
                        Full Breakdown
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <TamConcentricDiagram
                    marketSizing={tamResult.market_sizing}
                    result={tamResult}
                    onSelectCitation={handleSelectCitation}
                  />
                </section>
              )}

              {/* 10-Framework Explorer Matrix */}
              <section className="surface-panel rounded-2xl p-5">
                <div className="mb-3.5 flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-white">
                    All 10 Strategic Frameworks
                  </h3>
                  <span className="text-xs text-slate-400">
                    Select any framework to open diagrams & sub-tabs
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {FRAMEWORK_NAV_ITEMS.map((item) => {
                    const fwResult = report.results?.[item.key];
                    const verified = report.verification?.[item.key]?.verified;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          handleSelectFramework(item.key as FrameworkKey)
                        }
                        className="surface-subpanel surface-interactive flex items-start justify-between gap-3 rounded-xl p-3.5 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${item.color}20` }}
                            >
                              <Icon
                                className="h-3.5 w-3.5"
                                style={{ color: item.color }}
                              />
                            </span>
                            <span className="font-display text-sm font-semibold text-white">
                              {item.label}
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">
                            {fwResult?.text || "Analysis ready to inspect."}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-[11px] font-semibold ${
                            verified ? "text-[#22f59d]" : "text-[#ffc142]"
                          }`}
                        >
                          {verified ? "Verified" : "Review"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            /* Individual Framework Panel with Summary / Evidence / Assumptions / Actions Tabs */
            activeResult && (
              <section
                className="surface-panel rounded-2xl p-6"
                data-testid={`framework-panel-${activeFramework}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                      Strategic Framework · {title}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-extrabold text-white">
                      {FRAMEWORK_LABELS[activeFramework] || activeFramework}
                    </h2>
                  </div>

                  <div className="no-print flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{
                        color: activeVerification?.verified
                          ? "#22f59d"
                          : "#ffc142",
                      }}
                    >
                      {activeVerification?.verified ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {activeVerification?.verified ? "Verified" : "Needs Sourcing"}
                    </span>
                    {typeof activeVerification?.facts_total === "number" &&
                      activeVerification.facts_total > 0 && (
                        <span className="font-mono text-xs text-slate-400 tabular-nums">
                          {activeVerification.facts_supported} of{" "}
                          {activeVerification.facts_total} facts supported
                        </span>
                      )}

                    <button
                      type="button"
                      onClick={() => setMethodologyFw(activeFramework)}
                      className="surface-subpanel inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-[#4a8fff] hover:text-white"
                    >
                      <Info className="h-3.5 w-3.5" />
                      Methodology
                    </button>

                    <button
                      type="button"
                      onClick={() => setPanelCollapsed((c) => !c)}
                      aria-label={
                        panelCollapsed ? "Expand framework" : "Collapse framework"
                      }
                      className="surface-subpanel inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-white"
                    >
                      {panelCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {!panelCollapsed && (
                  <>
                    {/* Sub-Tabs: Summary / Evidence / Assumptions / Actions.
                        Assumptions/actions are real, per-framework LLM
                        output now (agents/rag_pipeline.py's
                        ASSUMPTIONS_ACTIONS_SUFFIX) -- unlike the AI Studio
                        original, there is no generic-bullet fallback: an
                        empty list renders an honest "none surfaced"
                        state, never a canned placeholder. */}
                    <div
                      role="tablist"
                      aria-label="Framework views"
                      className="surface-subpanel no-print mt-4 mb-5 inline-flex flex-wrap gap-1 rounded-xl p-1"
                    >
                      {(
                        [
                          { id: "summary", label: "Summary", Icon: LayoutGrid },
                          { id: "evidence", label: "Evidence", Icon: FileText },
                          { id: "assumptions", label: "Assumptions", Icon: Lightbulb },
                          { id: "actions", label: "Actions", Icon: ClipboardCheck },
                        ] as const
                      ).map((tab) => {
                        const isActive = subTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            type="button"
                            onClick={() => setSubTab(tab.id)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              isActive
                                ? "btn-primary-glow text-white"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            <tab.Icon className="h-3.5 w-3.5" />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {subTab === "summary" && (
                      <div className="space-y-6">
                        <p className="text-sm leading-relaxed text-slate-200">
                          {renderTextWithInlineCitations(
                            activeResult.text,
                            handleSelectCitation,
                            activeFramework,
                          )}
                        </p>
                        <FrameworkDiagramBody
                          frameworkKey={activeFramework}
                          result={activeResult}
                          onSelectCitation={handleSelectCitation}
                        />
                      </div>
                    )}

                    {subTab === "evidence" && (
                      <div className="space-y-4">
                        <h3 className="font-display text-sm font-bold text-white">
                          Grounded Source Evidence (
                          {activeResult.citations?.length || 0})
                        </h3>
                        {(!activeResult.citations ||
                          activeResult.citations.length === 0) && (
                          <p className="text-xs text-slate-400">
                            No external citations were matched for this section.
                          </p>
                        )}
                        <div className="space-y-2.5">
                          {activeResult.citations?.map((c, idx) => (
                            <div
                              key={idx}
                              className="surface-subpanel rounded-xl p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className="font-mono text-xs text-[#60a5fa]">
                                    [{c.index}]
                                  </span>
                                  <p className="mt-0.5 text-sm font-semibold text-white">
                                    {c.source_title}
                                  </p>
                                </div>
                                {typeof c.similarity === "number" && (
                                  <span className="font-mono text-xs font-bold text-[#22f59d] tabular-nums">
                                    {Math.round(c.similarity * 100)}% match
                                  </span>
                                )}
                              </div>
                              {c.snippet && (
                                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                                  “{c.snippet}”
                                </p>
                              )}
                              <a
                                href={c.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block text-xs text-[#60a5fa] hover:underline"
                              >
                                {c.source_url}
                              </a>
                            </div>
                          ))}
                        </div>
                        {activeVerification?.unsupported_claims &&
                          activeVerification.unsupported_claims.length > 0 && (
                            <div className="rounded-xl border border-[#ffc142]/40 bg-[#ffc142]/10 p-4">
                              <p className="flex items-center gap-2 text-xs font-bold text-[#ffc142]">
                                <AlertTriangle className="h-4 w-4" />
                                Verification Flags
                              </p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-200">
                                {activeVerification.unsupported_claims.map(
                                  (claim, i) => (
                                    <li key={i}>{claim}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        {activeVerification?.claims &&
                          activeVerification.claims.length > 0 && (
                            <div className="surface-subpanel rounded-xl p-4">
                              <p className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                <ShieldCheck className="h-4 w-4" />
                                Per-Claim Verification (
                                {activeVerification.claims.length})
                              </p>
                              <ul className="mt-2 space-y-2">
                                {activeVerification.claims.map(
                                  (claim, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2 text-xs"
                                    >
                                      {claim.verdict === "supported" ? (
                                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22f59d]" />
                                      ) : (
                                        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ffc142]" />
                                      )}
                                      <span className="text-slate-300">
                                        {claim.claim_type === "analysis" && (
                                          <span className="mr-1.5 rounded border border-slate-600 px-1 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-500">
                                            Analysis
                                          </span>
                                        )}
                                        <span className="text-slate-100">
                                          {claim.text}
                                        </span>{" "}
                                        <span className="text-slate-500">
                                          — {claim.reason}
                                        </span>
                                      </span>
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    )}

                    {subTab === "assumptions" && (
                      <div className="space-y-3">
                        <h3 className="font-display text-sm font-bold text-white">
                          Assumptions to Validate
                        </h3>
                        {activeResult.assumptions && activeResult.assumptions.length > 0 ? (
                          <ul className="space-y-2.5">
                            {activeResult.assumptions.map((item, i) => (
                              <li
                                key={i}
                                className="surface-subpanel flex items-start gap-3 rounded-xl p-3.5 text-xs leading-relaxed text-slate-200"
                              >
                                <span className="font-mono font-bold text-[#ffc142]">A{i + 1}</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400">
                            No assumptions were surfaced for this section.
                          </p>
                        )}
                      </div>
                    )}

                    {subTab === "actions" && (
                      <div className="space-y-3">
                        <h3 className="font-display text-sm font-bold text-white">
                          Recommended Next Steps
                        </h3>
                        {activeResult.actions && activeResult.actions.length > 0 ? (
                          <ul className="space-y-2.5">
                            {activeResult.actions.map((step, i) => (
                              <li
                                key={i}
                                className="surface-subpanel flex items-start gap-3 rounded-xl p-3.5 text-xs leading-relaxed text-slate-200"
                              >
                                <span className="font-mono font-bold text-[#22f59d]">0{i + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-400">
                            No action items were surfaced for this section.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            )
          )}
        </main>

        {/* Right Utility Rail */}
        <div className="no-print lg:col-span-12 xl:col-span-3">
          <ReportRightRail
            idea={idea}
            report={report}
            citations={railCitations}
            highlightedCitation={highlightedCitation}
            onOpenCompare={() => setShowCompare(true)}
            compareAvailable={projects.length >= 2}
          />
        </div>
      </div>

      {methodologyFw && (
        <MethodologyModal
          frameworkKey={methodologyFw}
          onClose={() => setMethodologyFw(null)}
          providerUsed={report.provider_used}
        />
      )}

      {showCompare && (
        <CompareModal
          currentProject={project}
          projects={projects}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
