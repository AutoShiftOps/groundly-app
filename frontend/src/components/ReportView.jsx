// frontend/src/components/ReportView.jsx
//
// Full rebuild targeting report-ux-mock.jpg, re-aligned to the exact color
// palette used by HomeScreen.tsx / LoadingScreen.tsx (Figma export):
// bg #050c1a / #080f1e, blue #4a8fff, teal #2dd4bf, purple #7c3aed, amber #f59e0b.
// Uses lucide-react (already a confirmed dependency) instead of the custom
// Icons.jsx set, so there's one consistent icon language across the whole app.
//
// Data-binding is 100% derived from the real /api/analyze response shape:
//   { stage, results: { <fw>: { text, citations: [...] } },
//     verification: { <fw>: { verified, unsupported_claims } } }
// No fabricated numbers (no invented TAM/SAM/SOM dollar figures, no fake
// "61 sources" - every number shown is computed from report.results /
// report.verification).

import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp, FolderOpen, Lightbulb, BarChart2, FileText, Settings,
  ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Lock,
  Share2, Download, Sparkles, MessageSquare, GitCompare, Layers, ChevronLeft,
  Info, ChevronUp, ChevronDown, LayoutGrid,
  Landmark, Users, Cpu, Leaf, Scale, Zap, Target, Gift, Truck, Heart,
  DollarSign, Boxes, Handshake, Receipt,
  Globe, Grid3X3, Shield, Link2, Gauge, Image, Puzzle, BookOpen,
  Swords, DoorOpen, Shuffle, MapPin, Grid2X2,
  Warehouse, Cog, Megaphone, Headset, Building2, UserCog, FlaskConical, ShoppingCart,
  Workflow, GraduationCap, X, Database, Search, BadgeCheck,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { encodeReportLink } from "../lib/reportLink";
import "../styles/print.css";

// Same lookup App.tsx uses for /api/analyze -- duplicated here rather
// than threaded down as a prop since this is the only other real API
// call this component makes (GitHub issue #20, Ask AI).
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000";

const PALETTE = {
  // Sampled directly from assets/images/report-ux-mock.png's own
  // background (pixel-read via a small script, card-free regions only:
  // corners, sidebar/content margin gap, top strip): a flat vertical
  // gradient, near-black navy at the top (#00071b) to a very slightly
  // richer navy at the bottom (#010e25) -- no purple tint at all (R stayed
  // ~0 everywhere sampled) and no horizontal variation between left/right,
  // so no radial glow either. Replaces the earlier hand-guessed radial
  // purple-glow-at-top-right treatment, which didn't match.
  bgOuter: "linear-gradient(180deg, #00071b 0%, #010e25 100%)",
  bgSidebar: "#080f1e",
  bgCard: "rgba(10,20,40,0.92)",
  bgPanel: "#0b1428",
  border: "rgba(99,140,255,0.13)",
  textPrimary: "#ffffff",
  textSecondary: "#7a8aaa",
  textMuted: "#5a6a8a",
  blue: "#4a8fff",
  teal: "#2dd4bf",
  purple: "#7c3aed",
  purpleLight: "#a78bfa",
  amber: "#f59e0b",
  red: "#f87171",
};

// Single source of truth for the sidebar's framework nav list: exact
// order, exact labels, exact icons -- matches report-ux-mock.png's own
// fixed order (PESTEL, Porter's Five Forces, SWOT, TAM SAM SOM, STP, BCG
// Matrix, Value Chain, Business Model Canvas, Balanced Scorecard),
// interleaving real and locked-placeholder rows exactly as the mock does,
// not grouped into "unlocked first, then locked". `key: null` marks a
// locked placeholder with no backing framework; a non-null `key` is
// rendered unlocked only once `report.results[key]` actually exists (see
// the render loop below) -- this list itself doesn't decide what's
// locked, FREE_FRAMEWORKS (backend/routers/analysis.py) still does.
//
// Ansoff Matrix: not in the mock at all -- confirmed as a genuine new
// addition to the paid-tier roadmap (GitHub issue #16), placed next to
// BCG Matrix since both are 2x2 strategic-positioning tools.
//
// Icons: SWOT and BCG Matrix shared the same grid icon while BCG Matrix
// was a locked placeholder -- that was the mock's own choice, not a bug
// (confirmed against assets/images/report-ux-mock.png), and harmless
// when one of the two isn't clickable. GitHub issue #13 unlocked BCG
// Matrix as a real tab, so it now gets its own distinct grid variant
// (Grid2X2) -- two real, active tabs sharing one icon is a genuine
// usability problem the mock's original locked-placeholder context never
// had to account for. Business Model Canvas already got its own distinct
// framed-image icon for the same reason, since
// three-way icon reuse was the actual visual-parity gap being closed.
//
// `color`: the icon's color WHEN this row renders unlocked -- every entry
// gets one (not just the 4 real frameworks) so a distinct hue is already
// defined if the locked set ever changes, even though today only
// pestel/swot/tam/bmc actually render unlocked and show it. Locked rows
// ignore this entirely (they always render muted/gray, see the render
// loop below) -- this is NOT a lock-state signal, just per-framework
// icon color once a row IS unlocked.
const SIDEBAR_FRAMEWORK_NAV = [
  { key: "pestel", label: "PESTEL", icon: Globe, color: PALETTE.blue },
  // GitHub issue #11: unlocked -- real, working framework now, not a
  // placeholder. Only FREE_FRAMEWORKS (backend/routers/analysis.py) and
  // App.tsx's requested-frameworks array (the two places that actually
  // gate/request it) are the real switches; this list just reflects that.
  { key: "porter", label: "Porter's Five Forces", icon: Shield, color: PALETTE.red },
  { key: "swot", label: "SWOT", icon: Grid3X3, color: PALETTE.purple },
  { key: "tam", label: "TAM SAM SOM", icon: Target, color: PALETTE.teal },
  // GitHub issue #12: unlocked, same treatment as Porter's Five Forces.
  { key: "stp", label: "STP", icon: Users, color: PALETTE.purpleLight },
  // GitHub issue #13: unlocked. Icon swapped from the shared Grid3X3
  // (fine for a locked placeholder sitting next to SWOT, per the mock)
  // to its own Grid2X2 -- a real, clickable tab reusing another real
  // tab's exact icon would actually confuse users trying to tell two
  // active frameworks apart, unlike two disabled placeholders. Grid2X2
  // also just fits a 2x2 quadrant matrix thematically.
  { key: "bcg", label: "BCG Matrix", icon: Grid2X2, color: PALETTE.purple },
  // GitHub issue #16: unlocked -- last of the original 6 paid-tier
  // frameworks, now real.
  { key: "ansoff", label: "Ansoff Matrix", icon: TrendingUp, color: PALETTE.teal },
  // GitHub issue #14: unlocked, same treatment as Porter's Five
  // Forces/STP/BCG Matrix above.
  { key: "value_chain", label: "Value Chain", icon: Link2, color: PALETTE.red },
  { key: "bmc", label: "Business Model Canvas", icon: Image, color: PALETTE.amber },
  // GitHub issue #15: unlocked, same treatment as Value Chain/BCG
  // Matrix/Porter's Five Forces/STP above.
  { key: "balanced_scorecard", label: "Balanced Scorecard", icon: Gauge, color: PALETTE.amber },
];

// Derived, not hand-duplicated: FRAMEWORK_LABELS is still the thing
// OverviewFrameworkLinks, the citation-source tags (showFrameworkSource),
// and FrameworkPanel's header read from -- keeping it derived from
// SIDEBAR_FRAMEWORK_NAV means there's exactly one place that knows tam's
// label is "TAM SAM SOM", not two that could drift apart.
const FRAMEWORK_LABELS = Object.fromEntries(
  SIDEBAR_FRAMEWORK_NAV.filter((item) => item.key).map((item) => [item.key, item.label])
);
const FRAMEWORK_NAV_ICONS = Object.fromEntries(
  SIDEBAR_FRAMEWORK_NAV.filter((item) => item.key).map((item) => [item.key, item.icon])
);
const SIDE_NAV = [
  { icon: TrendingUp, label: "Analyze" },
  { icon: FolderOpen, label: "Projects" },
  { icon: Lightbulb, label: "Insights" },
  { icon: BarChart2, label: "Market" },
  { icon: FileText, label: "Reports" },
];

function useReportStats(report) {
  return useMemo(() => {
    const frameworks = Object.keys(report?.results || {});
    const verifiedCount = frameworks.filter((fw) => report.verification?.[fw]?.verified).length;
    const totalFrameworks = frameworks.length;

    let totalCitations = 0, similaritySum = 0, similarityCount = 0;
    const trend = [];

    frameworks.forEach((fw) => {
      const citations = report.results[fw]?.citations || [];
      const seen = new Set();
      citations.forEach((c) => {
        if (!seen.has(c.source_url)) { seen.add(c.source_url); totalCitations += 1; }
        similaritySum += c.similarity;
        similarityCount += 1;
        trend.push(Math.round(c.similarity * 100));
      });
    });

    const avgSimilarity = similarityCount ? Math.round((similaritySum / similarityCount) * 100) : 0;
    const confidencePct = totalFrameworks ? Math.round((verifiedCount / totalFrameworks) * 100) : 0;
    const unverifiedCount = totalFrameworks - verifiedCount;

    let verdict = "Insufficient Data", verdictSub = "Not enough grounded sources yet to form a verdict.", tone = "amber";
    if (totalFrameworks > 0 && verifiedCount === totalFrameworks) {
      verdict = "Proceed With Confidence";
      verdictSub = "All frameworks are backed by verified, grounded sources.";
      tone = "teal";
    } else if (verifiedCount > 0) {
      verdict = "Proceed With Caution";
      verdictSub = `${unverifiedCount} of ${totalFrameworks} sections need stronger sourcing.`;
      tone = "amber";
    } else if (totalFrameworks > 0) {
      verdict = "Gather More Sources";
      verdictSub = "No sections passed grounding verification yet.";
      tone = "red";
    }

    return { frameworks, verifiedCount, totalFrameworks, totalCitations, avgSimilarity, confidencePct, unverifiedCount, verdict, verdictSub, tone };
  }, [report]);
}

function ToneColor(tone) {
  return { teal: PALETTE.teal, amber: PALETTE.amber, red: PALETTE.red }[tone] || PALETTE.amber;
}

// Separate from useReportStats() on purpose -- that hook's numbers feed the
// verdict/metric values shown elsewhere and its dedup discipline stays
// untouched. This derives two additional per-framework trend arrays (real
// data, same report shape) purely for the MetricRow sparklines.
function useMetricTrends(report) {
  return useMemo(() => {
    const frameworks = Object.keys(report?.results || {});
    let cumulativeCitations = 0, cumulativeVerified = 0, cumulativeUnverified = 0;
    const citationTrend = [];
    const similarityTrend = [];
    // "Frameworks verified" and "Unverified sections" previously had no
    // spark at all (never passed sparkData) -- real, non-fabricated
    // trends for them too: cumulative verified/unverified count as you
    // go through each framework, same derivation discipline as
    // citationTrend/similarityTrend above (real per-framework data, not
    // an invented shape).
    const verifiedTrend = [];
    const unverifiedTrend = [];

    frameworks.forEach((fw) => {
      const citations = report.results[fw]?.citations || [];
      const seen = new Set();
      let simSum = 0;
      citations.forEach((c) => {
        if (!seen.has(c.source_url)) { seen.add(c.source_url); cumulativeCitations += 1; }
        simSum += c.similarity;
      });
      citationTrend.push({ v: cumulativeCitations });
      similarityTrend.push({ v: citations.length ? Math.round((simSum / citations.length) * 100) : 0 });

      if (report.verification?.[fw]?.verified) cumulativeVerified += 1;
      else cumulativeUnverified += 1;
      verifiedTrend.push({ v: cumulativeVerified });
      unverifiedTrend.push({ v: cumulativeUnverified });
    });

    return { citationTrend, similarityTrend, verifiedTrend, unverifiedTrend };
  }, [report]);
}

// Was a fixed 64x28px box squeezed into the same flex row as the card's
// value/label text (`items-end justify-between`) -- confirmed live this
// rendered as a collapsed few-pixel fragment instead of a visible chart:
// recharts' ResponsiveContainer measures its immediate DOM parent via
// getBoundingClientRect/ResizeObserver, and a fixed-px box living inside
// a `justify-between` flex row (competing for space with a `min-width:
// auto` sibling) doesn't reliably give it a stable, real box before that
// first measurement fires. No longer the component's job to size itself
// at all -- it now fills whatever container the caller gives it
// (MetricCard below provides a full-width, explicit-height block), which
// is both a more robust fix and what actually makes it "span most of the
// card's bottom area" as intended, instead of a small side element.
function Sparkline({ data, color }) {
  const id = color.replace(/[^a-z0-9]/gi, "");
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={`rvsg${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#rvsg${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ConfidenceRing({ pct, tone }) {
  const color = ToneColor(tone);
  const size = 150;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-extrabold text-white">{pct}%</span>
        <span className="text-[11px] uppercase tracking-wide" style={{ color: PALETTE.textMuted }}>Confidence</span>
      </div>
    </div>
  );
}

function VerdictBanner({ stats }) {
  const color = ToneColor(stats.tone);
  const ToneIcon = stats.tone === "red" ? ShieldAlert : stats.tone === "amber" ? AlertTriangle : ShieldCheck;
  return (
    <div className="flex items-center justify-between gap-6 rounded-2xl p-6 mb-4"
      style={{ background: `linear-gradient(135deg, ${color}14, ${PALETTE.bgCard})`, border: `1px solid ${color}55` }}>
      <div className="flex items-start gap-4">
        {/* Mock's badge measures roughly 90px -- ours was 44px, visibly
            smaller/lighter-weight next to the same-scale verdict text.
            Bumped closer to that proportion (64px circle, 28px icon). */}
        <div className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 64, height: 64, background: `${color}22`, color, border: `1px solid ${color}55` }}>
          <ToneIcon size={28} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: PALETTE.textMuted }}>Overall Strategic Verdict</div>
          <div className="text-3xl font-extrabold uppercase leading-[1.05] tracking-tight"
            style={{ color, textShadow: `0 0 20px ${color}70, 0 0 44px ${color}35` }}>{stats.verdict}</div>
          <div className="text-sm mt-1" style={{ color: PALETTE.textSecondary }}>{stats.verdictSub}</div>
        </div>
      </div>
      <div className="flex items-center gap-5 shrink-0">
        <ConfidenceRing pct={stats.confidencePct} tone={stats.tone} />
        {/* Mock puts this icon in its own circular badge too (matching
            the verdict badge on the left), not a bare icon -- was missing
            here. */}
        <div className="flex items-center gap-3 text-sm max-w-[150px]" style={{ color: PALETTE.textSecondary }}>
          <div className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 44, height: 44, background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.blue }}>
            <FileText size={18} />
          </div>
          <span>Based on <strong className="text-white">{stats.totalCitations}</strong> grounded sources</span>
        </div>
      </div>
    </div>
  );
}

// icon: matches the mock's small colored icon badge next to each metric
// card's label (previously missing entirely from this component -- the
// mock's 5 business-metric cards each have one, e.g. a bar-chart icon for
// Market Size, a shield for Competitive Pressure). Optional so a caller
// without a natural icon can omit it without leaving an empty gap.
function MetricCard({ label, value, sub, tone, sparkData, sparkColor, icon: Icon }) {
  const color = tone ? ToneColor(tone) : PALETTE.border;
  const iconColor = tone ? ToneColor(tone) : PALETTE.blue;
  const showSpark = sparkData && sparkData.length > 1;
  return (
    <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${tone ? color + "55" : PALETTE.border}` }}>
      <div>
        {Icon && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 26, height: 26, background: `${iconColor}22`, color: iconColor }}>
              <Icon size={13} />
            </div>
            <span className="text-xs" style={{ color: PALETTE.textSecondary }}>{label}</span>
          </div>
        )}
        <div className="text-xl font-extrabold text-white">{value}</div>
        {!Icon && <div className="text-xs mt-1" style={{ color: PALETTE.textSecondary }}>{label}</div>}
        {sub && <div className="text-[10px] mt-1" style={{ color: PALETTE.textMuted }}>{sub}</div>}
      </div>
      {/* Full-width strip along the card's bottom, not a small box
          squeezed beside the text -- see Sparkline's own comment for why
          that previously collapsed instead of rendering. */}
      {showSpark && (
        <div className="w-full mt-3" style={{ height: 32 }}>
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      )}
    </div>
  );
}

function MetricRow({ report, stats }) {
  const { citationTrend, similarityTrend, verifiedTrend, unverifiedTrend } = useMetricTrends(report);
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      <MetricCard icon={CheckCircle2} label="Frameworks verified" value={`${stats.verifiedCount}/${stats.totalFrameworks}`} sub="Passed citation check" tone={stats.verifiedCount === stats.totalFrameworks ? "teal" : "amber"} sparkData={verifiedTrend} sparkColor={ToneColor(stats.verifiedCount === stats.totalFrameworks ? "teal" : "amber")} />
      <MetricCard icon={BookOpen} label="Grounded sources" value={stats.totalCitations} sub="Unique citations used" sparkData={citationTrend} sparkColor={PALETTE.blue} />
      <MetricCard icon={Target} label="Avg source match" value={`${stats.avgSimilarity}%`} sub="Semantic similarity" sparkData={similarityTrend} sparkColor={PALETTE.purpleLight} />
      <MetricCard icon={AlertTriangle} label="Unverified sections" value={stats.unverifiedCount} sub={stats.unverifiedCount > 0 ? "Needs more sources" : "All clear"} tone={stats.unverifiedCount > 0 ? "amber" : "teal"} sparkData={unverifiedTrend} sparkColor={ToneColor(stats.unverifiedCount > 0 ? "amber" : "teal")} />
    </div>
  );
}

// Phase 2 of docs/BUSINESS_METRICS_SPEC.md. card -> required framework(s),
// mirrors agents/synthesis.py's CARD_FRAMEWORK_MAP exactly (market_size
// requires tam specifically, per the spec: "none -- this card requires TAM").
const BUSINESS_METRIC_CARDS = [
  { key: "market_size", label: "Market Size", requires: "TAM", icon: BarChart2 },
  { key: "competitive_pressure", label: "Competitive Pressure", requires: "Porter's Five Forces", fallback: "PESTEL or SWOT", icon: Shield },
  { key: "customer_segment", label: "Best Customer Segment", requires: "STP", fallback: "BMC or SWOT", icon: Users },
  { key: "business_model_fit", label: "Business Model Fit", requires: "BMC", icon: Puzzle },
  { key: "risk_flags", label: "Risk Flags", requires: "SWOT", fallback: "PESTEL", icon: AlertTriangle },
];

// Confirmed decision: the /10 meter is computed here from real similarity
// data, never asked of (or invented by) the LLM -- same discipline as
// stats.avgSimilarity. Prefers the specific citation the card's rationale
// was tied to; falls back to that framework's average similarity if the
// synthesis call couldn't attribute one specific citation.
function computeEvidenceScore(metric, report) {
  if (!metric) return null;
  const citations = report?.results?.[metric.source_framework]?.citations || [];
  if (citations.length === 0) return null;
  const cited = metric.citation_index ? citations.find((c) => c.index === metric.citation_index) : null;
  const similarity = cited ? cited.similarity : citations.reduce((sum, c) => sum + c.similarity, 0) / citations.length;
  return Math.round(similarity * 100) / 10;
}

function BusinessMetricCard({ meta, metric, report }) {
  if (!metric) {
    const requiredLabel = meta.fallback ? `${meta.requires} or ${meta.fallback}` : meta.requires;
    return (
      <div className="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1.5"
        style={{ background: PALETTE.bgCard, border: `1px dashed ${PALETTE.border}`, minHeight: 112 }}>
        <Lock size={14} style={{ color: PALETTE.textMuted }} />
        <div className="text-xs font-semibold" style={{ color: PALETTE.textSecondary }}>{meta.label}</div>
        <div className="text-[10px] leading-snug" style={{ color: PALETTE.textMuted }}>Not enough data — run the {requiredLabel} framework</div>
      </div>
    );
  }

  const score = computeEvidenceScore(metric, report);
  const tone = score == null ? null : score >= 7 ? "teal" : score >= 4 ? "amber" : "red";
  const color = tone ? ToneColor(tone) : PALETTE.blue;
  // docs/PHASE_4_SPEC.md B2: a single synthesized value has no real time
  // series -- this isn't a repeated measurement, so any variance in the
  // spark would be an invented trend implying change over time that never
  // happened. Flat line (every point == the one real computed score) is
  // the only non-fabricated way to give these a spark visual: purely
  // decorative, cosmetic parity with the mock, asserts nothing untrue.
  const sparkData = score != null ? Array.from({ length: 6 }, () => ({ v: score })) : undefined;

  return (
    <MetricCard
      icon={meta.icon}
      label={meta.label}
      value={metric.label}
      sparkData={sparkData}
      sparkColor={color}
      sub={
        <div className="flex flex-col items-start gap-1">
          <span>{metric.rationale}</span>
          {score != null && (
            <span className="px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${color}22`, color }}>
              {score.toFixed(1)}/10
            </span>
          )}
        </div>
      }
    />
  );
}

function BusinessMetricRow({ report, businessMetrics }) {
  if (!businessMetrics) return null;
  return (
    <div className="grid grid-cols-5 gap-3 mb-5">
      {BUSINESS_METRIC_CARDS.map((meta) => (
        <BusinessMetricCard key={meta.key} meta={meta} metric={businessMetrics[meta.key]} report={report} />
      ))}
    </div>
  );
}

// Shared by CitationList and FrameworkStrip's "Top Citations" -- one entry
// per unique source_url, keeping whichever citation of that source had the
// highest similarity, sorted best-match first.
function dedupeCitations(citations) {
  if (!citations || citations.length === 0) return [];
  const bySource = {};
  citations.forEach((c) => {
    const existing = bySource[c.source_url];
    if (!existing || c.similarity > existing.similarity) bySource[c.source_url] = c;
  });
  return Object.values(bySource).sort((a, b) => b.similarity - a.similarity);
}

// showFrameworkSource: Overview's aggregate citation list mixes citations
// from multiple frameworks, each with its own locally-1-based index -- a
// bare "[1]" would be ambiguous there (which framework's [1]?), so it
// shows "PESTEL · title" instead. Single-framework use (the per-tab
// Sources panel) keeps the plain "[N] title" form, unchanged.
function CitationList({ citations, showFrameworkSource = false }) {
  const unique = dedupeCitations(citations);
  if (unique.length === 0) {
    return <p className="text-sm" style={{ color: PALETTE.textMuted }}>No citations returned for this section.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {unique.map((c) => (
        <a key={c.source_url + c.index + (c._framework || "")} href={c.source_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: PALETTE.blue, textDecoration: "none" }}>
          <span className="truncate">
            {showFrameworkSource && c._framework ? `${FRAMEWORK_LABELS[c._framework] || c._framework.toUpperCase()} · ` : `[${c.index}] `}
            {c.source_title}
          </span>
          <span className="shrink-0" style={{ color: PALETTE.textMuted }}>{Math.round(c.similarity * 100)}%</span>
        </a>
      ))}
    </div>
  );
}

// [TAM]/[SAM]/[SOM] are parsing hooks the model is asked to emit (tam
// framework only, see agents/rag_pipeline.py TAM_TAGGING_INSTRUCTION) --
// not meant to be user-visible. Citation markers like [1] are left alone.
function stripMarketTags(text) {
  return text ? text.replace(/\[(TAM|SAM|SOM)\]\s*/gi, "") : text;
}

// GROUNDING_SYSTEM_PROMPT never asks the model for markdown, but gpt-4o-mini
// reliably emits **bold** for section labels (e.g. "**Political:**") anyway.
// That's the one markdown construct that shows up in practice, so a small
// regex split covers it without pulling in a full markdown-rendering
// dependency for a single pattern.
function renderBoldText(text) {
  if (!text) return text;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
      : part
  );
}

// No separate "summary" field exists in the API response, and fabricating
// one would violate the no-invented-numbers discipline this file is built
// on. The last sentence of the grounded text is a real, non-fabricated
// proxy for a takeaway -- it's the model's own words, not synthesized copy.
function lastSentence(text) {
  if (!text) return "";
  const sentences = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.length ? sentences[sentences.length - 1] : text.trim();
}

function FrameworkStrip({ result }) {
  const takeaway = stripMarketTags(lastSentence(result.text));
  const topCitations = dedupeCitations(result.citations).slice(0, 3);

  return (
    <div className="flex items-start gap-6 mt-5 pt-4 flex-wrap" style={{ borderTop: `1px solid ${PALETTE.border}` }}>
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center gap-1.5 text-xs font-bold mb-1" style={{ color: PALETTE.amber }}>
          <Lightbulb size={13} /> Key Takeaway
        </div>
        <p className="text-xs leading-relaxed" style={{ color: PALETTE.textSecondary }}>{renderBoldText(takeaway)}</p>
      </div>
      {topCitations.length > 0 && (
        <div className="shrink-0">
          <div className="text-xs font-bold text-white mb-1.5">Top Citations</div>
          <div className="flex flex-wrap gap-1.5 max-w-[220px]">
            {topCitations.map((c) => (
              <a key={c.source_url + c.index} href={c.source_url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-medium px-2 py-1 rounded-full transition-colors hover:bg-white/5"
                style={{ border: `1px solid ${PALETTE.border}`, color: PALETTE.blue, textDecoration: "none" }}>
                [{c.index}] {c.source_title && c.source_title.length > 22 ? c.source_title.slice(0, 22) + "…" : c.source_title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Phase 1 of docs/BUSINESS_METRICS_SPEC.md: market_sizing now comes
// structured straight from the API (agents/rag_pipeline.py's response_format
// json_schema call on the tam framework -- see AnalysisResponse.results.tam
// .market_sizing), not regex-recovered from prose. The old bracket-tag
// regex parser (parseMarketTiers/tagFigureRegex/UNIT_MULTIPLIER/
// MARKET_TIERS) was removed here after verifying the new field 15/15 (100%)
// on real calls, per the spec's "remove once verified" cutover.
const MARKET_TIER_META = {
  tam: { label: "TAM", color: PALETTE.blue },
  sam: { label: "SAM", color: PALETTE.purple },
  som: { label: "SOM", color: PALETTE.teal },
};

// docs/PHASE_4_SPEC.md B1: % of Parent is derived, not fabricated -- pure
// arithmetic on value_usd fields the API already returns, no prompt/schema
// change. TAM has no parent tier (shows "--"). Only computed when the
// parent tier is also present; a missing parent means "no basis to compute
// a percentage of", not 0%.
const PARENT_TIER_KEY = { sam: "tam", som: "sam" };

// docs/MARKET_SIZING_MISSING_TIER_UI.md: always return all 3 tiers (tam,
// sam, som), each flagged present: true|false, instead of filtering nulls
// out. A missing tier must be visibly marked as "no data found", not
// silently omitted -- same convention StructuredItemList and the Phase 2
// business-metric cards already use for missing grounded data.
function marketTiersFromApi(marketSizing) {
  if (!marketSizing) return [];
  return Object.entries(MARKET_TIER_META).map(([key, meta]) => {
    const tier = marketSizing[key];
    if (!tier) {
      return { key, label: meta.label, color: meta.color, present: false, value: null, displayValue: null, citationIndex: null, cagrPct: null, tierDescription: null };
    }
    return {
      key, label: meta.label, color: meta.color, present: true, value: tier.value_usd, displayValue: tier.label,
      citationIndex: tier.citation_index, cagrPct: tier.cagr_pct ?? null, tierDescription: tier.tier_description ?? null,
    };
  });
}

// docs/TAM_100_MATCH_SPEC.md item 4: full tier names are static,
// standard-definition text (not a claim about this idea's actual market),
// so hardcoding them per tier carries no fabrication risk.
const TIER_FULL_NAME = {
  tam: "Total Addressable Market",
  sam: "Serviceable Available Market",
  som: "Serviceable Obtainable Market",
};

// Phase 3 of docs/BUSINESS_METRICS_SPEC.md. Shared by PESTEL/SWOT/BMC's
// structured category rendering -- each category is an array of
// {text, citation_index} points from the model's structured output. An
// empty array is a real, expected "CONTEXT didn't cover this category"
// state, not an error, same discipline as everywhere else in this file.
function StructuredItemList({ items }) {
  if (!items || items.length === 0) {
    return <p className="text-xs italic" style={{ color: PALETTE.textMuted }}>No grounded points for this category.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: "#e4e9f5" }}>
          <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: PALETTE.textMuted }} />
          <span>
            {renderBoldText(item.text)}
            {item.citation_index != null && <span className="ml-1" style={{ color: PALETTE.blue }}>[{item.citation_index}]</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// GitHub issue #15 (Balanced Scorecard). Same list treatment as
// StructuredItemList, plus an inline metric badge (value -> target)
// when the point carries a grounded metric_name/metric_value --
// _null_out_ungrounded_scorecard_metrics (agents/rag_pipeline.py)
// guarantees metric_name/metric_value are only both non-null together,
// so this only needs to check one of them before rendering the badge.
function MetricItemList({ items, color }) {
  if (!items || items.length === 0) {
    return <p className="text-xs italic" style={{ color: PALETTE.textMuted }}>No grounded points for this perspective.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: "#e4e9f5" }}>
          <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: PALETTE.textMuted }} />
          <span>
            {renderBoldText(item.text)}
            {item.citation_index != null && <span className="ml-1" style={{ color: PALETTE.blue }}>[{item.citation_index}]</span>}
            {item.metric_value != null && (
              <span className="ml-1.5 font-bold" style={{ color }}>
                {item.metric_name}: {item.metric_value}
                {item.target_value != null && <span style={{ color: PALETTE.textMuted, fontWeight: 400 }}> (target {item.target_value})</span>}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

// docs/PHASE_5_SPEC.md B: icons per category + layout, not photography --
// stock imagery would misrepresent a report whose whole discipline is
// "every number is real". Icon dims to 0.35 opacity when its category is
// empty (StructuredItemList already shows "No grounded points..." for
// that case; the icon shouldn't visually pretend the block is as "full"
// as one with real content).
function CategoryIcon({ Icon, color, isEmpty }) {
  return <Icon size={14} style={{ color, opacity: isEmpty ? 0.35 : 1 }} className="shrink-0" />;
}

const PESTEL_BLOCKS = [
  { key: "political", label: "Political", color: PALETTE.blue, Icon: Landmark },
  { key: "economic", label: "Economic", color: PALETTE.teal, Icon: TrendingUp },
  { key: "social", label: "Social", color: PALETTE.purple, Icon: Users },
  { key: "technological", label: "Technological", color: PALETTE.purpleLight, Icon: Cpu },
  { key: "environmental", label: "Environmental", color: PALETTE.amber, Icon: Leaf },
  { key: "legal", label: "Legal", color: PALETTE.red, Icon: Scale },
];

function PestelBlocks({ pestelAnalysis }) {
  return (
    <div className="flex flex-col gap-4">
      {PESTEL_BLOCKS.map((b) => {
        const items = pestelAnalysis[b.key];
        return (
          <div key={b.key}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: b.color }}>
              <CategoryIcon Icon={b.Icon} color={b.color} isEmpty={!items || items.length === 0} />
              {b.label}
            </div>
            <StructuredItemList items={items} />
          </div>
        );
      })}
    </div>
  );
}

const SWOT_QUADRANTS = [
  { key: "strengths", label: "Strengths", color: PALETTE.teal, Icon: Zap },
  { key: "weaknesses", label: "Weaknesses", color: PALETTE.red, Icon: AlertTriangle },
  { key: "opportunities", label: "Opportunities", color: PALETTE.blue, Icon: Target },
  { key: "threats", label: "Threats", color: PALETTE.amber, Icon: ShieldAlert },
];

function SwotGrid({ swotAnalysis }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SWOT_QUADRANTS.map((q) => {
        const items = swotAnalysis[q.key];
        return (
          <div key={q.key} className="rounded-xl p-3" style={{ background: PALETTE.bgPanel, border: `1px solid ${q.color}33` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-2" style={{ color: q.color }}>
              <CategoryIcon Icon={q.Icon} color={q.color} isEmpty={!items || items.length === 0} />
              {q.label}
            </div>
            <StructuredItemList items={items} />
          </div>
        );
      })}
    </div>
  );
}

// 7 operational blocks in a 3-wide grid + Cost Structure/Revenue Streams as
// their own distinguished bottom row -- a "3x3-ish" reading of the
// canonical BMC layout (spec's own hedge) sized for this panel's actual
// width, rather than the full 5-column poster layout, which wouldn't fit
// this narrower report column. Each block gets both an icon and its own
// accent color now, not just the two-tier operational/financial split.
const BMC_BLOCKS = [
  { key: "key_partners", label: "Key Partners", color: PALETTE.purpleLight, Icon: Handshake },
  { key: "key_activities", label: "Key Activities", color: PALETTE.amber, Icon: Zap },
  { key: "value_propositions", label: "Value Propositions", color: PALETTE.teal, Icon: Gift },
  { key: "key_resources", label: "Key Resources", color: PALETTE.purple, Icon: Boxes },
  { key: "customer_relationships", label: "Customer Relationships", color: PALETTE.red, Icon: Heart },
  { key: "customer_segments", label: "Customer Segments", color: PALETTE.blue, Icon: Users },
  { key: "channels", label: "Channels", color: PALETTE.purpleLight, Icon: Truck },
];
const BMC_FINANCIAL_BLOCKS = [
  { key: "cost_structure", label: "Cost Structure", color: PALETTE.blue, Icon: Receipt },
  { key: "revenue_streams", label: "Revenue Streams", color: PALETTE.blue, Icon: DollarSign },
];

function BmcBlock({ block, items }) {
  const isEmpty = !items || items.length === 0;
  return (
    <div className="rounded-xl p-3" style={{ background: PALETTE.bgPanel, border: `1px solid ${block.color}33` }}>
      <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: block.color }}>
        <CategoryIcon Icon={block.Icon} color={block.color} isEmpty={isEmpty} />
        {block.label}
      </div>
      <StructuredItemList items={items} />
    </div>
  );
}

function BmcCanvas({ bmcCanvas }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {BMC_BLOCKS.map((b) => <BmcBlock key={b.key} block={b} items={bmcCanvas[b.key]} />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {BMC_FINANCIAL_BLOCKS.map((b) => <BmcBlock key={b.key} block={b} items={bmcCanvas[b.key]} />)}
      </div>
    </div>
  );
}

// GitHub issue #11. Vertical stack like PestelBlocks (not a grid --
// 5 categories doesn't divide evenly the way SWOT's 4 or BMC's paired
// layout do).
const PORTER_FORCES_BLOCKS = [
  { key: "competitive_rivalry", label: "Competitive Rivalry", color: PALETTE.red, Icon: Swords },
  { key: "threat_of_new_entrants", label: "Threat of New Entrants", color: PALETTE.amber, Icon: DoorOpen },
  { key: "bargaining_power_of_suppliers", label: "Bargaining Power of Suppliers", color: PALETTE.purple, Icon: Truck },
  { key: "bargaining_power_of_buyers", label: "Bargaining Power of Buyers", color: PALETTE.blue, Icon: Users },
  { key: "threat_of_substitutes", label: "Threat of Substitutes", color: PALETTE.teal, Icon: Shuffle },
];

function PorterForcesBlocks({ porterForces }) {
  return (
    <div className="flex flex-col gap-4">
      {PORTER_FORCES_BLOCKS.map((b) => {
        const items = porterForces[b.key];
        return (
          <div key={b.key}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: b.color }}>
              <CategoryIcon Icon={b.Icon} color={b.color} isEmpty={!items || items.length === 0} />
              {b.label}
            </div>
            <StructuredItemList items={items} />
          </div>
        );
      })}
    </div>
  );
}

// GitHub issue #12. 3-column grid (like SwotGrid's 2-col, sized for 3
// items instead of 4) -- segmentation/targeting/positioning divides
// evenly, unlike Porter's Five Forces' 5.
const STP_BLOCKS = [
  { key: "segmentation", label: "Segmentation", color: PALETTE.blue, Icon: Layers },
  { key: "targeting", label: "Targeting", color: PALETTE.purpleLight, Icon: Target },
  { key: "positioning", label: "Positioning", color: PALETTE.teal, Icon: MapPin },
];

function StpGrid({ stpAnalysis }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {STP_BLOCKS.map((b) => {
        const items = stpAnalysis[b.key];
        return (
          <div key={b.key} className="rounded-xl p-3" style={{ background: PALETTE.bgPanel, border: `1px solid ${b.color}33` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-2" style={{ color: b.color }}>
              <CategoryIcon Icon={b.Icon} color={b.color} isEmpty={!items || items.length === 0} />
              {b.label}
            </div>
            <StructuredItemList items={items} />
          </div>
        );
      })}
    </div>
  );
}

// GitHub issue #13. 2x2 grid at fixed BCG-convention positions (growth
// rate on the vertical axis, market-share position on the horizontal --
// standard quadrant placement), not derived from the data itself since
// there are always exactly 4 named quadrants. Only the ASSIGNED quadrant
// (result.bcg_matrix.quadrant) gets the bold filled treatment; the other
// 3 get the same dashed-ghost muted styling TamSizingCard uses for an
// absent tier -- consistent "this wasn't the real answer" visual
// language across the app, not a new one invented for this framework.
const BCG_QUADRANT_LAYOUT = [
  { key: "question_mark", label: "Question Mark", color: PALETTE.amber },
  { key: "star", label: "Star", color: PALETTE.teal },
  { key: "dog", label: "Dog", color: PALETTE.red },
  { key: "cash_cow", label: "Cash Cow", color: PALETTE.blue },
];

function BcgQuadrantChart({ bcgMatrix }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2" style={{ maxWidth: 360 }}>
        {BCG_QUADRANT_LAYOUT.map((q) => {
          const isAssigned = q.key === bcgMatrix.quadrant;
          return (
            <div key={q.key} className="rounded-xl p-3 flex items-center justify-center text-center"
              style={isAssigned
                ? { background: `${q.color}22`, border: `1.5px solid ${q.color}`, minHeight: 72 }
                : { border: `1.5px dashed ${PALETTE.textMuted}`, opacity: 0.5, minHeight: 72 }}>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: isAssigned ? q.color : PALETTE.textMuted }}>
                {q.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] flex items-center justify-between" style={{ color: PALETTE.textMuted, maxWidth: 360 }}>
        <span>← Low market share</span>
        <span>High market share →</span>
      </div>
      <div className="mt-4 flex flex-col gap-1.5 text-xs">
        <div>
          <span className="font-semibold" style={{ color: PALETTE.textSecondary }}>Market growth: </span>
          <span className="text-white">{bcgMatrix.market_growth_rate_pct}%</span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: PALETTE.textSecondary }}>Market position: </span>
          <span className="text-white">{bcgMatrix.market_share_position}</span>
        </div>
        <p className="mt-1 leading-relaxed" style={{ color: "#e4e9f5" }}>
          {bcgMatrix.rationale}
          {bcgMatrix.citation_index != null && <span className="ml-1" style={{ color: PALETTE.blue }}>[{bcgMatrix.citation_index}]</span>}
        </p>
      </div>
    </div>
  );
}

// GitHub issue #14. Porter's Value Chain -- 5 primary activities flow
// left-to-right (the classic horizontal-chain diagram every value-chain
// reference uses), with the 4 support activities as a row above them
// since they cut across all 5 rather than sequencing with them. Not a
// grid like BMC/STP -- the whole point of a value chain is the sequence.
const VALUE_CHAIN_PRIMARY_BLOCKS = [
  { key: "inbound_logistics", label: "Inbound Logistics", Icon: Warehouse },
  { key: "operations", label: "Operations", Icon: Cog },
  { key: "outbound_logistics", label: "Outbound Logistics", Icon: Truck },
  { key: "marketing_and_sales", label: "Marketing & Sales", Icon: Megaphone },
  { key: "service", label: "Service", Icon: Headset },
];
const VALUE_CHAIN_SUPPORT_BLOCKS = [
  { key: "firm_infrastructure", label: "Firm Infrastructure", Icon: Building2 },
  { key: "human_resource_management", label: "HR Management", Icon: UserCog },
  { key: "technology_development", label: "Technology Development", Icon: FlaskConical },
  { key: "procurement", label: "Procurement", Icon: ShoppingCart },
];

function ValueChainBlock({ block, items, color }) {
  const isEmpty = !items || items.length === 0;
  return (
    <div className="rounded-xl p-3 flex-1 min-w-0" style={{ background: PALETTE.bgPanel, border: `1px solid ${color}33` }}>
      <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color }}>
        <CategoryIcon Icon={block.Icon} color={color} isEmpty={isEmpty} />
        <span className="truncate">{block.label}</span>
      </div>
      <StructuredItemList items={items} />
    </div>
  );
}

function ValueChain({ valueChain }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: PALETTE.textMuted }}>
          Support Activities
        </div>
        <div className="flex flex-wrap gap-3">
          {VALUE_CHAIN_SUPPORT_BLOCKS.map((b) => (
            <ValueChainBlock key={b.key} block={b} items={valueChain[b.key]} color={PALETTE.purpleLight} />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: PALETTE.textMuted }}>
          Primary Activities
        </div>
        <div className="flex flex-wrap gap-3">
          {VALUE_CHAIN_PRIMARY_BLOCKS.map((b) => (
            <ValueChainBlock key={b.key} block={b} items={valueChain[b.key]} color={PALETTE.red} />
          ))}
        </div>
      </div>
    </div>
  );
}

// GitHub issue #15. 2x2 grid -- the 4 perspectives are independent, not
// sequential like Value Chain's chain, so a grid fits (same reasoning as
// SwotGrid/StpGrid). MetricItemList (above) is what actually
// distinguishes this from a plain qualitative-category block: each
// point may carry a real, CONTEXT-grounded metric/target pair.
const BALANCED_SCORECARD_BLOCKS = [
  { key: "financial", label: "Financial", color: PALETTE.teal, Icon: DollarSign },
  { key: "customer", label: "Customer", color: PALETTE.blue, Icon: Users },
  { key: "internal_process", label: "Internal Process", color: PALETTE.purple, Icon: Workflow },
  { key: "learning_and_growth", label: "Learning & Growth", color: PALETTE.amber, Icon: GraduationCap },
];

function BalancedScorecard({ balancedScorecard }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {BALANCED_SCORECARD_BLOCKS.map((b) => {
        const items = balancedScorecard[b.key];
        return (
          <div key={b.key} className="rounded-xl p-3" style={{ background: PALETTE.bgPanel, border: `1px solid ${b.color}33` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-2" style={{ color: b.color }}>
              <CategoryIcon Icon={b.Icon} color={b.color} isEmpty={!items || items.length === 0} />
              {b.label}
            </div>
            <MetricItemList items={items} color={b.color} />
          </div>
        );
      })}
    </div>
  );
}

// GitHub issue #16. Same fixed 2x2 quadrant treatment as
// BcgQuadrantChart -- market on one axis, product on the other, both
// "existing" vs "new" per the standard Ansoff Matrix convention.
const ANSOFF_QUADRANT_LAYOUT = [
  { key: "market_development", label: "Market Development", color: PALETTE.blue },
  { key: "diversification", label: "Diversification", color: PALETTE.red },
  { key: "market_penetration", label: "Market Penetration", color: PALETTE.teal },
  { key: "product_development", label: "Product Development", color: PALETTE.amber },
];

function AnsoffQuadrantChart({ ansoffMatrix }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2" style={{ maxWidth: 360 }}>
        {ANSOFF_QUADRANT_LAYOUT.map((q) => {
          const isAssigned = q.key === ansoffMatrix.quadrant;
          return (
            <div key={q.key} className="rounded-xl p-3 flex items-center justify-center text-center"
              style={isAssigned
                ? { background: `${q.color}22`, border: `1.5px solid ${q.color}`, minHeight: 72 }
                : { border: `1.5px dashed ${PALETTE.textMuted}`, opacity: 0.5, minHeight: 72 }}>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: isAssigned ? q.color : PALETTE.textMuted }}>
                {q.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] flex items-center justify-between" style={{ color: PALETTE.textMuted, maxWidth: 360 }}>
        <span>← Existing product</span>
        <span>New product →</span>
      </div>
      <div className="mt-4 flex flex-col gap-1.5 text-xs">
        <div>
          <span className="font-semibold" style={{ color: PALETTE.textSecondary }}>Market: </span>
          <span className="text-white capitalize">{ansoffMatrix.market_dimension}</span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: PALETTE.textSecondary }}>Product: </span>
          <span className="text-white capitalize">{ansoffMatrix.product_dimension}</span>
        </div>
        <p className="mt-1 leading-relaxed" style={{ color: "#e4e9f5" }}>
          {ansoffMatrix.rationale}
          {ansoffMatrix.citation_index != null && <span className="ml-1" style={{ color: PALETTE.blue }}>[{ansoffMatrix.citation_index}]</span>}
        </p>
      </div>
    </div>
  );
}

// Dispatches to a framework's structured visual treatment when available;
// falls back to the plain prose paragraph otherwise (missing field, older
// cached report, or a framework Phase 3 hasn't migrated yet) -- same
// graceful-degradation pattern as MarketSizingPanel. bcg_matrix being
// null (the model couldn't ground both a growth rate and a market
// position, see _null_out_unsupported_bcg_quadrant) deliberately falls
// through to this same plain-paragraph path -- the narrative itself
// explains what's missing, same honesty as every other ungrounded case.
function FrameworkBody({ frameworkKey, result }) {
  if (frameworkKey === "pestel" && result.pestel_analysis) {
    return <PestelBlocks pestelAnalysis={result.pestel_analysis} />;
  }
  if (frameworkKey === "swot" && result.swot_analysis) {
    return <SwotGrid swotAnalysis={result.swot_analysis} />;
  }
  if (frameworkKey === "bmc" && result.bmc_canvas) {
    return <BmcCanvas bmcCanvas={result.bmc_canvas} />;
  }
  if (frameworkKey === "stp" && result.stp_analysis) {
    return <StpGrid stpAnalysis={result.stp_analysis} />;
  }
  if (frameworkKey === "porter" && result.porter_forces) {
    return <PorterForcesBlocks porterForces={result.porter_forces} />;
  }
  if (frameworkKey === "bcg" && result.bcg_matrix) {
    return <BcgQuadrantChart bcgMatrix={result.bcg_matrix} />;
  }
  if (frameworkKey === "value_chain" && result.value_chain) {
    return <ValueChain valueChain={result.value_chain} />;
  }
  if (frameworkKey === "balanced_scorecard" && result.balanced_scorecard) {
    return <BalancedScorecard balancedScorecard={result.balanced_scorecard} />;
  }
  if (frameworkKey === "ansoff" && result.ansoff_matrix) {
    return <AnsoffQuadrantChart ansoffMatrix={result.ansoff_matrix} />;
  }
  const isInsufficient = result.text?.trim() === "Insufficient grounded data available for this section.";
  return (
    <p className="text-sm leading-relaxed" style={{ color: isInsufficient ? PALETTE.textMuted : "#e4e9f5", fontStyle: isInsufficient ? "italic" : "normal" }}>
      {renderBoldText(stripMarketTags(result.text))}
    </p>
  );
}

// GitHub issue #19. Real, accurate description of this project's own
// pipeline (agents/rag_pipeline.py) -- not generic RAG boilerplate.
// Every claim below is checked against the actual implementation:
// - Retrieval: text-embedding-3-small query embedding, pgvector
//   similarity search against the ingested corpus, live Tavily web
//   search as a fallback only when local grounding is empty or weak
//   (search_and_ingest in agents/web_retrieval.py).
// - Grounding: gpt-4o-mini generates the analysis from ONLY the
//   retrieved chunks (never general model knowledge), citing each
//   factual sentence with a [N] marker tied to a specific chunk.
// - Verification: verify_claims() is a lightweight structural check --
//   flags "no grounded sources retrieved" if retrieval came back
//   empty, or "no inline citation markers found" if the generated text
//   cited nothing -- not a claim-by-claim fact-check.
// Per-framework note customizes the last paragraph only; the pipeline
// description itself is identical for every framework since it really
// is the same code path.
const METHODOLOGY_FRAMEWORK_NOTES = {
  tam: "TAM/SAM/SOM's three tiers are each independently null unless the CONTEXT states a real, specific dollar figure for that exact tier -- a real TAM with no stated SAM never gets a fabricated SAM to fill the gap.",
  pestel: "PESTEL's 6 categories (political, economic, social, technological, environmental, legal) are populated independently -- a category with no CONTEXT support renders as an empty, explicitly-labeled gap, not an invented point.",
  swot: "SWOT's 4 categories are populated independently -- a category with no CONTEXT support renders as an empty, explicitly-labeled gap, not an invented point.",
  bmc: "The Business Model Canvas's 9 blocks are populated independently -- a block with no CONTEXT support renders as an empty, explicitly-labeled gap, not an invented point.",
  porter: "Porter's Five Forces' 5 categories are populated independently -- a force with no CONTEXT support renders as an empty, explicitly-labeled gap, not an invented point.",
  stp: "STP's 3 categories (segmentation, targeting, positioning) are populated independently -- a category with no CONTEXT support renders as an empty, explicitly-labeled gap, not an invented point.",
  bcg: "The BCG quadrant is only assigned when the CONTEXT gives BOTH a real market growth rate AND a real market-share/competitive-position description -- a deterministic check runs after generation and discards the quadrant entirely if either signal is missing, rather than trusting the model's own judgment alone.",
  value_chain: "Value Chain's 9 activities (5 primary + 4 support) are populated independently -- an activity with no CONTEXT support renders as an empty, explicitly-labeled gap, not an invented point.",
  balanced_scorecard: "Each Balanced Scorecard point may carry an optional metric (a named number with an optional target), but only when the CONTEXT states a real figure for that exact point -- a deterministic check runs after generation and strips any metric name/value/target that isn't genuinely paired, rather than trusting the model's own judgment alone.",
  ansoff: "The Ansoff quadrant is only assigned when the CONTEXT lets both the market (existing vs. new) and the product (existing vs. new) be classified -- a deterministic check runs after generation and discards the quadrant entirely if either dimension can't be determined, rather than trusting the model's own judgment alone.",
};

function MethodologyModal({ frameworkKey, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const frameworkLabel = FRAMEWORK_LABELS[frameworkKey] || frameworkKey;
  const note = METHODOLOGY_FRAMEWORK_NOTES[frameworkKey];

  const STEPS = [
    {
      Icon: Search,
      title: "1. Retrieval",
      body: "Your idea is embedded (text-embedding-3-small) and matched against this project's ingested source corpus by vector similarity. If the local corpus has nothing relevant, or only a weak match, a live web search (Tavily) runs as a fallback and its results are ingested before generation continues.",
    },
    {
      Icon: Database,
      title: "2. Grounded generation",
      body: "The model (gpt-4o-mini) writes this section using ONLY the retrieved source chunks above -- never its own general knowledge. Every factual sentence is required to carry a [N] citation marker tied to the specific chunk it came from; anywhere the sources don't support a claim, the model is instructed to say so or leave that field empty rather than fill the gap.",
    },
    {
      Icon: BadgeCheck,
      title: "3. Verification",
      body: "A lightweight structural check runs on the output: \"Verified\" means at least one source was retrieved AND the generated text actually contains citation markers. \"Unverified\" flags the specific reason (no sources retrieved, or no citations used) -- it is not a claim-by-claim fact-check against the sources.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,4,15,0.7)" }} onClick={onClose}>
      <div className="rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.textMuted }}>Methodology</div>
            <h2 className="text-lg font-extrabold text-white">{frameworkLabel}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center rounded-full transition-colors hover:bg-white/5 shrink-0"
            style={{ width: 28, height: 28, background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textSecondary }}>
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {STEPS.map((s) => (
            <div key={s.title}>
              <div className="flex items-center gap-1.5 text-xs font-bold mb-1" style={{ color: PALETTE.blue }}>
                <s.Icon size={13} /> {s.title}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#e4e9f5" }}>{s.body}</p>
            </div>
          ))}
          {note && (
            <div className="pt-3" style={{ borderTop: `1px solid ${PALETTE.border}` }}>
              <div className="flex items-center gap-1.5 text-xs font-bold mb-1" style={{ color: PALETTE.teal }}>
                <Info size={13} /> This framework
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#e4e9f5" }}>{note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FrameworkPanel({ frameworkKey, result, verification, ideaTitle }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const verified = verification?.verified ?? false;

  return (
    <div className="rounded-2xl p-6" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 34, height: 34, background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.blue }}>
            <Layers size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.textMuted }}>Framework</div>
            <h2 className="text-xl font-extrabold text-white">{FRAMEWORK_LABELS[frameworkKey] || frameworkKey.toUpperCase()}</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: PALETTE.textMuted }}>Analysis for {ideaTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ color: verified ? PALETTE.teal : PALETTE.amber, border: `1px solid ${verified ? PALETTE.teal : PALETTE.amber}` }}>
            {verified ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {verified ? "Verified" : "Unverified"}
          </span>
          {/* GitHub issue #19: wired to a real modal now. */}
          <button onClick={() => setShowMethodology(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-colors hover:bg-white/5"
            style={{ background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textSecondary }}>
            <Info size={12} /> Methodology
          </button>
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand section" : "Collapse section"}
            className="flex items-center justify-center rounded-full transition-colors hover:bg-white/5"
            style={{ width: 28, height: 28, background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textSecondary }}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <FrameworkBody frameworkKey={frameworkKey} result={result} />

          {verification?.unsupported_claims?.length > 0 && (
            <div className="flex items-center gap-2 mt-4 text-xs px-3 py-2 rounded-lg" style={{ color: PALETTE.amber, background: `${PALETTE.amber}14`, border: `1px solid ${PALETTE.amber}44` }}>
              <AlertTriangle size={13} /> {verification.unsupported_claims.join(", ")}
            </div>
          )}
        </>
      )}

      <FrameworkStrip result={result} />
      {showMethodology && <MethodologyModal frameworkKey={frameworkKey} onClose={() => setShowMethodology(false)} />}
    </div>
  );
}

// docs/TAM_100_MATCH_SPEC.md: the TAM tab's merged card -- one component
// instead of MarketSizingPanel + FrameworkPanel stacked separately, so the
// circles/legend/table become the primary content directly under the
// header (matching the mock) instead of sitting above a second card with
// its own duplicate header. Only used at the call site when
// result.market_sizing exists; when it doesn't (older cached report, or
// tam structured output wasn't attempted), the call site falls back to
// plain FrameworkPanel since there's nothing to merge into then.
function TamSizingCard({ result, verification, ideaTitle }) {
  const items = useMemo(() => marketTiersFromApi(result.market_sizing), [result]);
  // Assumption 1 (confirmed): narrative stays available, not deleted --
  // collapsed behind a toggle, default closed, so circles/table (what the
  // mock shows first) lead while "why this number" stays one click away
  // instead of disappearing outright.
  const [showNarrative, setShowNarrative] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const verified = verification?.verified ?? false;

  const presentItems = items.filter((it) => it.present);
  const maxOuter = 92, minRadius = 24, ringGap = 18, ghostRadius = 34;
  const maxValue = presentItems.length ? Math.max(...presentItems.map((it) => it.value)) : 0;
  // Real-world tier ratios are far more skewed than sqrt-scaling alone can
  // stay legible at: a real case (TAM $6.1B / SAM $330M / SOM $8M, SAM at
  // 5.4% of TAM vs. the mock's own ~27%) made the old independent
  // `Math.max(minRadius, ...)` floor push SAM and SOM to the exact SAME
  // radius (both naturally computed below minRadius), rendering as one
  // ring instead of two -- SAM effectively invisible underneath SOM.
  //
  // Fixed by guaranteeing separation, not just a shared floor: walk
  // present tiers outer-to-inner (tam -> sam -> som, the same nesting
  // order this diagram has always assumed) and require each one's radius
  // to be at least `ringGap` smaller than the tier just outside it, with
  // the innermost present tier still floored at `minRadius`. Tiers whose
  // natural sqrt-scaled size already clears its guaranteed minimum keep
  // that proportional size (see the mock-like-ratio case in this
  // function's test coverage) -- this only kicks in once ratios get
  // skewed enough that proportional sizing alone would collapse two
  // rings together.
  const presentIndices = items.map((it, i) => (it.present ? i : null)).filter((i) => i !== null);
  const radii = new Array(items.length).fill(ghostRadius);
  let prevRadius = maxOuter + ringGap; // virtual outer ceiling so the largest present tier can still reach maxOuter
  presentIndices.forEach((idx, rank) => {
    const remainingSmallerTiers = presentIndices.length - 1 - rank;
    const guaranteedFloor = minRadius + ringGap * remainingSmallerTiers;
    const natural = maxOuter * Math.sqrt(items[idx].value / maxValue);
    const ceiling = Math.max(prevRadius - ringGap, guaranteedFloor);
    const r = Math.min(Math.max(natural, guaranteedFloor), ceiling);
    radii[idx] = r;
    prevRadius = r;
  });
  const size = maxOuter * 2 + 16;
  const cx = size / 2, cy = size / 2;
  const byKey = Object.fromEntries(items.map((it) => [it.key, it]));
  const innermostPresentIndex = presentIndices.length ? presentIndices[presentIndices.length - 1] : null;

  const isInsufficient = result.text?.trim() === "Insufficient grounded data available for this section.";

  return (
    <div className="rounded-2xl p-6" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 34, height: 34, background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.blue }}>
            <Layers size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.textMuted }}>Framework</div>
            {/* Hardcoded rather than reading FRAMEWORK_LABELS.tam -- this
                card's own title is a fixed part of its layout, not a
                lookup. FRAMEWORK_LABELS.tam (sidebar nav,
                OverviewFrameworkLinks, citation-source tags) is now also
                "TAM SAM SOM", intentionally: same string, single source of
                truth for those other call sites, no double-labeling. */}
            <h2 className="text-xl font-extrabold text-white">TAM SAM SOM</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: PALETTE.textMuted }}>Analysis for {ideaTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ color: verified ? PALETTE.teal : PALETTE.amber, border: `1px solid ${verified ? PALETTE.teal : PALETTE.amber}` }}>
            {verified ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {verified ? "Verified" : "Unverified"}
          </span>
          {/* GitHub issue #19: wired to a real modal now. */}
          <button onClick={() => setShowMethodology(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-colors hover:bg-white/5"
            style={{ background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textSecondary }}>
            <Info size={12} /> Methodology
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <svg width={size} height={size} className="shrink-0">
          {items.map((item, i) => {
            if (!item.present) {
              // Unchanged: dashed ghost ring for an absent tier.
              return (
                <g key={item.key}>
                  <circle cx={cx} cy={cy} r={radii[i]} fill="none" stroke={PALETTE.textMuted} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
                  <text x={cx} y={cy - radii[i] + 9} textAnchor="middle" fontSize="7" fill={PALETTE.textMuted}>No data found</text>
                </g>
              );
            }
            // Solid filled band, matching the mock -- each smaller present
            // tier is drawn after (so painted over the center of) the
            // larger one, leaving each ring's own color visible as a band
            // around it rather than a hollow outline. Value written
            // directly on the visible band/circle, not just in the side
            // legend: positioned at the vertical midpoint of this tier's
            // own visible band (between its own radius and the next
            // smaller present tier's radius), or dead center for the
            // innermost present tier, which has no inner neighbor to
            // avoid.
            const rankInPresent = presentIndices.indexOf(i);
            const isInnermost = i === innermostPresentIndex;
            const innerBoundary = isInnermost ? 0 : radii[presentIndices[rankInPresent + 1]];
            const textY = isInnermost ? cy : cy - (radii[i] + innerBoundary) / 2;
            // Fill opacity bumped from the original 0x59 (~35%, read as
            // faint/washed-out next to the mock's bold, near-opaque
            // bands) to 0xD9 (~85%) -- confirmed against a real
            // screenshot comparison. At that opacity the fill itself IS
            // the dominant color under the text now, not a light tint
            // over the dark card background, so the inline label/value
            // text gets a dark halo (stroke painted behind the fill via
            // paintOrder) rather than relying on plain white-on-color
            // contrast, which isn't reliably legible against every tier
            // color (teal in particular).
            return (
              <g key={item.key}>
                <circle cx={cx} cy={cy} r={radii[i]} fill={`${item.color}D9`} stroke={item.color} strokeWidth={2} />
                <text x={cx} y={textY - 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff"
                  stroke="rgba(0,0,0,0.55)" strokeWidth="2.5" strokeLinejoin="round" paintOrder="stroke">{item.label}</text>
                <text x={cx} y={textY + 9} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff"
                  stroke="rgba(0,0,0,0.55)" strokeWidth="2.5" strokeLinejoin="round" paintOrder="stroke">{item.displayValue}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                style={item.present ? { background: item.color } : { border: `1.5px dashed ${PALETTE.textMuted}` }} />
              <div>
                <div>
                  <span className="font-semibold text-white">{item.label}</span>{" "}
                  {item.present
                    ? <span style={{ color: PALETTE.textSecondary }}>{item.displayValue}</span>
                    : <span style={{ color: PALETTE.textMuted, fontStyle: "italic" }}>No data found</span>}
                </div>
                {/* Assumption 2 (confirmed): tier_description is a real
                    grounded schema field (agents/rag_pipeline.py's
                    MARKET_SIZING_SCHEMA), null when the CONTEXT didn't
                    support a specific description -- same discipline as
                    cagr_pct, never fake-derived from unrelated text. */}
                {item.present && item.tierDescription && (
                  <div className="text-[11px] mt-0.5" style={{ color: PALETTE.textMuted }}>{item.tierDescription}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <table className="w-full mt-4 text-xs">
        <thead>
          <tr style={{ color: PALETTE.textMuted }}>
            <th className="text-left font-medium pb-1.5">Metric</th>
            <th className="text-left font-medium pb-1.5">Value (USD)</th>
            <th className="text-left font-medium pb-1.5">% of Parent</th>
            <th className="text-left font-medium pb-1.5">CAGR</th>
            <th className="text-left font-medium pb-1.5">Source</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const parent = byKey[PARENT_TIER_KEY[item.key]];
            const pctOfParent = item.present && parent?.present ? Math.round((item.value / parent.value) * 1000) / 10 : null;
            return (
              <tr key={item.key} style={{ borderTop: `1px solid ${PALETTE.border}` }}>
                <td className="py-1.5">
                  <div className="font-semibold" style={{ color: item.color }}>{item.label}</div>
                  <div className="text-[10px]" style={{ color: PALETTE.textMuted }}>{TIER_FULL_NAME[item.key]}</div>
                </td>
                <td className="py-1.5" style={item.present ? { color: "#fff" } : { color: PALETTE.textMuted, fontStyle: "italic" }}>
                  {item.present ? item.displayValue : "No data found"}
                </td>
                <td className="py-1.5" style={{ color: PALETTE.textSecondary }}>{pctOfParent != null ? `${pctOfParent}%` : "—"}</td>
                <td className="py-1.5" style={{ color: item.cagrPct != null ? PALETTE.teal : PALETTE.textSecondary }}>{item.cagrPct != null ? `${item.cagrPct}%` : "—"}</td>
                <td className="py-1.5" style={{ color: PALETTE.textSecondary }}>{item.citationIndex ? `[${item.citationIndex}]` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-[10px] mt-3" style={{ color: PALETTE.textMuted }}>
        Grounded market sizing extracted from the retrieved sources — not independently verified market data.
      </p>

      <div className="mt-4">
        <button onClick={() => setShowNarrative((s) => !s)} aria-expanded={showNarrative}
          className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-80"
          style={{ color: PALETTE.blue }}>
          {showNarrative ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showNarrative ? "Hide full analysis" : "Read full analysis"}
        </button>
        {showNarrative && (
          <p className="text-sm leading-relaxed mt-2" style={{ color: isInsufficient ? PALETTE.textMuted : "#e4e9f5", fontStyle: isInsufficient ? "italic" : "normal" }}>
            {renderBoldText(stripMarketTags(result.text))}
          </p>
        )}
      </div>

      {verification?.unsupported_claims?.length > 0 && (
        <div className="flex items-center gap-2 mt-4 text-xs px-3 py-2 rounded-lg" style={{ color: PALETTE.amber, background: `${PALETTE.amber}14`, border: `1px solid ${PALETTE.amber}44` }}>
          <AlertTriangle size={13} /> {verification.unsupported_claims.join(", ")}
        </div>
      )}

      <FrameworkStrip result={result} />
      {showMethodology && <MethodologyModal frameworkKey="tam" onClose={() => setShowMethodology(false)} />}
    </div>
  );
}

// docs/PHASE_5_SPEC.md A: the Overview tab's optional (per the spec,
// "nice-to-have") main-content area -- real per-framework counts/verified
// state, not fabricated, doubling as quick navigation into each tab.
function OverviewFrameworkLinks({ stats, report, onSelectFramework }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.frameworks.map((fw) => {
        const verified = report.verification?.[fw]?.verified;
        const citationCount = report.results?.[fw]?.citations?.length || 0;
        return (
          <button key={fw} onClick={() => onSelectFramework(fw)}
            className="text-left rounded-2xl p-4 transition-colors hover:bg-white/5"
            style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-white">{FRAMEWORK_LABELS[fw] || fw.toUpperCase()}</span>
              {verified
                ? <CheckCircle2 size={14} style={{ color: PALETTE.teal }} />
                : <AlertTriangle size={14} style={{ color: PALETTE.amber }} />}
            </div>
            <p className="text-xs" style={{ color: PALETTE.textSecondary }}>
              {citationCount} grounded source{citationCount === 1 ? "" : "s"} · {verified ? "Verified" : "Needs review"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// GitHub issue #17 (Share). Builds a self-contained link (the whole
// report encoded into the URL hash, see lib/reportLink.js) and copies
// it to the clipboard -- confirmed decision: a copy-current-session
// link, no backend persistence. Three visible states so a failure
// (clipboard permission denied, or the report being too large to fit
// in a URL) is never silent -- "Share" alone would look successful
// even when nothing was actually copied.
function ShareButton({ idea, report }) {
  const [state, setState] = useState("idle"); // idle | copying | copied | error

  const handleShare = async () => {
    setState("copying");
    try {
      const url = await encodeReportLink({ idea, report });
      if (!url) throw new Error("report too large to encode into a link");
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      console.error("ShareButton: failed to copy link", err);
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const label = state === "copied" ? "Link copied!" : state === "error" ? "Couldn't copy link" : state === "copying" ? "Copying…" : "Share";

  return (
    <button onClick={handleShare} disabled={state === "copying"} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-white/5"
      style={{ background: PALETTE.bgCard, color: state === "error" ? PALETTE.red : "#fff", border: `1px solid ${PALETTE.border}` }}>
      {state === "copied" ? <CheckCircle2 size={14} /> : <Share2 size={14} />} {label}
    </button>
  );
}

// GitHub issue #20 ("Ask AI"). Calls the real /api/ask endpoint
// (backend/routers/analysis.py -> agents/report_qa.py) with this
// report's own already-generated results -- no new retrieval happens
// server-side, same grounding discipline as everything else in this
// report. A question the report's own text doesn't cover comes back
// with grounded: false and an honest "doesn't cover that" answer,
// rendered the same way FrameworkBody renders an insufficient-data
// section (muted, italic) rather than hidden or styled as a normal
// answer.
const ASK_AI_SUGGESTED_QUESTION = "What are the biggest risks in this analysis?";

function AskAiPanel({ idea, results, frameworksAllowed }) {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [response, setResponse] = useState(null);

  const ask = async (q) => {
    const trimmed = q.trim();
    if (!trimmed || status === "loading") return;
    setStatus("loading");
    setResponse(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, question: trimmed, results, frameworks_allowed: frameworksAllowed }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setResponse(data);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
      <div className="flex items-center justify-between text-sm font-bold text-white mb-3">
        <span className="flex items-center gap-1.5"><Sparkles size={14} style={{ color: PALETTE.purpleLight }} /> Ask AI</span>
      </div>
      <button onClick={() => { setQuestion(ASK_AI_SUGGESTED_QUESTION); ask(ASK_AI_SUGGESTED_QUESTION); }}
        className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg mb-2 w-full text-left transition-colors hover:bg-white/5"
        style={{ background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textSecondary }}>
        <MessageSquare size={13} className="shrink-0" /> {ASK_AI_SUGGESTED_QUESTION}
      </button>
      <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex gap-1.5">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} disabled={status === "loading"}
          placeholder="Ask anything about this analysis..." className="w-full text-xs px-3 py-2.5 rounded-lg"
          style={{ background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textPrimary }} />
      </form>

      {status === "loading" && (
        <p className="text-xs mt-3 italic" style={{ color: PALETTE.textMuted }}>Thinking…</p>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 mt-3 text-xs px-3 py-2 rounded-lg" style={{ color: PALETTE.red, background: `${PALETTE.red}14`, border: `1px solid ${PALETTE.red}44` }}>
          <AlertTriangle size={13} /> Something went wrong asking that -- please try again.
        </div>
      )}
      {status === "done" && response && (
        <div className="mt-3">
          <p className="text-xs leading-relaxed" style={{ color: response.grounded ? "#e4e9f5" : PALETTE.textMuted, fontStyle: response.grounded ? "normal" : "italic" }}>
            {response.answer}
          </p>
          {response.grounded && response.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {response.sources.map((s, i) => (
                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: PALETTE.blue, border: `1px solid ${PALETTE.blue}44` }}>
                  {FRAMEWORK_LABELS[s.framework] || s.framework}{s.citation_index != null ? ` [${s.citation_index}]` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportView({ report, idea, onReset }) {
  const stats = useReportStats(report);
  // docs/PHASE_5_SPEC.md A: "overview" is a real selectable state alongside
  // the framework keys, not a separate parallel concept -- defaults here
  // instead of the first framework, since the verdict/metrics block now
  // only renders when this is active.
  const [activeFramework, setActiveFramework] = useState("overview");

  if (!report) return null;

  const isOverview = activeFramework === "overview";
  // report.results has no "overview" key, so this is naturally
  // null/undefined on the overview tab -- the existing `activeResult &&`
  // guards below already correctly skip the framework-only panels then.
  const activeResult = activeFramework && !isOverview ? report.results[activeFramework] : null;
  const activeVerification = activeFramework && !isOverview ? report.verification?.[activeFramework] : null;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const title = idea ? (idea.length > 52 ? idea.slice(0, 52) + "…" : idea) : "Business Idea Analysis";
  // Real citations from every framework, tagged with which one they came
  // from -- feeds the Sources & Citations panel on the Overview tab, where
  // a single framework's activeResult doesn't exist to pull from.
  const allCitations = useMemo(
    () => Object.entries(report.results || {}).flatMap(([fw, r]) => (r.citations || []).map((c) => ({ ...c, _framework: fw }))),
    [report]
  );

  return (
    <div className="report-view-root flex min-h-screen w-full overflow-hidden" style={{ background: PALETTE.bgOuter, fontFamily: "'Inter', sans-serif" }}>
      <aside className="report-print-hide flex flex-col w-[250px] min-h-screen py-5 px-3 shrink-0" style={{ background: PALETTE.bgSidebar, borderRight: `1px solid ${PALETTE.border}` }}>
        <div className="flex items-center gap-2 px-2 mb-6">
          {/* Hexagonal "G" mark matching the mock: an outlined (not
              filled) hexagon with a blue->purple gradient stroke, and an
              open-ring "G" glyph inside built the same way -- a dashed
              circle with one gap (not an arc path, to avoid guessing
              large-arc/sweep flags for a shape this project can't
              currently screenshot-verify pixel-by-pixel) plus a short bar
              closing the gap toward center, echoing the mock's monogram. */}
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="groundlyLogoGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={PALETTE.blue} />
                  <stop offset="100%" stopColor={PALETTE.purpleLight} />
                </linearGradient>
              </defs>
              <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="url(#groundlyLogoGrad)" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="6.5" stroke="url(#groundlyLogoGrad)" strokeWidth="1.8" strokeLinecap="round"
                strokeDasharray="35.17 5.67" strokeDashoffset="-2.84" />
              <line x1="12.5" y1="12" x2="18" y2="12" stroke="url(#groundlyLogoGrad)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">Groundly</div>
            <div className="text-[9px] leading-tight uppercase tracking-wider" style={{ color: PALETTE.textMuted }}>AI Analysis Platform</div>
          </div>
        </div>

        <button onClick={() => setActiveFramework("overview")}
          className="flex items-center gap-2 text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors mb-3"
          style={{ background: isOverview ? `${PALETTE.blue}1f` : "transparent", color: isOverview ? "#fff" : PALETTE.textSecondary,
            boxShadow: isOverview ? `inset 0 0 0 1.5px ${PALETTE.blue}` : "none" }}>
          <LayoutGrid size={15} style={{ color: isOverview ? PALETTE.blue : PALETTE.textMuted }} />
          Overview
        </button>

        <div className="text-[10px] uppercase tracking-wider px-2 mb-1" style={{ color: PALETTE.textMuted }}>Frameworks</div>

        <div className="flex flex-col gap-0.5">
          {/* One fixed-order list, real and locked rows interleaved exactly
              as report-ux-mock.png shows them -- not grouped into
              "unlocked first, then locked". A `key` entry only renders
              unlocked if report.results actually has that framework (same
              condition stats.frameworks encoded before); otherwise it
              falls through to the same locked treatment as a `key: null`
              placeholder, which keeps this safe even for the edge case of
              a supported framework whose data didn't come back on this
              particular report. */}
          {SIDEBAR_FRAMEWORK_NAV.map((item) => {
            const isUnlocked = item.key && stats.frameworks.includes(item.key);
            const NavIcon = item.icon;

            if (isUnlocked) {
              const verified = report.verification?.[item.key]?.verified;
              const active = activeFramework === item.key;
              // Two independent signals, deliberately not conflated:
              // brightness/color here is driven ONLY by lock state (this
              // row is unlocked, full stop) -- verified/weak-data status
              // never dims a row or grays out its icon. That status only
              // ever shows up in the checkmark-vs-dot indicator below.
              // Without this, an unlocked-but-weak-data framework reads
              // as visually indistinguishable from a genuinely locked
              // one, which is exactly the bug this fixes.
              return (
                <button key={item.label} onClick={() => setActiveFramework(item.key)}
                  className="flex items-start justify-between gap-2 text-sm px-3 py-2.5 rounded-xl transition-colors text-left"
                  style={{ background: active ? `${PALETTE.blue}1f` : "transparent", color: "#fff",
                    boxShadow: active ? `inset 0 0 0 1.5px ${PALETTE.blue}` : "none" }}>
                  <span className="flex items-start gap-2 min-w-0">
                    <NavIcon size={15} style={{ color: active ? PALETTE.blue : item.color }} className="shrink-0 mt-0.5" />
                    {/* Wraps instead of truncating (matches the mock's own
                        treatment of "Business Model Canvas" -- it wraps to
                        a 2nd line there too, at this same sidebar width,
                        rather than clipping with an ellipsis). */}
                    <span className="leading-snug">{item.label}</span>
                  </span>
                  {/* Intentional, confirmed: checkmark = a strong grounded
                      result; gray dot = the framework ran but came back
                      weak/insufficient. Not a uniform "ran" indicator, and
                      NOT a brightness/lock signal either -- a weak-data
                      framework still looks fully available above, it just
                      gets a dot here instead of a checkmark. */}
                  {verified
                    ? <CheckCircle2 size={14} style={{ color: PALETTE.teal }} className="shrink-0 mt-0.5" />
                    : <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ background: PALETTE.textMuted }} />}
                </button>
              );
            }

            return (
              <button key={item.label} disabled className="flex items-start justify-between gap-2 text-sm px-3 py-2.5 rounded-xl opacity-40 cursor-not-allowed text-left" style={{ color: PALETTE.textSecondary }}>
                <span className="flex items-start gap-2 min-w-0">
                  <NavIcon size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{item.label}</span>
                </span>
                <Lock size={12} className="shrink-0 mt-0.5" />
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="rounded-xl p-3.5" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: PALETTE.purpleLight }}>
              <Sparkles size={13} /> Pro Plan
            </div>
            <p className="text-[11px] mb-2.5" style={{ color: PALETTE.textSecondary }}>Unlock advanced frameworks and export unlimited reports.</p>
            <button disabled className="w-full text-xs font-semibold py-2 rounded-lg opacity-60" style={{ background: PALETTE.bgPanel, color: "#fff", border: `1px solid ${PALETTE.border}` }}>
              Upgrade Plan
            </button>
          </div>
          <button onClick={onReset} className="w-full text-xs font-semibold py-2.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ background: PALETTE.bgCard, color: "#fff", border: `1px solid ${PALETTE.border}` }}>
            Start New Analysis
          </button>
        </div>
      </aside>

      <main className="report-main-content flex-1 min-h-screen overflow-y-auto px-8 py-7">
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 38, height: 38, background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}`, color: PALETTE.teal }}>
              <Layers size={18} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white leading-tight">{title}</h1>
              <div className="text-xs mt-1" style={{ color: PALETTE.textMuted }}>{today} · v1.0 (Latest)</div>
            </div>
          </div>
          <div className="report-print-hide flex gap-2 shrink-0">
            <ShareButton idea={idea} report={report} />
            {/* GitHub issue #18: browser print-to-PDF via print.css, no new
                dependency. Prints exactly the currently active tab (same
                content the user is looking at), with app chrome hidden and
                the dark theme flipped to a print-readable light theme. */}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-90 text-white"
              style={{ background: `linear-gradient(90deg, ${PALETTE.blue}, ${PALETTE.purple})` }}>
              <Download size={14} /> Export PDF
            </button>
          </div>
        </div>

        {/* docs/PHASE_5_SPEC.md A: this block used to render unconditionally
            above every framework tab (identical on all of them) -- it's now
            the Overview tab's content and renders exactly once per report. */}
        {isOverview && (
          <>
            <VerdictBanner stats={stats} />
            <MetricRow report={report} stats={stats} />
            <BusinessMetricRow report={report} businessMetrics={report.business_metrics} />
          </>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 320px" }}>
          <div>
            {isOverview
              ? <OverviewFrameworkLinks stats={stats} report={report} onSelectFramework={setActiveFramework} />
              : activeResult && (
                // docs/TAM_100_MATCH_SPEC.md item 1: merged single card for
                // TAM specifically, but only once market_sizing actually
                // exists to merge around -- an older cached report or a
                // framework run where tam structured output wasn't
                // attempted has nothing to show there, so it falls back to
                // the plain FrameworkPanel every other framework already uses.
                activeFramework === "tam" && activeResult.market_sizing
                  ? <TamSizingCard result={activeResult} verification={activeVerification} ideaTitle={title} />
                  : <FrameworkPanel frameworkKey={activeFramework} result={activeResult} verification={activeVerification} ideaTitle={title} />
              )}
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
              <div className="flex items-center justify-between text-sm font-bold text-white mb-3">
                <span>Sources & Citations</span>
                {/* Was always stats.totalCitations (the report-wide dedup
                    count across every framework), even on a single-
                    framework tab whose list below only ever showed that
                    framework's own citations -- a tab with e.g. 0
                    citations of its own could still show "View all (3)"
                    from an unrelated framework's total. Header count now
                    tracks whichever set CitationList actually renders:
                    the same allCitations/activeResult switch as the list
                    itself, deduped by source_url the same way
                    CitationList and stats.totalCitations both already do
                    -- otherwise a framework whose citations happen to
                    share a source_url across chunks would still show a
                    header count higher than the list underneath it. */}
                <span className="text-[11px] font-medium" style={{ color: PALETTE.blue }}>
                  View all ({isOverview ? stats.totalCitations : dedupeCitations(activeResult?.citations).length})
                </span>
              </div>
              <CitationList citations={isOverview ? allCitations : activeResult?.citations} showFrameworkSource={isOverview} />
            </div>

            <div className="report-print-hide">
              <AskAiPanel idea={idea} results={report.results} frameworksAllowed={report.frameworks_allowed} />
            </div>

            <div className="report-print-hide rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
              <div className="flex items-center justify-between text-sm font-bold text-white">
                <span className="flex items-center gap-1.5"><GitCompare size={14} style={{ color: PALETTE.blue }} /> Compare Version</span>
                <span className="text-[10px]" style={{ color: PALETTE.textMuted }}>Coming soon</span>
              </div>
              <p className="text-[11px] mt-2" style={{ color: PALETTE.textMuted }}>Compare this analysis with previous versions.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
