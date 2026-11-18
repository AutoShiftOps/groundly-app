// Print brochure (feature/print-brochure). PrintBrochureContent is the
// one real layout -- PrintBrochure portals it into document.body as a
// print-only sibling of #root (so Ctrl+P or the Print Report button
// prints the brochure alone, never the on-screen report underneath),
// and BrochurePreview renders the exact same content inline, on
// screen, for the "Brochure View" toggle. Same component either way --
// print and preview can never show different content. Reuses the real
// report components and data -- TamConcentricDiagram,
// FrameworkDiagramBody, renderTextWithInlineCitations, CitationChip,
// FRAMEWORK_NAV_ITEMS order, reportStats, ConfidenceRing -- so nothing
// here can drift from what the on-screen report itself shows. A
// framework with no grounding prints its real empty state, never a
// placeholder; nothing here is sample/invented content.
import { createPortal } from "react-dom";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { ConfidenceRing, TONE_HEX } from "./ReportView";
import {
  CitationChip,
  FrameworkDiagramBody,
  TamConcentricDiagram,
  renderTextWithInlineCitations,
} from "./FrameworkDiagrams";
import { BUSINESS_METRIC_CARDS, FRAMEWORK_NAV_ITEMS } from "./frameworkMeta";
import { FRAMEWORK_NOTES } from "./MethodologyModal";
import { collectAllCitations, computeReportStats } from "../../lib/reportStats";
import type { FrameworkKey, GroundlyReport } from "../../types/groundly";

interface PrintBrochureProps {
  report: GroundlyReport;
  idea: string;
  title: string;
  date: string;
}

// "dark" mirrors the on-screen report; "light" is the Ink saver paper theme.
export type BrochureTheme = "dark" | "light";

const THEME_STORAGE_KEY = "groundly.brochureTheme";
const PRINT_TIP_STORAGE_KEY = "groundly.brochurePrintTipSeen";

export function loadBrochureTheme(): BrochureTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveBrochureTheme(theme: BrochureTheme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode, blocked) -- the choice just won't persist.
  }
}

// Returns true only the first time it's called in this browser.
export function claimPrintTip(): boolean {
  try {
    if (window.localStorage.getItem(PRINT_TIP_STORAGE_KEY)) return false;
    window.localStorage.setItem(PRINT_TIP_STORAGE_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

function themeClass(theme: BrochureTheme | undefined) {
  return theme === "light" ? "brochure-light" : "brochure-dark";
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Generated with Gemini",
  openai: "Generated with OpenAI",
  mixed: "Generated with Gemini and OpenAI (mixed)",
};

// Only these 5 keys are ever real (agents/synthesis.py's
// BUSINESS_METRICS_SCHEMA) -- execution_risk/revenue_potential or any
// other card some earlier mock showed don't exist on the backend and
// must never be invented here.
const REAL_BUSINESS_METRIC_KEYS = [
  "market_size",
  "competitive_pressure",
  "customer_segment",
  "business_model_fit",
  "risk_flags",
] as const;

function factsLine(report: GroundlyReport, fw: string): string | null {
  const v = report.verification?.[fw];
  if (!v || typeof v.facts_total !== "number" || v.facts_total <= 0) return null;
  return `${v.facts_supported ?? 0} of ${v.facts_total} facts supported`;
}

function VerificationBadge({ verified }: { verified?: boolean }) {
  return verified ? (
    <span className="print-badge print-badge-ok">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Verified
    </span>
  ) : (
    <span className="print-badge print-badge-warn">
      <ShieldAlert className="h-3.5 w-3.5" />
      Needs Sourcing
    </span>
  );
}

function SpreadHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="print-spread-header print-keep-with-next">
      <span className="print-spread-kicker">{kicker}</span>
      <h2 className="print-h2">{title}</h2>
    </div>
  );
}

// One framework's real content -- diagram, narrative, badge, fact
// count, or the honest empty state. Used standalone (Market spread)
// and inside the Strategy spread's 2x2 grid; never a different shape
// in either place.
function FrameworkCard({ frameworkKey, report }: { frameworkKey: FrameworkKey; report: GroundlyReport }) {
  const item = FRAMEWORK_NAV_ITEMS.find((i) => i.key === frameworkKey)!;
  const result = report.results?.[frameworkKey];
  const verification = report.verification?.[frameworkKey];
  const facts = factsLine(report, frameworkKey);
  const Icon = item.icon;
  const hasGrounding = Boolean(result?.citations?.length);

  return (
    <div className="print-fw-card" data-framework={frameworkKey}>
      <div className="print-fw-band" style={{ background: item.color }}>
        <Icon className="h-4 w-4 text-white" />
        <span className="print-fw-band-title">{item.label}</span>
        <span className="print-fw-band-badge">
          <VerificationBadge verified={verification?.verified} />
          {facts && <span className="print-verify-facts print-fw-band-facts">{facts}</span>}
        </span>
      </div>

      {!hasGrounding || !result ? (
        <p className="print-empty-state">Couldn't analyze — no grounded sources</p>
      ) : (
        <>
          <p className="print-body-text">{renderTextWithInlineCitations(result.text)}</p>
          <div className="print-diagram-wrap">
            <FrameworkDiagramBody frameworkKey={frameworkKey} result={result} />
          </div>
        </>
      )}
    </div>
  );
}

function EvidenceBarChart({ report }: { report: GroundlyReport }) {
  const items = FRAMEWORK_NAV_ITEMS.filter((item) => report.results?.[item.key]);
  return (
    <div className="print-evidence-chart">
      {items.map((item) => {
        const v = report.verification?.[item.key];
        const total = v?.facts_total ?? 0;
        const supported = v?.facts_supported ?? 0;
        const pct = total > 0 ? Math.round((supported / total) * 100) : 0;
        return (
          <div key={item.key} className="print-evidence-row">
            <span className="print-evidence-label">{item.label}</span>
            <div className="print-evidence-track">
              <div
                className="print-evidence-fill"
                style={{ width: `${pct}%`, background: item.color }}
              />
            </div>
            <span className="print-evidence-count">
              {total > 0 ? `${supported}/${total}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface AggregatedGroup {
  key: string;
  label: string;
  color: string;
  items: string[];
}

// De-duplicates across all 10 frameworks, then groups items by the
// framework(s) they came from -- an item shared by PESTEL and SWOT sits
// under one "PESTEL · SWOT" heading instead of repeating tags per line.
function aggregate(report: GroundlyReport, field: "assumptions" | "actions"): AggregatedGroup[] {
  const byText = new Map<string, { text: string; frameworks: (typeof FRAMEWORK_NAV_ITEMS)[number][] }>();
  for (const item of FRAMEWORK_NAV_ITEMS) {
    const values = report.results?.[item.key]?.[field];
    if (!values) continue;
    for (const raw of values) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const existing = byText.get(key);
      if (existing) {
        if (!existing.frameworks.includes(item)) existing.frameworks.push(item);
      } else {
        byText.set(key, { text: raw.trim(), frameworks: [item] });
      }
    }
  }
  const groups = new Map<string, AggregatedGroup>();
  for (const { text, frameworks } of byText.values()) {
    const key = frameworks.map((f) => f.key).join("+");
    const group = groups.get(key) ?? {
      key,
      label: frameworks.map((f) => f.label).join(" · "),
      color: frameworks[0].color,
      items: [],
    };
    group.items.push(text);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

function CalloutList({ title, groups }: { title: string; groups: AggregatedGroup[] }) {
  return (
    <div className="print-callout-section">
      <p className="print-callout-title print-keep-with-next">{title}</p>
      {groups.length === 0 ? (
        <p className="print-callout-empty">None surfaced.</p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="print-callout-group" data-group={g.key}>
            <p className="print-callout-group-title print-keep-with-next">
              <span className="print-callout-dot" style={{ background: g.color }} />
              {g.label}
            </p>
            <ul className="print-callout-list">
              {g.items.map((text, i) => (
                <li key={i} className="print-callout-item">
                  {text}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function sourceTypeLabel(url: string, similarity: number | null): string {
  if (similarity == null) {
    if (/arcgis\.com/i.test(url)) return "Mississauga Open Data";
    return "Directory";
  }
  return "Web";
}

function CoverAndSummarySpread({ report, idea, title, date }: PrintBrochureProps) {
  const stats = computeReportStats(report);
  const allCitations = collectAllCitations(report);

  return (
    <>
      <section className="print-page print-cover" data-spread="cover">
        <div className="print-cover-inner">
          <div className="print-cover-brand">
            <span className="print-cover-hex" aria-hidden="true">
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none">
                <path d="M10 2L17 6V14L10 18L3 14V6L10 2Z" stroke="currentColor" strokeWidth="1.7" />
                <path d="M10 6.5V10L13.2 11.8" stroke="#34d399" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            Groundly
          </div>
          <h1 className="print-cover-title">{title}</h1>
          <p className="print-cover-idea">{idea}</p>
          <div className="print-cover-meta">
            <span>{date}</span>
            {report.geography && (
              <span>
                {report.geography}
                {report.geography_defaulted ? " (default)" : ""}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="print-page print-spread" data-spread="summary">
        <SpreadHeader kicker="SUMMARY" title="Evidence Verdict" />

        <div className="print-summary-top">
          <ConfidenceRing
            pct={stats.confidencePct}
            tone={stats.tone}
            verifiedCount={stats.verifiedCount}
            totalFrameworks={stats.totalFrameworks}
          />
          <div className="print-summary-verdict">
            <p className="print-summary-verdict-label">{stats.verdict}</p>
            <p className="print-summary-verdict-sub">{stats.verdictSub}</p>
            <p className="print-summary-verdict-meta">
              {allCitations.length} {allCitations.length === 1 ? "source" : "sources"}
            </p>
          </div>
        </div>

        <h3 className="print-h3">Business Metrics</h3>
        <div className="print-metric-grid">
          {BUSINESS_METRIC_CARDS.filter((card) =>
            (REAL_BUSINESS_METRIC_KEYS as readonly string[]).includes(card.key),
          ).map((card) => {
            const metric = report.business_metrics?.[card.key];
            const Icon = card.icon;
            return (
              <div key={card.key} className="print-metric-card" style={{ borderColor: card.accent }}>
                <div className="print-metric-head" style={{ color: card.accent }}>
                  <Icon className="h-4 w-4" />
                  {card.label}
                </div>
                {metric ? (
                  <>
                    <p className="print-metric-label">{metric.label}</p>
                    <p className="print-metric-rationale">
                      {metric.rationale}
                      <CitationChip index={metric.citation_index} />
                    </p>
                  </>
                ) : (
                  <p className="print-metric-empty">Not enough data</p>
                )}
              </div>
            );
          })}
        </div>

        <h3 className="print-h3">Facts Supported by Framework</h3>
        <EvidenceBarChart report={report} />
      </section>
    </>
  );
}

function MarketSpread({ report }: { report: GroundlyReport }) {
  const hasTam = Boolean(report.results?.tam);
  const hasPestel = Boolean(report.results?.pestel);
  const hasPorter = Boolean(report.results?.porter);
  if (!hasTam && !hasPestel && !hasPorter) return null;

  return (
    <section className="print-page print-spread" data-spread="market">
      <SpreadHeader kicker="01 / MARKET" title="Market Sizing &amp; Context" />
      {hasTam && report.results!.tam.market_sizing && (
        <div className="print-fw-card" data-framework="tam">
          <div className="print-fw-band" style={{ background: FRAMEWORK_NAV_ITEMS.find((i) => i.key === "tam")!.color }}>
            <span className="print-fw-band-title">TAM SAM SOM</span>
            <span className="print-fw-band-badge">
              <VerificationBadge verified={report.verification?.tam?.verified} />
              {factsLine(report, "tam") && (
                <span className="print-verify-facts print-fw-band-facts">{factsLine(report, "tam")}</span>
              )}
            </span>
          </div>
          <div className="print-diagram-wrap">
            <TamConcentricDiagram marketSizing={report.results!.tam.market_sizing} result={report.results!.tam} />
          </div>
        </div>
      )}
      {hasPestel && <FrameworkCard frameworkKey="pestel" report={report} />}
      {hasPorter && <FrameworkCard frameworkKey="porter" report={report} />}
    </section>
  );
}

// Full-width rows, not a 2x2 grid: every strategy diagram (SWOT
// quadrants, BCG/Ansoff matrices, STP's three columns) is itself
// multi-column and its labels break mid-word at half width.
function StrategySpread({ report }: { report: GroundlyReport }) {
  const keys: FrameworkKey[] = ["swot", "bcg", "ansoff", "stp"];
  const present = keys.filter((k) => report.results?.[k]);
  if (present.length === 0) return null;

  return (
    <section className="print-page print-spread" data-spread="strategy">
      <SpreadHeader kicker="02 / STRATEGY" title="Strategic Position" />
      {present.map((k) => (
        <FrameworkCard key={k} frameworkKey={k} report={report} />
      ))}
    </section>
  );
}

function OperationsSpread({ report }: { report: GroundlyReport }) {
  const keys: FrameworkKey[] = ["value_chain", "bmc", "balanced_scorecard"];
  const present = keys.filter((k) => report.results?.[k]);
  const assumptions = aggregate(report, "assumptions");
  const actions = aggregate(report, "actions");
  if (present.length === 0 && assumptions.length === 0 && actions.length === 0) return null;

  return (
    <section className="print-page print-spread" data-spread="operations">
      <SpreadHeader kicker="03 / OPERATIONS" title="Operating Model" />
      {present.map((k) => (
        <FrameworkCard key={k} frameworkKey={k} report={report} />
      ))}

      <CalloutList title="Key Assumptions to Validate" groups={assumptions} />
      <CalloutList title="Next Actions" groups={actions} />
    </section>
  );
}

function SourcesBackCover({ report }: { report: GroundlyReport }) {
  const allCitations = collectAllCitations(report);
  const providerUsed = (report as GroundlyReport & { provider_used?: string | null }).provider_used;

  return (
    <section className="print-page print-spread" data-spread="sources">
      <SpreadHeader kicker="04 / SOURCES" title="Sources &amp; Methodology" />

      {(report.directory_status || report.rag_status) && (
        <p className="print-status-line">
          {report.directory_status && <span>Directory: {report.directory_status}</span>}
          {report.rag_status && <span>Retrieval: {report.rag_status}</span>}
        </p>
      )}

      <ol className="print-sources-list">
        {allCitations.map((c, i) => (
          <li key={`${c.framework}-${c.index}-${i}`} className="print-source-item">
            <p className="print-source-title">{c.source_title}</p>
            <p className="print-source-url">{c.source_url}</p>
            <p className="print-source-meta">
              {sourceTypeLabel(c.source_url, c.similarity)}
              {typeof c.similarity === "number" && ` · ${Math.round(c.similarity * 100)}% match`}
            </p>
          </li>
        ))}
      </ol>

      <h3 className="print-h3">Methodology Notes</h3>
      <ul className="print-callout-list">
        {FRAMEWORK_NAV_ITEMS.filter((item) => report.results?.[item.key] && FRAMEWORK_NOTES[item.key]).map(
          (item) => (
            <li key={item.key}>
              <strong>{item.label}:</strong> {FRAMEWORK_NOTES[item.key]}
            </li>
          ),
        )}
      </ul>

      {providerUsed && PROVIDER_LABELS[providerUsed] && (
        <p className="print-provider-note">{PROVIDER_LABELS[providerUsed]}</p>
      )}
    </section>
  );
}

export function PrintBrochureContent({ report, idea, title, date }: PrintBrochureProps) {
  return (
    <>
      <CoverAndSummarySpread report={report} idea={idea} title={title} date={date} />
      <MarketSpread report={report} />
      <StrategySpread report={report} />
      <OperationsSpread report={report} />
      <SourcesBackCover report={report} />
    </>
  );
}

interface ThemedBrochureProps extends PrintBrochureProps {
  theme?: BrochureTheme;
}

export function PrintBrochure({ theme, ...props }: ThemedBrochureProps) {
  const content = (
    <div className={`print-only print-brochure ${themeClass(theme)}`}>
      <PrintBrochureContent {...props} />
    </div>
  );
  // SSR (tests via react-dom/server) has no `document` -- render inline
  // instead of portaling, same markup either way.
  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

export function BrochurePreview({ theme, ...props }: ThemedBrochureProps) {
  return (
    <div className={`print-brochure brochure-preview ${themeClass(theme)}`}>
      <PrintBrochureContent {...props} />
    </div>
  );
}
