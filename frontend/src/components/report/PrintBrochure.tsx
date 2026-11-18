// Print-only brochure layout (feature/print-brochure). Rendered inside
// ReportView.tsx, hidden on screen (.print-only), visible only in
// @media print (frontend/src/index.css). Reuses the real report
// components and data -- TamConcentricDiagram, FrameworkDiagramBody,
// renderTextWithInlineCitations, CitationChip, FRAMEWORK_NAV_ITEMS
// order, reportStats -- so print and screen can never show different
// numbers. Every value here comes from the real `report` object; a
// framework with no grounding prints its real empty state, never a
// placeholder.
import { CheckCircle2, ShieldAlert } from "lucide-react";
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

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Generated with Gemini",
  openai: "Generated with OpenAI",
  mixed: "Generated with Gemini and OpenAI (mixed)",
};

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

function CoverPage({ report, idea, title, date }: PrintBrochureProps) {
  const stats = computeReportStats(report);
  const allCitations = collectAllCitations(report);
  const factsTotal = Object.values(report.verification || {}).reduce(
    (sum, v) => sum + (v.facts_total ?? 0),
    0,
  );
  const factsSupported = Object.values(report.verification || {}).reduce(
    (sum, v) => sum + (v.facts_supported ?? 0),
    0,
  );

  return (
    <section className="print-page print-cover">
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

        {factsTotal > 0 && (
          <p className="print-cover-summary">
            {stats.verifiedCount} of {stats.totalFrameworks} frameworks verified · {factsSupported} of{" "}
            {factsTotal} facts supported · {allCitations.length}{" "}
            {allCitations.length === 1 ? "source" : "sources"}
          </p>
        )}
      </div>
    </section>
  );
}

function ExecutiveSummaryPage({ report }: { report: GroundlyReport }) {
  return (
    <section className="print-page print-light">
      <h2 className="print-h2">Executive Summary</h2>

      <div className="print-metric-grid">
        {BUSINESS_METRIC_CARDS.map((card) => {
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

      {report.results?.tam?.market_sizing && (
        <div className="print-tam-wrap">
          <TamConcentricDiagram
            marketSizing={report.results.tam.market_sizing}
            result={report.results.tam}
          />
        </div>
      )}

      <h3 className="print-h3">Verification at a Glance</h3>
      <div className="print-verify-strip">
        {FRAMEWORK_NAV_ITEMS.filter((item) => report.results?.[item.key]).map((item) => {
          const v = report.verification?.[item.key];
          const facts = factsLine(report, item.key);
          return (
            <div key={item.key} className="print-verify-row">
              <span className="print-verify-name" style={{ color: item.color }}>
                {item.label}
              </span>
              <VerificationBadge verified={v?.verified} />
              {facts && <span className="print-verify-facts">{facts}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FrameworkSection({
  frameworkKey,
  report,
}: {
  frameworkKey: FrameworkKey;
  report: GroundlyReport;
}) {
  const item = FRAMEWORK_NAV_ITEMS.find((i) => i.key === frameworkKey)!;
  const result = report.results?.[frameworkKey];
  const verification = report.verification?.[frameworkKey];
  const facts = factsLine(report, frameworkKey);
  const Icon = item.icon;
  const hasGrounding = Boolean(result?.citations?.length);

  return (
    <section className="print-page print-light print-framework-section" data-framework={frameworkKey}>
      <div className="print-fw-band" style={{ background: item.color }}>
        <Icon className="h-5 w-5 text-white" />
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

          <div className="print-callout-grid">
            <div className="print-callout">
              <p className="print-callout-title">Assumptions</p>
              {result.assumptions && result.assumptions.length > 0 ? (
                <ul className="print-callout-list">
                  {result.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="print-callout-empty">None surfaced.</p>
              )}
            </div>
            <div className="print-callout">
              <p className="print-callout-title">Actions</p>
              {result.actions && result.actions.length > 0 ? (
                <ul className="print-callout-list">
                  {result.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="print-callout-empty">None surfaced.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function sourceTypeLabel(url: string, similarity: number | null): string {
  if (similarity == null) {
    if (/arcgis\.com/i.test(url)) return "Mississauga Open Data";
    return "Directory";
  }
  return "Web";
}

function SourcesAppendixPage({ report }: { report: GroundlyReport }) {
  const allCitations = collectAllCitations(report);
  const providerUsed = (report as GroundlyReport & { provider_used?: string | null }).provider_used;

  return (
    <section className="print-page print-light">
      <h2 className="print-h2">Sources</h2>
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

export function PrintBrochure({ report, idea, title, date }: PrintBrochureProps) {
  const frameworkItems = FRAMEWORK_NAV_ITEMS.filter((item) => report.results?.[item.key]);

  return (
    <div className="print-only print-brochure">
      <CoverPage report={report} idea={idea} title={title} date={date} />
      <ExecutiveSummaryPage report={report} />
      {frameworkItems.map((item) => (
        <FrameworkSection key={item.key} frameworkKey={item.key as FrameworkKey} report={report} />
      ))}
      <SourcesAppendixPage report={report} />
    </div>
  );
}
