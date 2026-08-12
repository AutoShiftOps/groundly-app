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
          <div className="text-3xl font-extrabold leading-tight" style={{ color }}>{stats.verdict}</div>
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

function CitationList({ citations }) {
  if (!citations || citations.length === 0) {
    return <p className="text-sm" style={{ color: PALETTE.textMuted }}>No citations returned for this section.</p>;
  }
  const bySource = {};
  citations.forEach((c) => {
    const existing = bySource[c.source_url];
    if (!existing || c.similarity > existing.similarity) bySource[c.source_url] = c;
  });
  const unique = Object.values(bySource).sort((a, b) => b.similarity - a.similarity);

  return (
    <div className="flex flex-col gap-1.5">
      {unique.map((c) => (
        <a key={c.source_url + c.index} href={c.source_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: PALETTE.blue, textDecoration: "none" }}>
          <span className="truncate">[{c.index}] {c.source_title}</span>
          <span className="shrink-0" style={{ color: PALETTE.textMuted }}>{Math.round(c.similarity * 100)}%</span>
        </a>
      ))}
    </div>
  );
}

function FrameworkPanel({ frameworkKey, result, verification }) {
  const isInsufficient = result.text?.trim() === "Insufficient grounded data available for this section.";
  const verified = verification?.verified ?? false;

  return (
    <div className="rounded-2xl p-6" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 34, height: 34, background: PALETTE.bgPanel, border: `1px solid ${PALETTE.border}`, color: PALETTE.blue }}>
            <Layers size={17} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.textMuted }}>Framework</div>
            <h2 className="text-xl font-extrabold text-white">{FRAMEWORK_LABELS[frameworkKey] || frameworkKey.toUpperCase()}</h2>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
          style={{ color: verified ? PALETTE.teal : PALETTE.amber, border: `1px solid ${verified ? PALETTE.teal : PALETTE.amber}` }}>
          {verified ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {verified ? "Verified" : "Unverified"}
        </span>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: isInsufficient ? PALETTE.textMuted : "#e4e9f5", fontStyle: isInsufficient ? "italic" : "normal" }}>
        {result.text}
      </p>

      {verification?.unsupported_claims?.length > 0 && (
        <div className="flex items-center gap-2 mt-4 text-xs px-3 py-2 rounded-lg" style={{ color: PALETTE.amber, background: `${PALETTE.amber}14`, border: `1px solid ${PALETTE.amber}44` }}>
          <AlertTriangle size={13} /> {verification.unsupported_claims.join(", ")}
        </div>
      )}
    </div>
  );
}

export default function ReportView({ report, idea, onReset }) {
  const stats = useReportStats(report);
  const [activeFramework, setActiveFramework] = useState(stats.frameworks[0] || null);

  if (!report) return null;

  const activeResult = activeFramework ? report.results[activeFramework] : null;
  const activeVerification = activeFramework ? report.verification?.[activeFramework] : null;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const title = idea ? (idea.length > 52 ? idea.slice(0, 52) + "…" : idea) : "Business Idea Analysis";

  return (
    <div className="flex min-h-screen w-full overflow-hidden" style={{ background: PALETTE.bgOuter, fontFamily: "'Inter', sans-serif" }}>
      <aside className="flex flex-col w-[236px] min-h-screen py-5 px-3 shrink-0" style={{ background: PALETTE.bgSidebar, borderRight: `1px solid ${PALETTE.border}` }}>
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${PALETTE.blue}, ${PALETTE.purple})` }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 2L16 14H2L9 2Z" fill="white" fillOpacity="0.9" /></svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">Groundly</div>
            <div className="text-[9px] leading-tight" style={{ color: PALETTE.textMuted }}>AI Analysis Platform</div>
          </div>
        </div>

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

        <VerdictBanner stats={stats} />
        <MetricRow report={report} stats={stats} />

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 320px" }}>
          <div>{activeResult && <FrameworkPanel frameworkKey={activeFramework} result={activeResult} verification={activeVerification} />}</div>

          <div className="flex flex-col gap-3.5">
            <div className="rounded-2xl p-4" style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}>
              <div className="flex items-center justify-between text-sm font-bold text-white mb-3">
                <span>Sources & Citations</span>
                <span className="text-[11px] font-medium" style={{ color: PALETTE.blue }}>View all ({stats.totalCitations})</span>
              </div>
              <CitationList citations={activeResult?.citations} />
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
