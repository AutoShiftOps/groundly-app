// feature/print-brochure: PrintBrochure.tsx renders the print-only
// brochure layout directly from the real report object -- no
// placeholder/sample content, no fabricated similarity, an honest
// empty state for an ungrounded framework. Reuses the same
// FRAMEWORK_NAV_ITEMS order and real components (TamConcentricDiagram,
// FrameworkDiagramBody, CitationChip) the on-screen report uses.
import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { BrochurePreview, PrintBrochure } from "../src/components/report/PrintBrochure.tsx";
import { FRAMEWORK_NAV_ITEMS } from "../src/components/report/frameworkMeta.ts";
import { check, finish } from "./lib/ssr-assert.mjs";

function citations(n, startIndex = 1, { similarity = 0.7 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    index: startIndex + i,
    source_url: `https://example.com/${startIndex + i}`,
    source_title: `Source ${startIndex + i}`,
    similarity,
  }));
}

// A full 10-framework report with real-shaped data for every framework.
function buildFullReport() {
  const results = {};
  const verification = {};
  for (const item of FRAMEWORK_NAV_ITEMS) {
    results[item.key] = {
      text: `${item.label} analysis narrative [1].`,
      citations: citations(2, 1),
      assumptions: [`Validate ${item.key} assumption.`],
      actions: [`Take ${item.key} action.`],
    };
    verification[item.key] = {
      verified: item.key !== "bcg",
      unsupported_claims: item.key === "bcg" ? ["some claim -- reason"] : [],
      claims: [],
      facts_total: 4,
      facts_supported: item.key === "bcg" ? 2 : 4,
      analysis_count: 0,
    };
  }
  results.tam.market_sizing = {
    tam: { value_usd: 12400000000, label: "$12.4B", citation_index: 1, cagr_pct: 6.8, tier_description: "Global market" },
    sam: { value_usd: 850000000, label: "$850M", citation_index: 2, cagr_pct: null, tier_description: null },
    som: { value_usd: null, label: "Not found in sources", citation_index: null, cagr_pct: null, tier_description: null },
  };

  return {
    stage: "finalizing",
    frameworks_requested: FRAMEWORK_NAV_ITEMS.map((i) => i.key),
    frameworks_allowed: FRAMEWORK_NAV_ITEMS.map((i) => i.key),
    results,
    verification,
    business_metrics: {
      market_size: { label: "$12.4B", rationale: "Grounded TAM figure.", citation_index: 1, source_framework: "tam" },
      competitive_pressure: null,
      customer_segment: null,
      business_model_fit: null,
      risk_flags: null,
    },
    geography: "Austin, TX, USA",
  };
}

const fullReport = buildFullReport();
const fullHtml = renderToStaticMarkup(
  <PrintBrochure report={fullReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" />,
);

// data-framework="<key>" marks each section unambiguously, independent
// of label text -- some labels (e.g. "Porter's Five Forces") contain an
// apostrophe that renderToStaticMarkup HTML-escapes as "&#x27;", so
// matching on the raw label text is fragile; the key never is.
function sectionIndex(html, key) {
  return html.indexOf(`data-framework="${key}"`);
}

// --- All 10 framework sections present, in FRAMEWORK_NAV_ITEMS order ---
check(
  "All 10 framework section bands are present",
  FRAMEWORK_NAV_ITEMS.every((item) => sectionIndex(fullHtml, item.key) !== -1),
);
// Addendum B's editorial layout groups frameworks into themed spreads
// with their own explicit order (Market: TAM, PESTEL, Porter; Strategy:
// SWOT, BCG, Ansoff, STP; Operations: Value Chain, BMC, Balanced
// Scorecard) -- not a single global FRAMEWORK_NAV_ITEMS sequence.
check(
  "Framework sections appear in the spec's editorial spread order",
  (() => {
    const order = ["tam", "pestel", "porter", "swot", "bcg", "ansoff", "stp", "value_chain", "bmc", "balanced_scorecard"];
    const positions = order.map((key) => sectionIndex(fullHtml, key));
    return positions.every((pos, i) => pos !== -1 && (i === 0 || pos > positions[i - 1]));
  })(),
);

// --- Real verification counts shown, not fabricated ---
check(
  "BCG shows the real 2 of 4 facts supported count",
  (() => {
    const idx = sectionIndex(fullHtml, "bcg");
    return fullHtml.slice(idx, idx + 2000).includes("2 of 4 facts supported");
  })(),
);
check(
  "PESTEL shows the real 4 of 4 facts supported count",
  (() => {
    const idx = sectionIndex(fullHtml, "pestel");
    return fullHtml.slice(idx, idx + 2000).includes("4 of 4 facts supported");
  })(),
);
check(
  "BCG (verified: false) shows Needs Sourcing, not Verified",
  (() => {
    const idx = sectionIndex(fullHtml, "bcg");
    const chunk = fullHtml.slice(idx, idx + 2000);
    return chunk.includes("Needs Sourcing") && !chunk.includes(">Verified<");
  })(),
);

// --- A framework with no citations prints the real "Couldn't analyze" state ---
const noCitationsReport = buildFullReport();
noCitationsReport.results.swot = { text: "Insufficient grounded data available for this section.", citations: [] };
noCitationsReport.verification.swot = { verified: false, unsupported_claims: [], claims: [], facts_total: 0, facts_supported: 0, analysis_count: 0 };
const noCitationsHtml = renderToStaticMarkup(
  <PrintBrochure report={noCitationsReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" />,
);
check(
  "SWOT with zero citations prints the real empty state, not a blank section",
  (() => {
    const idx = sectionIndex(noCitationsHtml, "swot");
    return noCitationsHtml.slice(idx, idx + 2000).includes("analyze — no grounded sources");
  })(),
);
check(
  "SWOT's empty state never prints the raw 'Insufficient grounded data' sentence as if it were real narrative",
  (() => {
    const idx = sectionIndex(noCitationsHtml, "swot");
    return !noCitationsHtml.slice(idx, idx + 2000).includes("Insufficient grounded data");
  })(),
);

// --- A null TAM tier prints "Not found in sources", never a fabricated number ---
check(
  "SOM (null tier) prints 'Not found in sources'",
  fullHtml.includes("Not found in sources"),
);

// --- Sources appendix: only the real citations present, similarity only when real ---
const directoryReport = buildFullReport();
directoryReport.results.tam.citations = [
  ...citations(1, 1),
  { index: 2, source_url: "https://services6.arcgis.com/x/FeatureServer/0/query", source_title: "Mississauga Business Directory", similarity: null },
];
const directoryHtml = renderToStaticMarkup(
  <PrintBrochure report={directoryReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" />,
);
check(
  "Directory citation (similarity: null) appears in sources with no fabricated % match",
  (() => {
    const idx = directoryHtml.indexOf("Mississauga Business Directory");
    if (idx === -1) return false;
    const chunk = directoryHtml.slice(idx, idx + 300);
    return !/\d+%\s*match/.test(chunk);
  })(),
);
check(
  "A real pgvector citation still shows its real % match",
  /70% match/.test(directoryHtml),
);

// --- Addendum A1/C: print wrapper carries print-only + the portal's
// SSR fallback, so #root-hiding + .print-only visibility CSS actually
// targets this structure; the preview wrapper carries neither, since
// it must stay visible on screen without relying on print media. ---
check(
  "Print output is wrapped in print-only.print-brochure (the structure @media print's #root/.print-only rules target)",
  /<div class="print-only print-brochure brochure-dark">/.test(fullHtml),
);
const previewHtml = renderToStaticMarkup(
  <BrochurePreview report={fullReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" />,
);
check(
  "Brochure preview uses the same content but never carries print-only (it must stay visible on screen)",
  previewHtml.includes('class="print-brochure brochure-preview brochure-dark"') && !previewHtml.includes("print-only"),
);

// --- Theme: Dark by default, Ink saver switches both print and preview
// to .brochure-light. ---
check(
  "Default brochure (no theme chosen) carries the dark theme class, not the light one",
  fullHtml.includes("brochure-dark") && !fullHtml.includes("brochure-light"),
);
const inkPrintHtml = renderToStaticMarkup(
  <PrintBrochure report={fullReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" theme="light" />,
);
const inkPreviewHtml = renderToStaticMarkup(
  <BrochurePreview report={fullReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" theme="light" />,
);
check(
  "Ink saver switches the print brochure to .brochure-light",
  /<div class="print-only print-brochure brochure-light">/.test(inkPrintHtml) && !inkPrintHtml.includes("brochure-dark"),
);
check(
  "Ink saver switches the Brochure View preview to .brochure-light too",
  inkPreviewHtml.includes('class="print-brochure brochure-preview brochure-light"'),
);

// --- Pagination: every spread heading stays with what follows it ---
check(
  "Every spread heading carries the break-after: avoid class (print-keep-with-next)",
  (() => {
    const headers = fullHtml.match(/<div class="print-spread-header[^"]*"/g) || [];
    return headers.length === 5 && headers.every((h) => h.includes("print-keep-with-next"));
  })(),
);

const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf-8");
function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return m ? m[2] : null;
}
check(
  "CSS: .print-keep-with-next sets break-after: avoid",
  /break-after:\s*avoid/.test(cssRule(".print-keep-with-next") || ""),
);
check(
  "CSS: interior spread wrappers are transparent with no min-height, so the page background shows through",
  /background:\s*transparent/.test(cssRule(".print-spread") || "") &&
    !/min-height:\s*[1-9]/.test(cssRule(".print-spread") || ""),
);
check(
  "CSS: no framework section forces its own page break",
  !/\.print-fw-card[^{]*\{[^}]*break-before:\s*page/.test(css),
);
check(
  "Interior spreads (everything but the cover) never carry the cover's dark gradient class",
  (() => {
    const sections = fullHtml.match(/<section class="[^"]*"/g) || [];
    const interior = sections.filter((s) => !s.includes("print-cover"));
    return interior.length === 5 && interior.every((s) => s.includes("print-spread"));
  })(),
);

// --- Strategy frameworks (incl. STP) each get a full-width row, never a
// squeezed grid cell: every card is a direct child of the spread section. ---
check(
  "STP and the other strategy frameworks are full-width rows, not grid cells",
  (() => {
    const start = fullHtml.indexOf('data-spread="strategy"');
    const sectionOpen = fullHtml.lastIndexOf("<section", start);
    const tag = /<div\b[^>]*>|<\/div>|<\/section>/g;
    tag.lastIndex = sectionOpen;
    const topLevel = [];
    let depth = 0;
    for (let m; (m = tag.exec(fullHtml)); ) {
      if (m[0] === "</section>") break;
      if (m[0] === "</div>") depth--;
      else {
        if (depth === 0) topLevel.push(m[0]);
        depth++;
      }
    }
    return ["swot", "bcg", "ansoff", "stp"].every((k) =>
      topLevel.some((t) => t.includes(`data-framework="${k}"`)),
    );
  })(),
);
check(
  "Preview and print render the identical framework section markup (same component, cannot differ)",
  (() => {
    const printInner = fullHtml.slice(fullHtml.indexOf('data-framework="tam"'));
    const previewInner = previewHtml.slice(previewHtml.indexOf('data-framework="tam"'));
    return printInner === previewInner;
  })(),
);

// --- Only the 5 real business_metrics keys ever render a card -- an
// invented key (e.g. "execution_risk", never real per agents/
// synthesis.py's BUSINESS_METRICS_SCHEMA) must never appear. ---
const extraKeyReport = buildFullReport();
extraKeyReport.business_metrics.execution_risk = { label: "High", rationale: "invented", citation_index: null, source_framework: "swot" };
const extraKeyHtml = renderToStaticMarkup(
  <PrintBrochure report={extraKeyReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" />,
);
check(
  "An invented business-metric key (execution_risk) never renders a card",
  !extraKeyHtml.includes("execution_risk") && !/EXECUTION RISK/i.test(extraKeyHtml),
);
check(
  "All 5 real business-metric cards (Market Size, Competitive Pressure, Best Customer Segment, Business Model Fit, Risk Flags) are present",
  ["Market Size", "Competitive Pressure", "Best Customer Segment", "Business Model Fit", "Risk Flags"].every(
    (label) => fullHtml.includes(label),
  ),
);

// --- Aggregated assumptions/actions: a duplicate assumption shared by
// two frameworks appears once, tagged with both source frameworks. ---
const aggReport = buildFullReport();
aggReport.results.pestel.assumptions = ["Freelancer demand holds steady."];
aggReport.results.swot.assumptions = ["Freelancer demand holds steady."];
const aggHtml = renderToStaticMarkup(
  <PrintBrochure report={aggReport} idea="A test idea" title="Test Venture" date="Nov 18, 2026" />,
);
check(
  "A duplicate assumption shared by two frameworks appears once, not twice",
  aggHtml.split("Freelancer demand holds steady.").length - 1 === 1,
);
check(
  "The de-duplicated assumption sits under one combined 'PESTEL · SWOT' framework subheading",
  (() => {
    const group = aggHtml.indexOf('data-group="pestel+swot"');
    const item = aggHtml.indexOf("Freelancer demand holds steady.");
    const heading = aggHtml.slice(group, item);
    return group !== -1 && item > group && heading.includes("PESTEL · SWOT");
  })(),
);
check(
  "Assumptions/actions are grouped under framework subheadings, not tagged '(Framework)' on every line",
  (() => {
    const items = fullHtml.match(/<li class="print-callout-item">[^<]*<\/li>/g) || [];
    const groups = fullHtml.match(/class="print-callout-group"/g) || [];
    // buildFullReport gives each of the 10 frameworks 1 assumption + 1 action.
    return items.length === 20 && groups.length === 20 && items.every((li) => !/\([^)]*\)<\/li>$/.test(li));
  })(),
);
check(
  "CSS: each assumption/action item avoids breaking across pages or columns",
  /break-inside:\s*avoid/.test(cssRule(".print-callout-item") || ""),
);
check(
  "CSS: the printed cover is strictly shorter than one Letter page",
  /height:\s*calc\(11in - 2px\)/.test(css) && !/\.print-cover\s*\{[^}]*height:\s*11in;/.test(css),
);
check(
  "No invented '90-day' or timing label appears anywhere in the brochure",
  !/90-day/i.test(fullHtml) && !/90 day/i.test(fullHtml),
);

// --- TAM takeaway takes the box's full width, Top Citations stacked below ---
check(
  "TAM takeaway bar stacks takeaway above Top Citations (never a side-by-side row)",
  (() => {
    const m = fullHtml.match(/<div class="tam-takeaway-bar[^"]*"/);
    if (!m || /flex-row/.test(m[0])) return false;
    const bar = fullHtml.indexOf(m[0]);
    const takeawayAt = fullHtml.indexOf("Key Takeaway", bar);
    const citesAt = fullHtml.indexOf("Top Citations", bar);
    return takeawayAt !== -1 && citesAt > takeawayAt;
  })(),
);

// --- Ink saver hooks: TAM header and idle matrix cells carry the classes
// the .brochure-light overrides target ---
check(
  "TAM table header and unselected BCG/Ansoff cells carry Ink saver hook classes",
  fullHtml.includes("tam-table-head") &&
    (() => {
      const r = buildFullReport();
      r.results.bcg.bcg_matrix = { quadrant: "star", market_growth_rate_pct: 10, market_share_position: "x", citation_index: 1, rationale: "y" };
      r.results.ansoff.ansoff_matrix = { quadrant: "market_penetration", market_dimension: "existing", product_dimension: "existing", citation_index: 1, rationale: "z" };
      const html = renderToStaticMarkup(<PrintBrochure report={r} idea="i" title="t" date="d" theme="light" />);
      return (html.match(/matrix-cell-idle/g) || []).length === 6;
    })(),
);
check(
  "CSS: Ink saver lightens the TAM header and idle matrix cells",
  /#f1f5f9/.test(cssRule(".brochure-light .tam-table-head") || "") &&
    /#f8fafc/.test(cssRule(".brochure-light .matrix-cell-idle") || ""),
);

// --- BCG, Ansoff and STP lay out by their card's width (container
// queries), not the viewport -- on a ~730px printed page, viewport md:
// breakpoints stacked their columns and doubled each card's height. ---
check(
  "BCG, Ansoff and STP diagrams use card-width container queries, not viewport md: breakpoints",
  (() => {
    const r = buildFullReport();
    r.results.bcg.bcg_matrix = { quadrant: "star", market_growth_rate_pct: 10, market_share_position: "x", citation_index: 1, rationale: "y" };
    r.results.ansoff.ansoff_matrix = { quadrant: "market_penetration", market_dimension: "existing", product_dimension: "existing", citation_index: 1, rationale: "z" };
    r.results.stp.stp_analysis = { segmentation: [], targeting: [], positioning: [] };
    const html = renderToStaticMarkup(<PrintBrochure report={r} idea="i" title="t" date="d" />);
    return ["bcg", "ansoff", "stp"].every((key) => {
      const start = sectionIndex(html, key);
      const next = html.indexOf('data-framework="', start + 20);
      const chunk = html.slice(start, next === -1 ? undefined : next);
      return chunk.includes('class="@container"') && /@xl:grid-cols-(12|3)/.test(chunk) && !/\bmd:grid-cols/.test(chunk);
    });
  })(),
);

// --- No hardcoded TAM "Key Takeaway" fallback sentence anywhere ---
check(
  "The old hardcoded TAM takeaway sentence never renders",
  !fullHtml.includes("Bottom-up serviceable sizing isolates your realistic 3-year wedge."),
);

finish("PrintBrochure: real data only, honest empty states, correct framework order");
