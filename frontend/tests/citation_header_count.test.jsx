// Bug: "Sources & Citations -- View all (N)" always rendered
// stats.totalCitations (the report-wide dedup count across every
// framework), even on a single-framework tab whose citation list below
// only ever showed that framework's own citations. A tab with 0
// citations of its own could show "View all (3)" from an unrelated
// framework's total. Header count must track whichever set the list
// actually renders: stats.totalCitations only on Overview, the active
// framework's own (deduped) count otherwise.
//
// Uses the pre-generated per-tab-default ReportView copies (see
// tests/run.mjs) since react-dom/server can't simulate a tab click.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportView from "../src/components/ReportView.jsx";
import ReportViewTamDefault from "./.generated/ReportView.tam-default.jsx";
import ReportViewSwotDefault from "./.generated/ReportView.swot-default.jsx";
import { check, finish } from "./lib/ssr-assert.mjs";

// pestel: 2 citations, 2 distinct source_urls. swot: 0 citations (the
// exact "0 vs. an unrelated total" case from the bug report). tam: 3
// citations but only 2 distinct source_urls (one repeated) -- exercises
// the dedup-consistency fix (raw .length would say 3, the actually-
// rendered deduped list says 2). bmc: 1 citation.
const fixtureReport = {
  stage: "finalizing",
  results: {
    pestel: {
      text: "Political factors [1]. Economic factors [2].",
      citations: [
        { index: 1, source_url: "https://example.com/a", source_title: "Source A", similarity: 0.71 },
        { index: 2, source_url: "https://example.com/b", source_title: "Source B", similarity: 0.65 },
      ],
      pestel_analysis: { political: [], economic: [], social: [], technological: [], environmental: [], legal: [] },
    },
    swot: {
      text: "Insufficient grounded data available for this section.",
      citations: [],
      swot_analysis: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
    },
    tam: {
      text: "Market [3]. Another figure [4]. Yet another [5].",
      citations: [
        { index: 3, source_url: "https://example.com/c", source_title: "Source C", similarity: 0.71 },
        { index: 4, source_url: "https://example.com/c", source_title: "Source C", similarity: 0.66 }, // same source_url as #3 -- dedupes to 1
        { index: 5, source_url: "https://example.com/d", source_title: "Source D", similarity: 0.60 },
      ],
      market_sizing: { tam: { value_usd: 1e9, label: "$1B", citation_index: 3, cagr_pct: null, tier_description: null }, sam: null, som: null },
    },
    bmc: {
      text: "Partners [6].",
      citations: [{ index: 6, source_url: "https://example.com/e", source_title: "Source E", similarity: 0.6 }],
      bmc_canvas: { key_partners: [], key_activities: [], value_propositions: [], key_resources: [], customer_relationships: [], customer_segments: [], channels: [], cost_structure: [], revenue_streams: [] },
    },
  },
  verification: {
    pestel: { verified: true, unsupported_claims: [] },
    swot: { verified: false, unsupported_claims: [] },
    tam: { verified: true, unsupported_claims: [] },
    bmc: { verified: true, unsupported_claims: [] },
  },
  business_metrics: [],
};

const props = { report: fixtureReport, idea: "EcoPack sustainable packaging idea", onReset: () => {} };

function headerCount(html) {
  const match = html.match(/View all \((\d+)\)/);
  return match ? Number(match[1]) : null;
}

// Overview: report-wide dedup total (5 distinct source_urls: a, b, c, d, e -- #3/#4 share c).
const overviewHtml = renderToStaticMarkup(React.createElement(ReportView, props));
check("Overview header count is the report-wide dedup total (5 distinct source_urls)", headerCount(overviewHtml) === 5);

// TAM tab: 3 raw citations, but only 2 distinct source_urls -- header
// must match the DEDUPED list actually rendered below it, not the raw
// citations array length.
const tamHtml = renderToStaticMarkup(React.createElement(ReportViewTamDefault, props));
check("TAM tab header count is 2 (deduped), not 3 (raw citations.length)", headerCount(tamHtml) === 2);
check("TAM tab's Sources & Citations panel also shows exactly 2 entries (header matches the list, not just the number)", (() => {
  // Scoped to the Sources & Citations panel specifically -- TamSizingCard's
  // own FrameworkStrip ("Top Citations") also references these source
  // titles further down the page, so an unscoped whole-page count would
  // overcount and isn't what this check is actually verifying.
  // React SSR escapes "&" in text nodes to "&amp;".
  const panelStart = tamHtml.indexOf("Sources &amp; Citations");
  const panelEnd = tamHtml.indexOf("Ask AI");
  const panel = tamHtml.slice(panelStart, panelEnd);
  return (panel.match(/Source C|Source D/g) || []).length === 2;
})());

// SWOT tab: 0 citations of its own -- header must say 0, not the
// Overview-wide total (5) or any other framework's count. This is the
// exact bug from the report ("View all (3)" next to an empty list).
const swotHtml = renderToStaticMarkup(React.createElement(ReportViewSwotDefault, props));
check("SWOT tab header count is 0 (its own citations, not the report-wide total)", headerCount(swotHtml) === 0);
check("SWOT tab citation list shows the empty-state message", swotHtml.includes("No citations returned for this section"));
check("SWOT tab header is NOT the report-wide total (5) or another framework's count", headerCount(swotHtml) !== 5 && headerCount(swotHtml) !== 2);


finish("Sources & Citations header count matches the displayed list");
