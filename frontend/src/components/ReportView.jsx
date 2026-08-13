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

import { useState, useMemo } from "react";
import {
  TrendingUp, FolderOpen, Lightbulb, BarChart2, FileText, Settings,
  ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Lock,
  Share2, Download, Sparkles, MessageSquare, GitCompare, Layers, ChevronLeft,
  Info, ChevronUp, ChevronDown, LayoutGrid,
  Landmark, Users, Cpu, Leaf, Scale, Zap, Target, Gift, Truck, Heart,
  DollarSign, Boxes, Handshake, Receipt,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

const PALETTE = {
  bgOuter: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)",
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

const FRAMEWORK_LABELS = { pestel: "PESTEL", swot: "SWOT", tam: "TAM", bmc: "BMC" };
const LOCKED_FRAMEWORKS = ["Porter's Five Forces", "BCG Matrix", "Value Chain", "Balanced Scorecard"];
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
    let cumulativeCitations = 0;
    const citationTrend = [];
    const similarityTrend = [];

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
    });

    return { citationTrend, similarityTrend };
  }, [report]);
}

function Sparkline({ data, color }) {
  const id = color.replace(/[^a-z0-9]/gi, "");
  return (
    <div style={{ width: 64, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`rvsg${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#rvsg${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
        <div className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 44, height: 44, background: `${color}22`, color }}>
          <ToneIcon size={22} />
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
        <div className="flex items-center gap-2 text-sm max-w-[130px]" style={{ color: PALETTE.textSecondary }}>
          <Layers size={16} style={{ color: PALETTE.blue }} />
          <span>Based on <strong className="text-white">{stats.totalCitations}</strong> grounded sources</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone, sparkData, sparkColor }) {
  const color = tone ? ToneColor(tone) : PALETTE.border;
  const showSpark = sparkData && sparkData.length > 1;
  return (
    <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${tone ? color + "55" : PALETTE.border}` }}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xl font-extrabold text-white">{value}</div>
          <div className="text-xs mt-1" style={{ color: PALETTE.textSecondary }}>{label}</div>
          {sub && <div className="text-[10px] mt-1" style={{ color: PALETTE.textMuted }}>{sub}</div>}
        </div>
        {showSpark && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
    </div>
  );
}

function MetricRow({ report, stats }) {
  const { citationTrend, similarityTrend } = useMetricTrends(report);
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      <MetricCard label="Frameworks verified" value={`${stats.verifiedCount}/${stats.totalFrameworks}`} sub="Passed citation check" tone={stats.verifiedCount === stats.totalFrameworks ? "teal" : "amber"} />
      <MetricCard label="Grounded sources" value={stats.totalCitations} sub="Unique citations used" sparkData={citationTrend} sparkColor={PALETTE.blue} />
      <MetricCard label="Avg source match" value={`${stats.avgSimilarity}%`} sub="Semantic similarity" sparkData={similarityTrend} sparkColor={PALETTE.purpleLight} />
      <MetricCard label="Unverified sections" value={stats.unverifiedCount} sub={stats.unverifiedCount > 0 ? "Needs more sources" : "All clear"} tone={stats.unverifiedCount > 0 ? "amber" : "teal"} />
    </div>
  );
}

// Phase 2 of docs/BUSINESS_METRICS_SPEC.md. card -> required framework(s),
// mirrors agents/synthesis.py's CARD_FRAMEWORK_MAP exactly (market_size
// requires tam specifically, per the spec: "none -- this card requires TAM").
const BUSINESS_METRIC_CARDS = [
  { key: "market_size", label: "Market Size", requires: "TAM" },
  { key: "competitive_pressure", label: "Competitive Pressure", requires: "PESTEL", fallback: "SWOT" },
  { key: "customer_segment", label: "Best Customer Segment", requires: "BMC", fallback: "SWOT" },
  { key: "business_model_fit", label: "Business Model Fit", requires: "BMC" },
  { key: "risk_flags", label: "Risk Flags", requires: "SWOT", fallback: "PESTEL" },
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
      return { key, label: meta.label, color: meta.color, present: false, value: null, displayValue: null, citationIndex: null, cagrPct: null };
    }
    return {
      key, label: meta.label, color: meta.color, present: true, value: tier.value_usd, displayValue: tier.label,
      citationIndex: tier.citation_index, cagrPct: tier.cagr_pct ?? null,
    };
  });
}

function MarketSizingPanel({ frameworkKey, result }) {
  const items = useMemo(
    () => (frameworkKey === "tam" ? marketTiersFromApi(result?.market_sizing) : []),
    [frameworkKey, result]
  );
  // items is only [] when market_sizing itself is absent (not tam, or the
  // API never attempted it) -- marketTiersFromApi() always returns all 3
  // tiers once market_sizing exists, even if every tier came back null, so
  // this panel now renders (with explicit "no data found" tiers) instead
  // of silently disappearing whenever nothing was grounded.
  if (items.length === 0) return null;

  const presentItems = items.filter((it) => it.present);
  const maxOuter = 78, minRadius = 22, ghostRadius = 34;
  const maxValue = presentItems.length ? Math.max(...presentItems.map((it) => it.value)) : 0;
  // Present tiers size by sqrt-scaled value, same as before. Absent tiers
  // get a fixed placeholder radius -- there's no value to size them by,
  // and faking one would fabricate a number this file has never fabricated
  // anywhere else. The sequential nesting clamp still applies uniformly so
  // a ghost ring never looks bigger than a real circle before it.
  const radii = items.map((it) => (it.present ? Math.max(minRadius, maxOuter * Math.sqrt(it.value / maxValue)) : ghostRadius));
  for (let i = 1; i < radii.length; i++) radii[i] = Math.min(radii[i], Math.max(minRadius, radii[i - 1] - 10));
  const size = maxOuter * 2 + 16;
  const cx = size / 2, cy = size / 2;

  const byKey = Object.fromEntries(items.map((it) => [it.key, it]));

  return (
    <div className="rounded-2xl p-6 mb-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={16} style={{ color: PALETTE.blue }} />
        <h3 className="text-sm font-bold text-white">Market Sizing</h3>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <svg width={size} height={size} className="shrink-0">
          {items.map((item, i) =>
            item.present ? (
              <circle key={item.key} cx={cx} cy={cy} r={radii[i]} fill={`${item.color}22`} stroke={item.color} strokeWidth={2} />
            ) : (
              <g key={item.key}>
                <circle cx={cx} cy={cy} r={radii[i]} fill="none" stroke={PALETTE.textMuted} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
                <text x={cx} y={cy - radii[i] + 9} textAnchor="middle" fontSize="7" fill={PALETTE.textMuted}>No data found</text>
              </g>
            )
          )}
        </svg>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                style={item.present ? { background: item.color } : { border: `1.5px dashed ${PALETTE.textMuted}` }} />
              <span className="font-semibold text-white w-9">{item.label}</span>
              {item.present
                ? <span style={{ color: PALETTE.textSecondary }}>{item.displayValue}</span>
                : <span style={{ color: PALETTE.textMuted, fontStyle: "italic" }}>No data found</span>}
            </div>
          ))}
        </div>
      </div>

      <table className="w-full mt-4 text-xs">
        <thead>
          <tr style={{ color: PALETTE.textMuted }}>
            <th className="text-left font-medium pb-1.5">Label</th>
            <th className="text-left font-medium pb-1.5">Value</th>
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
                <td className="py-1.5 font-semibold" style={{ color: item.color }}>{item.label}</td>
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
    </div>
  );
}

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

// Dispatches to a framework's structured visual treatment when available;
// falls back to the plain prose paragraph otherwise (missing field, older
// cached report, or a framework Phase 3 hasn't migrated yet) -- same
// graceful-degradation pattern as MarketSizingPanel.
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
  const isInsufficient = result.text?.trim() === "Insufficient grounded data available for this section.";
  return (
    <p className="text-sm leading-relaxed" style={{ color: isInsufficient ? PALETTE.textMuted : "#e4e9f5", fontStyle: isInsufficient ? "italic" : "normal" }}>
      {renderBoldText(stripMarketTags(result.text))}
    </p>
  );
}

function FrameworkPanel({ frameworkKey, result, verification, ideaTitle }) {
  const [collapsed, setCollapsed] = useState(false);
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
          {/* Visual parity only, not wired up yet -- no methodology content to show. */}
          <button disabled title="Coming soon" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full opacity-70"
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
    <div className="flex min-h-screen w-full overflow-hidden" style={{ background: PALETTE.bgOuter, fontFamily: "'Inter', sans-serif" }}>
      <aside className="flex flex-col w-[250px] min-h-screen py-5 px-3 shrink-0" style={{ background: PALETTE.bgSidebar, borderRight: `1px solid ${PALETTE.border}` }}>
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${PALETTE.blue}, ${PALETTE.purple})` }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 2L16 14H2L9 2Z" fill="white" fillOpacity="0.9" /></svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">Groundly</div>
            <div className="text-[9px] leading-tight" style={{ color: PALETTE.textMuted }}>AI Analysis Platform</div>
          </div>
        </div>

        <button onClick={() => setActiveFramework("overview")}
          className="flex items-center gap-2 text-sm font-semibold px-3 py-2.5 rounded-xl transition-colors mb-3"
          style={{ background: isOverview ? PALETTE.bgPanel : "transparent", color: isOverview ? "#fff" : PALETTE.textSecondary,
            boxShadow: isOverview ? `inset 0 0 0 1px ${PALETTE.border}` : "none" }}>
          <LayoutGrid size={15} style={{ color: isOverview ? PALETTE.blue : PALETTE.textMuted }} />
          Overview
        </button>

        <div className="text-[10px] uppercase tracking-wider px-2 mb-1" style={{ color: PALETTE.textMuted }}>Frameworks</div>

        <div className="flex flex-col gap-0.5">
          {stats.frameworks.map((fw) => {
            const verified = report.verification?.[fw]?.verified;
            const active = activeFramework === fw;
            return (
              <button key={fw} onClick={() => setActiveFramework(fw)}
                className="flex items-center justify-between gap-2 text-sm px-3 py-2.5 rounded-xl transition-colors"
                style={{ background: active ? PALETTE.bgPanel : "transparent", color: active ? "#fff" : PALETTE.textSecondary,
                  boxShadow: active ? `inset 0 0 0 1px ${PALETTE.border}` : "none" }}>
                <span>{FRAMEWORK_LABELS[fw] || fw.toUpperCase()}</span>
                {verified ? <CheckCircle2 size={14} style={{ color: PALETTE.teal }} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: PALETTE.textMuted }} />}
              </button>
            );
          })}

          {LOCKED_FRAMEWORKS.map((label) => (
            <button key={label} disabled className="flex items-center justify-between gap-2 text-sm px-3 py-2.5 rounded-xl opacity-40 cursor-not-allowed" style={{ color: PALETTE.textSecondary }}>
              <span>{label}</span>
              <Lock size={12} />
            </button>
          ))}
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

      <main className="flex-1 min-h-screen overflow-y-auto px-8 py-7">
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
          <div className="flex gap-2 shrink-0">
            <button disabled title="Coming soon" className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl opacity-60"
              style={{ background: PALETTE.bgCard, color: "#fff", border: `1px solid ${PALETTE.border}` }}>
              <Share2 size={14} /> Share
            </button>
            <button disabled title="Coming soon" className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl opacity-70 text-white"
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
              : (
                <>
                  {activeResult && <MarketSizingPanel frameworkKey={activeFramework} result={activeResult} />}
                  {activeResult && <FrameworkPanel frameworkKey={activeFramework} result={activeResult} verification={activeVerification} ideaTitle={title} />}
                </>
              )}
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
              <div className="flex items-center justify-between text-sm font-bold text-white mb-3">
                <span>Sources & Citations</span>
                <span className="text-[11px] font-medium" style={{ color: PALETTE.blue }}>View all ({stats.totalCitations})</span>
              </div>
              <CitationList citations={isOverview ? allCitations : activeResult?.citations} showFrameworkSource={isOverview} />
            </div>

            <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
              <div className="flex items-center justify-between text-sm font-bold text-white mb-3">
                <span className="flex items-center gap-1.5"><Sparkles size={14} style={{ color: PALETTE.purpleLight }} /> Ask AI</span>
                <span className="text-[10px]" style={{ color: PALETTE.textMuted }}>Coming soon</span>
              </div>
              <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg mb-2" style={{ background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textSecondary }}>
                <MessageSquare size={13} /> What are the biggest risks in this analysis?
              </div>
              <input disabled placeholder="Ask anything about this analysis..." className="w-full text-xs px-3 py-2.5 rounded-lg"
                style={{ background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.textMuted }} />
            </div>

            <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
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
