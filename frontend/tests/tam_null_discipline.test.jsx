// docs/TEST_COVERAGE_SPEC.md #2 (frontend half): "the frontend never
// converts a null into a fabricated-looking display value anywhere it's
// consumed (TamSizingCard's 'No data found' states, the % of Parent/CAGR
// table cells showing '-')." A fixture feeding a partially-null
// market_sizing object through TamSizingCard's actual render path,
// asserting the exact null-handling output -- deliberately not asserting
// anything about LLM prose content, only the null -> display-value
// mapping (per the spec's "don't test LLM output content" guidance).
//
// Uses the pre-generated ReportView.tam-default.jsx (see tests/run.mjs)
// since react-dom/server can't simulate clicking the TAM tab.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportViewTamDefault from "../src/components/ReportView.tam-default.generated.jsx";
import { check, finish } from "./lib/ssr-assert.mjs";

// Deliberately partially-null: tam has a real grounded value (with a real
// cagr_pct AND tier_description); sam has a value but no cagr_pct or
// tier_description (both legitimately ungrounded); som is entirely null
// (the tier itself was never grounded at all). Every combination the null
// discipline needs to cover in one fixture.
const fixtureReport = {
  stage: "finalizing",
  results: {
    tam: {
      text: "The global market for eco-friendly packaging is $12.4B [1]. The serviceable market is $850M [2].",
      citations: [
        { index: 1, source_url: "https://example.com/a", source_title: "Global Packaging Report", similarity: 0.71 },
        { index: 2, source_url: "https://example.com/b", source_title: "Regional Market Study", similarity: 0.65 },
      ],
      market_sizing: {
        tam: { value_usd: 12400000000, label: "$12.4B", citation_index: 1, cagr_pct: 6.8, tier_description: "Global sustainable packaging market" },
        sam: { value_usd: 850000000, label: "$850M", citation_index: 2, cagr_pct: null, tier_description: null },
        som: null,
      },
    },
  },
  verification: { tam: { verified: true, unsupported_claims: [] } },
  business_metrics: [],
};

const html = renderToStaticMarkup(
  React.createElement(ReportViewTamDefault, { report: fixtureReport, idea: "EcoPack sustainable packaging idea", onReset: () => {} })
);

// --- TAM: fully grounded tier -- every field should show its real value ---
check("TAM: real dollar value shown ($12.4B)", html.includes("$12.4B"));
check("TAM: real cagr_pct shown (6.8%)", html.includes("6.8%"));
check("TAM: real tier_description shown in legend", html.includes("Global sustainable packaging market"));
check("TAM: not marked 'No data found'", (() => {
  // TAM's own row/legend entry must not carry the missing-data treatment --
  // scoped by checking the text segment around the TAM value, not a
  // document-wide check to avoid a false negative from SOM elsewhere.
  const idx = html.indexOf("$12.4B");
  const nearby = html.slice(Math.max(0, idx - 200), idx + 200);
  return !nearby.includes("No data found");
})());

// --- SAM: real dollar value, but cagr_pct and tier_description both null ---
check("SAM: real dollar value shown ($850M)", html.includes("$850M"));
check("SAM's table row (Value/%-of-Parent/CAGR cells, in order) shows its real % of Parent then an em-dash for CAGR, not a fabricated percentage", (() => {
  // Table row order is Metric, Value (USD), % of Parent, CAGR, Source --
  // find SAM's "$850M" specifically inside the <table> markup (not the
  // circle diagram's inline label or the legend, both of which also
  // render "$850M" earlier in the DOM) and check the CAGR cell from
  // there, not just "an em-dash exists somewhere in the whole document".
  const tableStart = html.indexOf("<table");
  const tableRowIdx = html.indexOf("$850M", tableStart);
  const row = html.slice(tableRowIdx, tableRowIdx + 400);
  const expectedPct = Math.round((850000000 / 12400000000) * 1000) / 10;
  const pctIdx = row.indexOf(`${expectedPct}%`);
  const cagrCellRegion = pctIdx >= 0 ? row.slice(pctIdx + 5, pctIdx + 150) : row;
  return cagrCellRegion.includes("—") && !/\d(\.\d+)?%/.test(cagrCellRegion.split("—")[0]);
})());

// --- SOM: the whole tier is null -- must show explicit "No data found", never a fabricated 0 or blank ---
check("SOM: explicit 'No data found' text present", html.includes("No data found"));
check("SOM: never rendered as a fabricated $0 or 0% value", !html.includes("$0") && !html.includes(">0%<"));

// --- % of Parent: only computed when the parent tier is ALSO present; never a fabricated 0% ---
check("SAM's % of Parent is a real computed percentage (SAM/TAM), not blank or fabricated", (() => {
  const expectedPct = Math.round((850000000 / 12400000000) * 1000) / 10; // 6.9%... matches ReportView.jsx's own rounding
  return html.includes(`${expectedPct}%`);
})());
check("SOM (entirely null) has no computed % of Parent value at all", (() => {
  // SOM row's % of Parent cell must fall back to the dash placeholder,
  // same as any other missing-basis-for-computation case.
  const somRowIdx = html.indexOf("No data found");
  const nearby = html.slice(somRowIdx, somRowIdx + 600);
  return !/\d+(\.\d+)?%/.test(nearby.split("Source")[0] || nearby);
})());

finish("TamSizingCard null-when-ungrounded discipline");
