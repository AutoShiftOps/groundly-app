import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FolderOpen,
  Layers,
  Lightbulb,
  PieChart,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { relativeTime } from "../../lib/projectsStore";
import {
  computeEvidenceScore,
  computeReportStats,
  type VerdictTone,
} from "../../lib/reportStats";
import type { SavedProject } from "../../types/groundly";
import { TamConcentricDiagram } from "../report/FrameworkDiagrams";
import { BUSINESS_METRIC_CARDS, FRAMEWORK_NAV_ITEMS } from "../report/frameworkMeta";

const TONE_HEX: Record<VerdictTone, string> = {
  teal: "#22f59d",
  amber: "#ffc142",
  red: "#f05252",
};

function MiniVerifiedArc({
  verified,
  total,
  color,
}: {
  verified: number;
  total: number;
  color: string;
}) {
  const pct = total ? (verified / total) * 100 : 0;
  const size = 46;
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(148,176,235,0.14)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-bold text-white tabular-nums">
        {verified}/{total}
      </span>
    </div>
  );
}

export function ProjectsScreen({
  projects,
  onOpenProject,
  onDeleteProject,
  onNewAnalysis,
}: {
  projects: SavedProject[];
  onOpenProject: (project: SavedProject) => void;
  onDeleteProject: (projectId: string) => void;
  onNewAnalysis: () => void;
}) {
  // Verified frameworks out of 10, averaged across projects (each
  // project's verified/total share scaled to 10), e.g. "6.5/10".
  const avgVerifiedOf10 = projects.length
    ? Number(
        (
          projects.reduce((sum, p) => sum + computeReportStats(p.report).verifiedPct, 0) /
          projects.length /
          10
        ).toFixed(1),
      )
    : null;
  const totalCitations = projects.reduce(
    (sum, p) => sum + computeReportStats(p.report).totalCitations,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[#60a5fa]">
            Venture Portfolio
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-white">
            Saved Projects
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Completed 10-framework validations stored in your workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewAnalysis}
          className="btn-primary-glow inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          New Analysis
        </button>
      </div>

      {/* Portfolio Summary Row */}
      {projects.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="surface-panel flex items-center gap-3.5 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4a8fff]/40 bg-[#4a8fff]/15 text-[#60a5fa]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Saved Analyses</p>
              <p className="font-display text-2xl font-extrabold text-white tabular-nums">
                {projects.length}
              </p>
            </div>
          </div>
          <div className="surface-panel flex items-center gap-3.5 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#22f59d]/40 bg-[#22f59d]/15 text-[#22f59d]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Avg verified</p>
              <p className="font-display text-2xl font-extrabold text-[#22f59d] tabular-nums">
                {avgVerifiedOf10 === null ? "—" : `${avgVerifiedOf10}/10`}
              </p>
            </div>
          </div>
          <div className="surface-panel flex items-center gap-3.5 rounded-2xl p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#818cf8]/40 bg-[#818cf8]/15 text-[#a5b4fc]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Grounded Citations Indexed</p>
              <p className="font-display text-2xl font-extrabold text-white tabular-nums">
                {totalCitations}
              </p>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="surface-panel flex flex-col items-center rounded-2xl px-6 py-16 text-center">
          <FolderOpen className="h-9 w-9 text-slate-500" />
          <p className="mt-3 font-display text-lg font-bold text-white">
            No saved projects yet
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Run a new idea validation to generate a grounded strategic report.
          </p>
          <button
            type="button"
            onClick={onNewAnalysis}
            className="btn-primary-glow mt-5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
          >
            Analyze an Idea
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const stats = computeReportStats(p.report);
            const color = TONE_HEX[stats.tone];
            const tamLabel = p.report.results?.tam?.market_sizing?.tam?.label;
            const somLabel = p.report.results?.tam?.market_sizing?.som?.label;
            return (
              <div
                key={p.id}
                className="surface-panel surface-interactive flex flex-col justify-between rounded-2xl p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <MiniVerifiedArc
                        verified={stats.verifiedCount}
                        total={stats.totalFrameworks}
                        color={color}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                          <span style={{ color }} className="font-semibold">
                            {stats.verdictShort}
                          </span>
                          {p.industry && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{p.industry}</span>
                            </>
                          )}
                        </div>
                        <h2 className="mt-0.5 font-display text-lg font-bold text-white">
                          {p.title}
                        </h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(p.id)}
                      aria-label={`Delete ${p.title}`}
                      className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-[#f05252]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-400">
                    {p.idea}
                  </p>

                  <div className="surface-subpanel mt-4 grid grid-cols-3 gap-2 rounded-xl p-3 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400">Verified</p>
                      <p className="mt-0.5 font-mono text-xs font-bold text-white tabular-nums">
                        {stats.verifiedCount}/{stats.totalFrameworks}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Citations</p>
                      <p className="mt-0.5 font-mono text-xs font-bold text-[#60a5fa] tabular-nums">
                        {stats.totalCitations}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">TAM / SOM</p>
                      <p className="mt-0.5 truncate font-mono text-xs font-bold text-[#22f59d] tabular-nums">
                        {tamLabel || "—"}
                        {somLabel ? ` · ${somLabel}` : ""}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <span className="text-[11px] text-slate-500">
                    {relativeTime(p.createdAt)} · {p.versionLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenProject(p)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#60a5fa] hover:text-white"
                  >
                    Open Report
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MarketScreen({
  project,
  projects,
  onNewAnalysis,
  onOpenReport,
}: {
  project: SavedProject | null;
  projects?: SavedProject[];
  onNewAnalysis: () => void;
  onOpenReport: () => void;
}) {
  const available = projects && projects.length > 0 ? projects : project ? [project] : [];
  const [selectedId, setSelectedId] = useState<string>(project?.id || available[0]?.id || "");
  const activeProj =
    available.find((p) => p.id === selectedId) || project || available[0] || null;
  const tamResult = activeProj?.report.results?.tam;
  const sizing = tamResult?.market_sizing;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-[#22f59d]">
            Bottom-Up Opportunity Model
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-white">
            Market Sizing Explorer
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {activeProj
              ? `TAM, SAM, and SOM breakdown for ${activeProj.title}.`
              : "Run an analysis to inspect bottom-up market sizing."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {available.length > 1 && (
            <div className="surface-subpanel flex items-center gap-1 rounded-lg p-1">
              {available.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeProj?.id === p.id
                      ? "bg-[#4a8fff] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          )}

          {activeProj && (
            <button
              type="button"
              onClick={onOpenReport}
              className="btn-primary-glow inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white"
            >
              Open Full Report
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {!sizing ? (
        <div className="surface-panel flex flex-col items-center rounded-2xl px-6 py-16 text-center">
          <PieChart className="h-9 w-9 text-slate-500" />
          <p className="mt-3 font-display text-lg font-bold text-white">
            No market sizing active
          </p>
          <button
            type="button"
            onClick={onNewAnalysis}
            className="btn-primary-glow mt-5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
          >
            Analyze an Idea
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { label: "Total Addressable Market (TAM)", tier: sizing.tam, accent: "#4a8fff" },
              { label: "Serviceable Available Market (SAM)", tier: sizing.sam, accent: "#818cf8" },
              { label: "Serviceable Obtainable Market (SOM)", tier: sizing.som, accent: "#22f59d" },
            ].map((item) => (
              <div
                key={item.label}
                className="surface-panel rounded-2xl p-5"
                style={{ borderColor: `${item.accent}44` }}
              >
                <p className="text-xs text-slate-400">{item.label}</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span
                    className="font-display text-3xl font-extrabold tabular-nums"
                    style={{ color: item.accent }}
                  >
                    {item.tier?.label || "Unverified"}
                  </span>
                  {item.tier?.cagr_pct != null && (
                    <span className="font-mono text-xs font-semibold text-[#22f59d] tabular-nums">
                      {item.tier.cagr_pct}% CAGR
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {item.tier?.note || "No grounded annotation provided."}
                </p>
              </div>
            ))}
          </div>

          <div className="surface-panel rounded-2xl p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-white">
              Concentric Market Funnel & Growth Table
            </h2>
            <TamConcentricDiagram
              marketSizing={sizing}
              result={tamResult}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function InsightsScreen({
  projects,
  onOpenProject,
}: {
  projects: SavedProject[];
  onOpenProject: (p: SavedProject) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-6 border-b border-slate-800/80 pb-5">
        <p className="font-mono text-xs uppercase tracking-wider text-[#a5b4fc]">
          Decision Signal Comparison
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-white">
          Cross-Venture Insights
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Synthesized competitive, customer, and risk signals across your saved
          analyses.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="surface-panel flex flex-col items-center rounded-2xl px-6 py-16 text-center">
          <Lightbulb className="h-9 w-9 text-slate-500" />
          <p className="mt-3 font-display text-lg font-bold text-white">
            No insights recorded yet
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((p) => {
            const stats = computeReportStats(p.report);
            const toneColor = TONE_HEX[stats.tone];
            return (
              <section key={p.id} className="surface-panel rounded-2xl p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                  <div className="flex items-center gap-3.5">
                    <MiniVerifiedArc
                      verified={stats.verifiedCount}
                      total={stats.totalFrameworks}
                      color={toneColor}
                    />
                    <div>
                      <h2 className="font-display text-lg font-bold text-white">
                        {p.title}
                      </h2>
                      <p className="text-xs text-slate-400">
                        <span style={{ color: toneColor }} className="font-semibold">
                          {stats.verdict}
                        </span>{" "}
                        · {stats.verifiedCount}/{stats.totalFrameworks} verified · {stats.totalCitations} citations
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenProject(p)}
                    className="surface-subpanel inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#60a5fa] hover:border-[#4a8fff] hover:text-white"
                  >
                    View Report
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
                  {BUSINESS_METRIC_CARDS.map((card) => {
                    const m = p.report.business_metrics?.[card.key];
                    const score = computeEvidenceScore(m, p.report);
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.key}
                        className="surface-subpanel flex flex-col justify-between rounded-xl p-3.5"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                              style={{
                                backgroundColor: `${card.accent}20`,
                                color: card.accent,
                              }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <p
                              className="text-[11px] font-semibold"
                              style={{ color: card.accent }}
                            >
                              {card.label}
                            </p>
                          </div>
                          <p className="mt-2 font-display text-xs font-bold text-white">
                            {m?.label || "Pending"}
                          </p>
                          <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-400">
                            {m?.rationale || "No synthesis recorded."}
                          </p>
                        </div>
                        {score != null && (
                          <div className="mt-2.5 border-t border-slate-800/80 pt-2">
                            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 tabular-nums">
                              <span>Evidence</span>
                              <span style={{ color: card.accent }}>
                                {score.toFixed(1)}/10
                              </span>
                            </div>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, score * 10)}%`,
                                  backgroundColor: card.accent,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  {FRAMEWORK_NAV_ITEMS.slice(0, 6).map((fw) => {
                    const ok = p.report.verification?.[fw.key]?.verified;
                    return (
                      <span
                        key={fw.key}
                        className="inline-flex items-center gap-1"
                      >
                        <CheckCircle2
                          className="h-3 w-3"
                          style={{ color: ok ? "#22f59d" : "#64748b" }}
                        />
                        {fw.label}
                      </span>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
