import {
  AlertTriangle,
  Boxes,
  Building2,
  Cog,
  Cpu,
  DollarSign,
  DoorOpen,
  FlaskConical,
  Gift,
  GraduationCap,
  Handshake,
  Headset,
  Heart,
  Landmark,
  Layers,
  Leaf,
  Lightbulb,
  MapPin,
  Megaphone,
  Receipt,
  Scale,
  ShieldAlert,
  ShoppingCart,
  Shuffle,
  Swords,
  Target,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Warehouse,
  Workflow,
  Zap,
} from "lucide-react";
import { computeShareOfParentPct } from "../../lib/reportStats";
import { formatUsdCompact, normalizeMarketSizing } from "../../lib/marketSizing";
import type {
  FrameworkKey,
  FrameworkResult,
  MarketSizing,
  StructuredPoint,
} from "../../types/groundly";

interface CitationClickProps {
  onSelectCitation?: (citationIndex: number, frameworkKey?: string) => void;
  frameworkKey?: string;
}

export function CitationChip({
  index,
  onSelectCitation,
  frameworkKey,
}: {
  index: number | null | undefined;
  onSelectCitation?: (citationIndex: number, frameworkKey?: string) => void;
  frameworkKey?: string;
}) {
  if (index == null) return null;
  return (
    <button
      type="button"
      onClick={() => onSelectCitation?.(index, frameworkKey)}
      title={`Jump to source [${index}]`}
      className="ml-1 inline-flex items-center rounded px-1 py-0.5 font-mono text-[11px] font-semibold text-[#60a5fa] transition-colors hover:bg-[#4a8fff]/20 hover:text-white"
    >
      [{index}]
    </button>
  );
}

export function renderTextWithInlineCitations(
  text: string,
  onSelectCitation?: (citationIndex: number, frameworkKey?: string) => void,
  frameworkKey?: string,
) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, idx) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const num = Number(match[1]);
      return (
        <CitationChip
          key={idx}
          index={num}
          onSelectCitation={onSelectCitation}
          frameworkKey={frameworkKey}
        />
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function StructuredPointList({
  items,
  onSelectCitation,
  frameworkKey,
  showMetrics = false,
}: {
  items?: StructuredPoint[];
  onSelectCitation?: (citationIndex: number, frameworkKey?: string) => void;
  frameworkKey?: string;
  showMetrics?: boolean;
}) {
  if (!items || items.length === 0) {
    return (
      <p className="text-xs italic text-slate-500">
        No grounded points recorded for this dimension.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const cleanText = item.text.replace(/\s*\[\d+\](\.?)\s*$/g, "$1");
        return (
          <li
            key={i}
            className="flex items-start gap-2 text-xs leading-relaxed text-slate-200"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60a5fa]/70" />
            <div className="min-w-0 flex-1">
              <span>{cleanText}</span>
              <CitationChip
                index={item.citation_index}
                onSelectCitation={onSelectCitation}
                frameworkKey={frameworkKey}
              />
              {showMetrics && item.metric_value != null && (
                <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-[#14d8a3] tabular-nums">
                  <span>
                    {item.metric_name}: {item.metric_value}
                  </span>
                  {item.target_value != null && (
                    <span className="text-slate-400">
                      → Target {item.target_value}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Rich TAM / SAM / SOM visualization matching report-ux-mock.png:
 * Left: Overlapping glowing concentric circles + color legend
 * Right: Structured table (Metric | Value (USD) | % of Parent | CAGR | Source)
 * Bottom: Key Takeaway + Top Citations bar
 */
export function TamConcentricDiagram({
  marketSizing,
  result,
  onSelectCitation,
}: {
  marketSizing: MarketSizing;
  result?: FrameworkResult;
  onSelectCitation?: (citationIndex: number, frameworkKey?: string) => void;
}) {
  const normalizedSizing = normalizeMarketSizing(marketSizing) || marketSizing;
  const tam = normalizedSizing.tam;
  const sam = normalizedSizing.sam;
  const som = normalizedSizing.som;

  // The backend always sends a tier object now, even when unsupported --
  // {"value_usd": null, "label": "Not found in sources", ...} -- so
  // `label` truthiness is no longer a valid "is this tier real" check
  // (it's always a non-empty string). value_usd is the one field that's
  // actually null exactly when there's no real grounded figure.
  const hasRealValue = (tier?: typeof tam) => typeof tier?.value_usd === "number" && tier.value_usd > 0;

  const formatRingValue = (tier?: typeof tam) => {
    if (hasRealValue(tier)) {
      return formatUsdCompact(tier!.value_usd);
    }
    return "Not found";
  };

  const samPct = computeShareOfParentPct(sam?.value_usd, tam?.value_usd);
  const somPct = computeShareOfParentPct(som?.value_usd, sam?.value_usd);

  const rows = [
    {
      key: "TAM",
      subtitle: "Total Addressable Market",
      tier: tam,
      color: "#4a8fff",
      pctParent: "—",
    },
    {
      key: "SAM",
      subtitle: "Serviceable Available Market",
      tier: sam,
      color: "#818cf8",
      pctParent: samPct || "—",
    },
    {
      key: "SOM",
      subtitle: "Serviceable Obtainable Market (3-Yr)",
      tier: som,
      color: "#14d8a3",
      pctParent: somPct || "—",
    },
  ];

  const topCitations = (result?.citations || []).slice(0, 3);
  // "Key Takeaway" used to always fall through to a hardcoded sentence
  // ("Bottom-up serviceable sizing isolates your realistic 3-year
  // wedge.") on every single report, since MarketTier.note is a legacy
  // field the backend never actually populates -- confirmed dead code,
  // not a real fallback. Real content instead: the narrative's own
  // first sentence (same text the Summary tab already shows, just
  // truncated to one line), stripped of its [N] markers since this is
  // a short-form card, not the full cited narrative. Hidden entirely
  // when there's no real narrative to pull from, rather than inventing
  // one.
  const takeaway = (() => {
    const text = (result?.text || "").trim();
    if (!text || text.startsWith("Insufficient grounded data")) return null;
    const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
    return firstSentence ? firstSentence.replace(/\s*\[\d+\]/g, "").trim() : null;
  })();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-center">
        {/* Left Concentric Diagram + Legend */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center xl:col-span-5">
          <svg
            viewBox="0 0 264 264"
            className="h-60 w-60 shrink-0"
            role="img"
            aria-label="Nested TAM SAM SOM market sizing diagram"
          >
            <defs>
              <radialGradient id="tamGrad" cx="50%" cy="35%" r="72%">
                <stop offset="0%" stopColor="#4a8fff" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.14" />
              </radialGradient>
              <radialGradient id="samGrad" cx="50%" cy="35%" r="72%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#4338ca" stopOpacity="0.18" />
              </radialGradient>
              <radialGradient id="somGrad" cx="50%" cy="35%" r="72%">
                <stop offset="0%" stopColor="#14d8a3" stopOpacity="0.52" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.24" />
              </radialGradient>
            </defs>

            {/* TAM Outer Ring */}
            <circle
              cx="132"
              cy="132"
              r="116"
              fill={hasRealValue(tam) ? "url(#tamGrad)" : "none"}
              stroke="#4a8fff"
              strokeWidth={hasRealValue(tam) ? 2 : 1.5}
              strokeDasharray={hasRealValue(tam) ? undefined : "5 5"}
            />
            <text
              x="132"
              y="42"
              textAnchor="middle"
              className="fill-slate-300 font-mono text-[10px] font-semibold uppercase tracking-wider"
            >
              TAM
            </text>
            <text
              x="132"
              y="60"
              textAnchor="middle"
              className="fill-white font-display text-sm font-extrabold"
            >
              {formatRingValue(tam)}
            </text>

            {/* SAM Middle Ring */}
            <circle
              cx="132"
              cy="160"
              r="82"
              fill={hasRealValue(sam) ? "url(#samGrad)" : "none"}
              stroke="#818cf8"
              strokeWidth={hasRealValue(sam) ? 2 : 1.5}
              strokeDasharray={hasRealValue(sam) ? undefined : "5 5"}
            />
            <text
              x="132"
              y="102"
              textAnchor="middle"
              className="fill-slate-200 font-mono text-[10px] font-semibold uppercase tracking-wider"
            >
              SAM
            </text>
            <text
              x="132"
              y="120"
              textAnchor="middle"
              className="fill-white font-display text-sm font-extrabold"
            >
              {formatRingValue(sam)}
            </text>

            {/* SOM Core Ring */}
            <circle
              cx="132"
              cy="189"
              r="47"
              fill={hasRealValue(som) ? "url(#somGrad)" : "none"}
              stroke="#14d8a3"
              strokeWidth={hasRealValue(som) ? 2.2 : 1.5}
              strokeDasharray={hasRealValue(som) ? undefined : "5 5"}
            />
            <text
              x="132"
              y="182"
              textAnchor="middle"
              className="fill-[#6ee7b7] font-mono text-[10px] font-semibold uppercase tracking-wider"
            >
              SOM
            </text>
            <text
              x="132"
              y="202"
              textAnchor="middle"
              className="fill-white font-display text-sm font-extrabold"
            >
              {formatRingValue(som)}
            </text>
          </svg>

          <div className="space-y-3 text-xs">
            {rows.map((r) => (
              <div key={r.key} className="max-w-[190px]">
                <div className="flex items-center gap-2 font-display font-bold text-white">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span>{r.key}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                  {r.tier?.tier_description || r.tier?.note || r.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Financial Table */}
        <div className="surface-subpanel overflow-x-auto rounded-xl xl:col-span-7">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800/90 bg-[#0b152c]/90 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Metric</th>
                <th className="px-3 py-3 text-right">Value (USD)</th>
                <th className="px-3 py-3 text-right">% of Parent</th>
                <th className="px-3 py-3 text-right">CAGR</th>
                <th className="px-4 py-3 text-right">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-[#101c3a]/40">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 font-display text-xs font-bold text-white">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      {r.key}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {r.subtitle}
                    </p>
                  </td>
                  <td className="px-3 py-3.5 text-right font-display text-sm font-extrabold text-white tabular-nums">
                    {r.tier?.label || "Unverified"}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs text-slate-300 tabular-nums">
                    {r.pctParent}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs font-semibold text-[#14d8a3] tabular-nums">
                    {r.tier?.cagr_pct != null ? `${r.tier.cagr_pct}%` : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {r.tier?.citation_index != null ? (
                      <CitationChip
                        index={r.tier.citation_index}
                        onSelectCitation={onSelectCitation}
                        frameworkKey="tam"
                      />
                    ) : (
                      <span className="font-mono text-[11px] text-slate-500">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Takeaway & Top Citations Bar matching report-ux-mock.png */}
      {(takeaway || topCitations.length > 0) && (
        <div className="surface-subpanel flex flex-col gap-3 rounded-xl px-4 py-3.5 md:flex-row md:items-center md:justify-between">
          {takeaway && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#22f59d]">
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Key Takeaway</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {takeaway}
              </p>
            </div>
          )}
          {topCitations.length > 0 && (
            <div className="shrink-0">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Top Citations
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topCitations.map((c) => (
                  <button
                    key={c.index}
                    type="button"
                    onClick={() => onSelectCitation?.(c.index, "tam")}
                    className="rounded-lg border border-slate-700/80 bg-[#0b152c] px-2.5 py-1 font-mono text-[11px] text-[#93c5fd] transition-colors hover:border-[#4a8fff] hover:text-white"
                  >
                    [{c.index}] {c.source_title.split("—")[0]?.trim().slice(0, 22)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PorterRadarAndForces({
  porterForces,
  onSelectCitation,
}: {
  porterForces: Record<string, StructuredPoint[]>;
  onSelectCitation?: (citationIndex: number, frameworkKey?: string) => void;
}) {
  // Each force's "pressure" here used to be a hardcoded percentage
  // (78/62/56/70/68, or a 30 fallback) keyed only on whether the backend
  // returned any points for that force at all -- a fixed lookup table
  // dressed up as a real score, rendered as a confident-looking radar
  // chart. There is no real numeric pressure score anywhere in the
  // backend's output (StructuredPoint[] is just cited text), so rather
  // than invent one, this renders the five forces as what they actually
  // are: real, cited findings per force, with presence (has the backend
  // returned anything for this force) as the only honest signal.
  const blocks = [
    { key: "competitive_rivalry", label: "Competitive Rivalry", color: "#f05252", Icon: Swords },
    { key: "threat_of_new_entrants", label: "New Entrants", color: "#f5b041", Icon: DoorOpen },
    { key: "bargaining_power_of_suppliers", label: "Supplier Power", color: "#818cf8", Icon: Truck },
    { key: "bargaining_power_of_buyers", label: "Buyer Power", color: "#4a8fff", Icon: Users },
    { key: "threat_of_substitutes", label: "Substitutes", color: "#14d8a3", Icon: Shuffle },
  ];

  return (
    <div className="space-y-3">
      {blocks.map((b) => {
        const present = Boolean(porterForces[b.key]?.length);
        return (
          <div key={b.key} className="surface-subpanel rounded-xl p-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: b.color }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${b.color}1e` }}
                >
                  <b.Icon className="h-3.5 w-3.5" />
                </span>
                {b.label}
              </div>
              {!present && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  No data found
                </span>
              )}
            </div>
            <StructuredPointList
              items={porterForces[b.key]}
              onSelectCitation={onSelectCitation}
              frameworkKey="porter"
            />
          </div>
        );
      })}
    </div>
  );
}

export function FrameworkDiagramBody({
  frameworkKey,
  result,
  onSelectCitation,
}: {
  frameworkKey: FrameworkKey;
  result: FrameworkResult;
} & CitationClickProps) {
  if (frameworkKey === "tam" && result.market_sizing) {
    return (
      <TamConcentricDiagram
        marketSizing={result.market_sizing}
        result={result}
        onSelectCitation={onSelectCitation}
      />
    );
  }

  if (frameworkKey === "porter" && result.porter_forces) {
    return (
      <PorterRadarAndForces
        porterForces={result.porter_forces}
        onSelectCitation={onSelectCitation}
      />
    );
  }

  if (frameworkKey === "pestel" && result.pestel_analysis) {
    const pillars = [
      { key: "political", label: "Political", color: "#4a8fff", Icon: Landmark },
      { key: "economic", label: "Economic", color: "#14d8a3", Icon: TrendingUp },
      { key: "social", label: "Social", color: "#818cf8", Icon: Users },
      { key: "technological", label: "Technological", color: "#38bdf8", Icon: Cpu },
      { key: "environmental", label: "Environmental", color: "#f5b041", Icon: Leaf },
      { key: "legal", label: "Legal", color: "#f05252", Icon: Scale },
    ];
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {pillars.map((p) => (
          <div key={p.key} className="surface-subpanel rounded-xl p-4">
            <div
              className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: p.color }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${p.color}20` }}
              >
                <p.Icon className="h-3.5 w-3.5" />
              </span>
              {p.label}
            </div>
            <StructuredPointList
              items={result.pestel_analysis?.[p.key]}
              onSelectCitation={onSelectCitation}
              frameworkKey="pestel"
            />
          </div>
        ))}
      </div>
    );
  }

  if (frameworkKey === "swot" && result.swot_analysis) {
    const quadrants = [
      { key: "strengths", label: "Strengths", color: "#14d8a3", Icon: Zap },
      { key: "weaknesses", label: "Weaknesses", color: "#f05252", Icon: AlertTriangle },
      { key: "opportunities", label: "Opportunities", color: "#4a8fff", Icon: Target },
      { key: "threats", label: "Threats", color: "#f5b041", Icon: ShieldAlert },
    ];
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {quadrants.map((q) => (
          <div
            key={q.key}
            className="surface-subpanel rounded-xl p-4"
            style={{ borderColor: `${q.color}36` }}
          >
            <div
              className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: q.color }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${q.color}20` }}
              >
                <q.Icon className="h-3.5 w-3.5" />
              </span>
              {q.label}
            </div>
            <StructuredPointList
              items={result.swot_analysis?.[q.key]}
              onSelectCitation={onSelectCitation}
              frameworkKey="swot"
            />
          </div>
        ))}
      </div>
    );
  }

  if (frameworkKey === "stp" && result.stp_analysis) {
    const cols = [
      { key: "segmentation", label: "01. Segmentation", color: "#4a8fff", Icon: Layers },
      { key: "targeting", label: "02. Targeting", color: "#818cf8", Icon: Target },
      { key: "positioning", label: "03. Positioning", color: "#14d8a3", Icon: MapPin },
    ];
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.key} className="surface-subpanel rounded-xl p-4">
            <div
              className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: c.color }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${c.color}20` }}
              >
                <c.Icon className="h-3.5 w-3.5" />
              </span>
              {c.label}
            </div>
            <StructuredPointList
              items={result.stp_analysis?.[c.key]}
              onSelectCitation={onSelectCitation}
              frameworkKey="stp"
            />
          </div>
        ))}
      </div>
    );
  }

  if (frameworkKey === "bcg" && result.bcg_matrix) {
    const bcg = result.bcg_matrix;
    const cells = [
      { key: "question_mark", label: "Question Mark", color: "#f5b041", hint: "High growth · Low share" },
      { key: "star", label: "Star", color: "#14d8a3", hint: "High growth · High share" },
      { key: "dog", label: "Dog", color: "#f05252", hint: "Low growth · Low share" },
      { key: "cash_cow", label: "Cash Cow", color: "#4a8fff", hint: "Low growth · High share" },
    ];
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <div className="md:col-span-6">
          <div className="grid grid-cols-2 gap-2.5">
            {cells.map((cell) => {
              const active = bcg.quadrant === cell.key;
              return (
                <div
                  key={cell.key}
                  className="flex min-h-[96px] flex-col items-center justify-center rounded-xl p-3 text-center transition-colors"
                  style={
                    active
                      ? {
                          backgroundColor: `${cell.color}22`,
                          border: `1.5px solid ${cell.color}`,
                          boxShadow: `0 0 24px -10px ${cell.color}`,
                        }
                      : {
                          backgroundColor: "#060c1a",
                          border: "1px dashed rgba(148,176,235,0.2)",
                          opacity: 0.55,
                        }
                  }
                >
                  <span
                    className="font-display text-xs font-bold uppercase tracking-wide"
                    style={{ color: active ? cell.color : "#94a3b8" }}
                  >
                    {cell.label}
                  </span>
                  <span className="mt-1 text-[11px] text-slate-400">
                    {cell.hint}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-500">
            <span>← Low Share</span>
            <span>High Share →</span>
          </div>
        </div>
        <div className="surface-subpanel space-y-3 rounded-xl p-4 md:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs text-slate-400">Market Growth Rate</span>
            <span className="font-mono text-sm font-bold text-[#14d8a3] tabular-nums">
              {bcg.market_growth_rate_pct != null
                ? `${bcg.market_growth_rate_pct}%`
                : "N/A"}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-400">Share Position</span>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {bcg.market_share_position || "Emerging entrant"}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">
            {bcg.rationale}
            <CitationChip
              index={bcg.citation_index}
              onSelectCitation={onSelectCitation}
              frameworkKey="bcg"
            />
          </p>
        </div>
      </div>
    );
  }

  if (frameworkKey === "ansoff" && result.ansoff_matrix) {
    const ansoff = result.ansoff_matrix;
    const cells = [
      { key: "market_penetration", label: "Market Penetration", hint: "Existing Product · Existing Market", color: "#14d8a3" },
      { key: "product_development", label: "Product Development", hint: "New Product · Existing Market", color: "#4a8fff" },
      { key: "market_development", label: "Market Development", hint: "Existing Product · New Market", color: "#818cf8" },
      { key: "diversification", label: "Diversification", hint: "New Product · New Market", color: "#f5b041" },
    ];
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <div className="grid grid-cols-2 gap-2.5 md:col-span-6">
          {cells.map((cell) => {
            const active = ansoff.quadrant === cell.key;
            return (
              <div
                key={cell.key}
                className="flex min-h-[96px] flex-col items-center justify-center rounded-xl p-3 text-center"
                style={
                  active
                    ? {
                        backgroundColor: `${cell.color}22`,
                        border: `1.5px solid ${cell.color}`,
                        boxShadow: `0 0 24px -10px ${cell.color}`,
                      }
                    : {
                        backgroundColor: "#060c1a",
                        border: "1px dashed rgba(148,176,235,0.2)",
                        opacity: 0.55,
                      }
                }
              >
                <span
                  className="font-display text-xs font-bold uppercase tracking-wide"
                  style={{ color: active ? cell.color : "#94a3b8" }}
                >
                  {cell.label}
                </span>
                <span className="mt-1 text-[11px] text-slate-400">
                  {cell.hint}
                </span>
              </div>
            );
          })}
        </div>
        <div className="surface-subpanel space-y-3 rounded-xl p-4 md:col-span-6">
          <div>
            <span className="text-xs text-slate-400">Market Dimension</span>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {ansoff.market_dimension}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Product Dimension</span>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {ansoff.product_dimension}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-300">
            {ansoff.rationale}
            <CitationChip
              index={ansoff.citation_index}
              onSelectCitation={onSelectCitation}
              frameworkKey="ansoff"
            />
          </p>
        </div>
      </div>
    );
  }

  if (frameworkKey === "value_chain" && result.value_chain) {
    const support = [
      { key: "firm_infrastructure", label: "Firm Infrastructure", Icon: Building2 },
      { key: "human_resource_management", label: "HR & Talent", Icon: UserCog },
      { key: "technology_development", label: "Tech & R&D", Icon: FlaskConical },
      { key: "procurement", label: "Procurement", Icon: ShoppingCart },
    ];
    const primary = [
      { key: "inbound_logistics", label: "Inbound Supply", Icon: Warehouse },
      { key: "operations", label: "Core Operations", Icon: Cog },
      { key: "outbound_logistics", label: "Delivery", Icon: Truck },
      { key: "marketing_and_sales", label: "GTM & Sales", Icon: Megaphone },
      { key: "service", label: "Customer Service", Icon: Headset },
    ];
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Support Infrastructure
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {support.map((s) => (
              <div key={s.key} className="surface-subpanel rounded-xl p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#a5b4fc]">
                  <s.Icon className="h-3.5 w-3.5" />
                  {s.label}
                </div>
                <StructuredPointList
                  items={result.value_chain?.[s.key]}
                  onSelectCitation={onSelectCitation}
                  frameworkKey="value_chain"
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Primary Value Sequence →
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {primary.map((p) => (
              <div
                key={p.key}
                className="surface-subpanel rounded-xl p-3.5"
                style={{ borderColor: "rgba(20, 216, 163, 0.25)" }}
              >
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#14d8a3]">
                  <p.Icon className="h-3.5 w-3.5" />
                  {p.label}
                </div>
                <StructuredPointList
                  items={result.value_chain?.[p.key]}
                  onSelectCitation={onSelectCitation}
                  frameworkKey="value_chain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (frameworkKey === "bmc" && result.bmc_canvas) {
    const blocks = [
      { key: "key_partners", label: "Key Partners", color: "#818cf8", Icon: Handshake },
      { key: "key_activities", label: "Key Activities", color: "#f5b041", Icon: Zap },
      { key: "value_propositions", label: "Value Propositions", color: "#14d8a3", Icon: Gift },
      { key: "key_resources", label: "Key Resources", color: "#60a5fa", Icon: Boxes },
      { key: "customer_relationships", label: "Customer Relationships", color: "#f05252", Icon: Heart },
      { key: "customer_segments", label: "Customer Segments", color: "#4a8fff", Icon: Users },
      { key: "channels", label: "Channels", color: "#38bdf8", Icon: Truck },
    ];
    const financials = [
      { key: "cost_structure", label: "Cost Structure", color: "#f5b041", Icon: Receipt },
      { key: "revenue_streams", label: "Revenue Streams", color: "#14d8a3", Icon: DollarSign },
    ];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {blocks.map((b) => (
            <div
              key={b.key}
              className="surface-subpanel rounded-xl p-3.5"
              style={
                b.key === "value_propositions"
                  ? { borderColor: "rgba(20, 216, 163, 0.35)" }
                  : undefined
              }
            >
              <div
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: b.color }}
              >
                <b.Icon className="h-3.5 w-3.5" />
                {b.label}
              </div>
              <StructuredPointList
                items={result.bmc_canvas?.[b.key]}
                onSelectCitation={onSelectCitation}
                frameworkKey="bmc"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {financials.map((b) => (
            <div key={b.key} className="surface-subpanel rounded-xl p-3.5">
              <div
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: b.color }}
              >
                <b.Icon className="h-3.5 w-3.5" />
                {b.label}
              </div>
              <StructuredPointList
                items={result.bmc_canvas?.[b.key]}
                onSelectCitation={onSelectCitation}
                frameworkKey="bmc"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (frameworkKey === "balanced_scorecard" && result.balanced_scorecard) {
    const perspectives = [
      { key: "financial", label: "Financial", color: "#14d8a3", Icon: DollarSign },
      { key: "customer", label: "Customer", color: "#4a8fff", Icon: Users },
      { key: "internal_process", label: "Internal Process", color: "#818cf8", Icon: Workflow },
      { key: "learning_and_growth", label: "Learning & Growth", color: "#f5b041", Icon: GraduationCap },
    ];
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {perspectives.map((p) => (
          <div key={p.key} className="surface-subpanel rounded-xl p-4">
            <div
              className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: p.color }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${p.color}20` }}
              >
                <p.Icon className="h-3.5 w-3.5" />
              </span>
              {p.label}
            </div>
            <StructuredPointList
              items={result.balanced_scorecard?.[p.key]}
              onSelectCitation={onSelectCitation}
              frameworkKey="balanced_scorecard"
              showMetrics
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-slate-300">
      {renderTextWithInlineCitations(result.text, onSelectCitation, frameworkKey)}
    </p>
  );
}
