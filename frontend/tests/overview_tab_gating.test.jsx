// docs/TEST_COVERAGE_SPEC.md #3: isOverview correctly suppresses
// VerdictBanner/MetricRow/BusinessMetricRow on every framework tab and
// shows them exactly once. Given how many rounds of restructuring have
// already touched this file, this locks in: (a) Overview shows the
// verdict/metrics block and OverviewFrameworkLinks, (b) each framework
// tab shows its own content and does NOT render the verdict/metrics
// block, (c) switching tabs correctly toggles both.
//
// react-dom/server can't simulate a click, so "switching tabs" is proven
// by comparing three separate renders: the real default-Overview
// ReportView, and two pre-generated tab-defaulted copies (see
// tests/run.mjs) -- if the gating logic is a per-tab `if`, all three
// must show mutually exclusive behavior; if a future change hoists the
// verdict block out of the isOverview guard, it would show up on the
// framework-tab renders too, which these checks would catch.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportView from "../src/components/ReportView.jsx";
import ReportViewTamDefault from "../src/components/ReportView.tam-default.generated.jsx";
import ReportViewSwotDefault from "../src/components/ReportView.swot-default.generated.jsx";
import { check, finish } from "./lib/ssr-assert.mjs";

const fixtureReport = {
  stage: "finalizing",
  results: {
    tam: {
      text: "The global market for eco-friendly packaging is $12.4B [1].",
      citations: [{ index: 1, source_url: "https://example.com/a", source_title: "Global Packaging Report", similarity: 0.71 }],
      market_sizing: { tam: { value_usd: 12400000000, label: "$12.4B", citation_index: 1, cagr_pct: 6.8, tier_description: "desc" }, sam: null, som: null },
    },
    swot: {
      text: "Strength: strong brand [2].",
      citations: [{ index: 2, source_url: "https://example.com/d", source_title: "SWOT Source", similarity: 0.6 }],
      swot_analysis: { strengths: [{ text: "Strong brand", citation_index: 2 }], weaknesses: [], opportunities: [], threats: [] },
    },
  },
  verification: {
    tam: { verified: true, unsupported_claims: [] },
    swot: { verified: true, unsupported_claims: [] },
  },
  business_metrics: [
    { label: "Market Size", value: "$68.3B", description: "High growth market.", score: 8.6 },
  ],
};

const props = { report: fixtureReport, idea: "EcoPack sustainable packaging idea", onReset: () => {} };

// GitHub issue #18 follow-up (Export PDF, full-report version):
// ReportView now renders a SECOND tree unconditionally alongside the
// interactive one -- PrintableFullReport (.report-print-view), hidden
// on screen via CSS (display:none) but very much present in raw SSR
// markup, since react-dom/server has no concept of CSS. It always
// includes every present framework's full card (VerdictBanner,
// TamSizingCard/FrameworkPanel for every framework, etc) regardless of
// which tab is active on screen -- that's the whole point of it. This
// test is specifically about the INTERACTIVE screen view's own
// isOverview gating, so it scopes every check to just
// .report-screen-view's markup (which always comes first in the DOM,
// per ReportView.jsx's own structure) and ignores the separate
// always-rendered print tree entirely -- not scoping this would make
// every "does NOT render" / "exactly once" check below fail against
// content that's real, intentional, and simply in the other tree.
function screenViewOnly(html) {
  const printViewStart = html.indexOf('class="report-print-view"');
  if (printViewStart === -1) {
    throw new Error("Could not find .report-print-view in rendered HTML -- ReportView.jsx's structure changed, this test's scoping needs updating.");
  }
  return html.slice(0, printViewStart);
}

const overviewHtml = screenViewOnly(renderToStaticMarkup(React.createElement(ReportView, props)));
const tamTabHtml = screenViewOnly(renderToStaticMarkup(React.createElement(ReportViewTamDefault, props)));
const swotTabHtml = screenViewOnly(renderToStaticMarkup(React.createElement(ReportViewSwotDefault, props)));

// Marker strings unique to each gated block -- real component text, not
// invented for the test, so a rename would need this test updated too
// (visible, not silently stale).
const VERDICT_MARKER = "Overall Strategic Verdict"; // VerdictBanner
const OVERVIEW_LINKS_MARKER = "grounded source"; // presence check only (loose --
  // also appears once in VerdictBanner's own "Based on N grounded sources" line)
// Both fixture frameworks are verified:true, so OverviewFrameworkLinks
// renders "Verified" (capitalized) once per card -- this text otherwise
// only appears on FrameworkPanel/TamSizingCard's own pill, neither of
// which renders while isOverview is true (confirmed by the check above),
// so on the Overview render this is unique to OverviewFrameworkLinks.
const OVERVIEW_LINKS_PER_CARD_MARKER = "Verified";
// Not "TAM SAM SOM" -- that string also appears in the sidebar nav label
// on every single render regardless of active tab (FRAMEWORK_LABELS.tam),
// so it wouldn't distinguish "the TAM card's body rendered" from "the
// sidebar always lists TAM". "Read full analysis" is TamSizingCard's own
// toggle button, only ever rendered as part of the card's body.
const TAM_CARD_MARKER = "Read full analysis";
const SWOT_GRID_MARKER = "Strengths"; // SwotGrid quadrant, only on the swot tab

// --- (a) Overview shows the verdict/metrics block and framework links ---
check("Overview: VerdictBanner renders", overviewHtml.includes(VERDICT_MARKER));
check("Overview: OverviewFrameworkLinks renders", overviewHtml.includes(OVERVIEW_LINKS_MARKER));
check("Overview: neither framework tab's own content renders (no TAM card, no SWOT grid)", !overviewHtml.includes(TAM_CARD_MARKER) && !overviewHtml.includes(SWOT_GRID_MARKER));

// --- (b) each framework tab shows its own content, NOT the verdict/metrics block ---
check("TAM tab: VerdictBanner does NOT render", !tamTabHtml.includes(VERDICT_MARKER));
check("TAM tab: OverviewFrameworkLinks does NOT render", !tamTabHtml.includes(OVERVIEW_LINKS_MARKER));
check("TAM tab: its own merged card renders instead", tamTabHtml.includes(TAM_CARD_MARKER));

check("SWOT tab: VerdictBanner does NOT render", !swotTabHtml.includes(VERDICT_MARKER));
check("SWOT tab: OverviewFrameworkLinks does NOT render", !swotTabHtml.includes(OVERVIEW_LINKS_MARKER));
check("SWOT tab: its own quadrant grid renders instead", swotTabHtml.includes(SWOT_GRID_MARKER));

// --- (c) switching tabs toggles both, exactly once each -- the verdict
// block must never appear twice (e.g. once from a stray unconditional
// render plus once from the isOverview-gated one) ---
check("Overview: VerdictBanner appears exactly once (not duplicated)", (overviewHtml.match(new RegExp(VERDICT_MARKER, "g")) || []).length === 1);
check("Overview: OverviewFrameworkLinks summary line appears exactly once per real framework (2 frameworks in this fixture)", (overviewHtml.match(new RegExp(OVERVIEW_LINKS_PER_CARD_MARKER, "g")) || []).length === 2);

finish("Overview tab gating (isOverview)");
