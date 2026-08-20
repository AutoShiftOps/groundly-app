// Real bug, found comparing the TAM SAM SOM circle diagram against the
// mock on a live, fully-populated case ("a subscription service for EV
// charging stations": TAM=$6.1B, SAM=$330M, SOM=$8M, all real). SAM's
// ring was invisible -- SAM (5.4% of TAM) and SOM (0.13% of TAM) both
// hit the same independent `Math.max(minRadius, ...)` floor and rendered
// at the EXACT same radius, so SOM's later-drawn circle fully covered
// SAM's. Real-world tier ratios are far more skewed than the mock's own
// numbers (SAM was ~27% of TAM there), so proportional sqrt-scaling
// alone wasn't enough to stay legible.
//
// Fixed by guaranteeing separation between present tiers' radii (not
// just a shared floor) -- this test locks in that fix with the exact
// real ratios that exposed the bug, plus a mock-like-ratio case to
// confirm proportional sizing still looks reasonable when ratios are
// closer together, not always snapping to the harsh floor pattern.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportViewTamDefault from "./.generated/ReportView.tam-default.jsx";
import { check, finish } from "./lib/ssr-assert.mjs";

function fixtureWithMarketSizing(marketSizing) {
  return {
    stage: "finalizing",
    results: {
      tam: {
        text: "Market analysis [1].",
        citations: [{ index: 1, source_url: "https://example.com/a", source_title: "Source", similarity: 0.7 }],
        market_sizing: marketSizing,
      },
    },
    verification: { tam: { verified: true, unsupported_claims: [] } },
    business_metrics: [],
  };
}

// Extract the <circle> elements that belong to PRESENT tiers -- i.e. ones
// with a fill containing "59" (this component's solid-band opacity
// suffix), not the dashed ghost-ring circles (fill="none").
function extractDiagramSvg(html) {
  // There are two <svg> elements on the page: the sidebar logo mark
  // (width="30") and the TAM SAM SOM circle diagram (width={size}, size
  // = maxOuter*2+16 = 200 at this component's current constants) --
  // find the diagram one specifically, not just the first <svg> on the
  // page, since the logo's markup also contains <circle>.
  const svgStart = html.indexOf('<svg width="200"');
  const svgEnd = html.indexOf("</svg>", svgStart) + "</svg>".length;
  return html.slice(svgStart, svgEnd);
}

function extractPresentCircleRadii(html) {
  const svg = extractDiagramSvg(html);
  const matches = [...svg.matchAll(/<circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)" fill="#[0-9a-fA-F]{6}59"/g)];
  return matches.map((m) => Number(m[1]));
}

// --- Case 1: the real bug case -- extreme ratios (SAM 5.4% of TAM, SOM 0.13% of TAM) ---
const extremeFixture = fixtureWithMarketSizing({
  tam: { value_usd: 6100000000, label: "$6.1B", citation_index: 1, cagr_pct: 20, tier_description: "Global home EV charging market" },
  sam: { value_usd: 330000000, label: "$330M", citation_index: 1, cagr_pct: null, tier_description: "Home charging market in target states" },
  som: { value_usd: 8000000, label: "$8M", citation_index: 1, cagr_pct: null, tier_description: "3-year SOM for new entrants" },
});
const extremeHtml = renderToStaticMarkup(React.createElement(ReportViewTamDefault, { report: extremeFixture, idea: "an EV charging subscription", onReset: () => {} }));
const extremeRadii = extractPresentCircleRadii(extremeHtml);

check("Extreme-ratio case: exactly 3 present-tier circles rendered", extremeRadii.length === 3);
check("Extreme-ratio case: all 3 radii are distinct (no collapse to the same size)", new Set(extremeRadii).size === 3);
check("Extreme-ratio case: TAM (largest) > SAM > SOM (smallest), correct nesting order", extremeRadii[0] > extremeRadii[1] && extremeRadii[1] > extremeRadii[2]);
check("Extreme-ratio case: SAM and SOM have a real visual gap (>= 10px), not touching/overlapping", extremeRadii[1] - extremeRadii[2] >= 10);
check("Extreme-ratio case: TAM and SAM have a real visual gap (>= 10px)", extremeRadii[0] - extremeRadii[1] >= 10);

// --- Case 2: mock-like ratios (SAM ~27% of TAM, SOM ~2.8% of TAM) -- proportional sizing should still look reasonable, not always floor-snapped ---
const mockLikeFixture = fixtureWithMarketSizing({
  tam: { value_usd: 68300000000, label: "$68.3B", citation_index: 1, cagr_pct: 8.7, tier_description: "Global sustainable packaging market" },
  sam: { value_usd: 18700000000, label: "$18.7B", citation_index: 1, cagr_pct: 9.3, tier_description: "Eco-friendly packaging for e-commerce" },
  som: { value_usd: 1900000000, label: "$1.9B", citation_index: 1, cagr_pct: 12.6, tier_description: "3-year realistic capture" },
});
const mockLikeHtml = renderToStaticMarkup(React.createElement(ReportViewTamDefault, { report: mockLikeFixture, idea: "EcoPack sustainable packaging idea", onReset: () => {} }));
const mockLikeRadii = extractPresentCircleRadii(mockLikeHtml);

check("Mock-like-ratio case: exactly 3 present-tier circles rendered", mockLikeRadii.length === 3);
check("Mock-like-ratio case: all 3 radii distinct", new Set(mockLikeRadii).size === 3);
check("Mock-like-ratio case: correct nesting order (TAM > SAM > SOM)", mockLikeRadii[0] > mockLikeRadii[1] && mockLikeRadii[1] > mockLikeRadii[2]);
check("Mock-like-ratio case: SAM's radius reflects its real proportional size (not floor-snapped like the extreme case) -- meaningfully bigger than the extreme case's SAM radius", mockLikeRadii[1] > extremeRadii[1] + 5);

// --- Filled-band style: solid fill + inline label/value text, not hollow outline ---
check("Present tiers use a solid semi-transparent fill (not the old near-invisible 0x22 outline-only style)", extremeHtml.includes('fill="#4a8fff59"') || extremeHtml.includes('fill="#7c3aed59"') || extremeHtml.includes('fill="#2dd4bf59"'));
check("Old hollow/outline-only fill opacity (0x22 suffix) is gone from present-tier circles", !/fill="#[0-9a-fA-F]{6}22" stroke="#[0-9a-fA-F]{6}" strokeWidth="2"/.test(extremeHtml));
check("Inline abbreviation label ('TAM') rendered inside the SVG diagram itself, not just the legend", extractDiagramSvg(extremeHtml).includes(">TAM<"));
check("Inline dollar value ('$330M') rendered inside the SVG diagram itself for SAM", extractDiagramSvg(extremeHtml).includes("$330M"));

// --- Absent-tier ghost ring treatment unchanged ---
const partialFixture = fixtureWithMarketSizing({
  tam: { value_usd: 6100000000, label: "$6.1B", citation_index: 1, cagr_pct: 20, tier_description: "desc" },
  sam: null,
  som: null,
});
const partialHtml = renderToStaticMarkup(React.createElement(ReportViewTamDefault, { report: partialFixture, idea: "idea", onReset: () => {} }));
check("Absent tier still gets the dashed ghost-ring treatment, unchanged", partialHtml.includes('stroke-dasharray="4 3"') && partialHtml.includes("No data found"));

finish("TAM SAM SOM circle diagram: sizing + filled-band style");
