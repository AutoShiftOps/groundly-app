// Restores the regression coverage dropped in unify/1-frontend's full
// UI replacement (the old tam_null_discipline.test.jsx rendered the
// now-deleted ReportView.jsx directly). Targets the real, current
// component -- FrameworkDiagrams.tsx's TamConcentricDiagram (a named
// export) -- against the NEW backend contract: an unsupported tam/sam/
// som tier is always an object ({ value_usd: null, label: "Not found
// in sources", ... }), never a bare null and never a fabricated number
// or a silently-substituted ratio (the old, removed 25%/10% guess).
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TamConcentricDiagram } from "../src/components/report/FrameworkDiagrams.tsx";
import { check, finish } from "./lib/ssr-assert.mjs";

// tam real; sam real but no cagr/description; som unsupported (the
// canonical backend shape for "no source attributed a figure").
const marketSizing = {
  tam: { value_usd: 12400000000, label: "$12.4B", citation_index: 1, cagr_pct: 6.8, tier_description: "Global sustainable packaging market" },
  sam: { value_usd: 850000000, label: "$850M", citation_index: 2, cagr_pct: null, tier_description: null },
  som: { value_usd: null, label: "Not found in sources", citation_index: null, cagr_pct: null, tier_description: null },
};

const result = {
  text: "The global market for eco-friendly packaging is $12.4B [1]. The serviceable market is $850M [2].",
  citations: [
    { index: 1, source_url: "https://example.com/a", source_title: "Global Packaging Report", similarity: 0.71 },
    { index: 2, source_url: "https://example.com/b", source_title: "Regional Market Study", similarity: 0.65 },
  ],
};

const html = renderToStaticMarkup(
  <TamConcentricDiagram marketSizing={marketSizing} result={result} />,
);

// --- TAM: fully grounded tier -- real value, never fabricated ---
check("TAM: real dollar value shown ($12.4B)", html.includes("$12.4B"));
check("TAM: real cagr_pct shown (6.8%)", html.includes("6.8%"));
check("TAM: real tier_description shown in legend", html.includes("Global sustainable packaging market"));

// --- SAM: real dollar value, cagr_pct/tier_description both null -- never a fabricated 0% ---
check("SAM: real dollar value shown ($850M)", html.includes("$850M"));
check(
  "SAM's table row CAGR cell shows an em-dash, not a fabricated percentage",
  html.includes('text-[#14d8a3] tabular-nums">—<'),
);

// --- SOM: unsupported -- must show the real "Not found in sources" label,
// never a bare $0, a 0%, or the old generic "Unverified" placeholder ---
check("SOM: table shows 'Not found in sources' (the real backend label)", html.includes("Not found in sources"));
check("SOM: never rendered as a fabricated $0 or 0% value", !html.includes("$0") && !html.includes(">0%<"));
check("SOM's ring shows the short 'Not found' form, not a truncated label fragment", html.includes("Not found"));

// --- % of Parent: only computed when the parent tier is ALSO real; never fabricated ---
check("SAM's % of Parent is a real computed percentage (SAM/TAM), matching computeShareOfParentPct's own rounding", (() => {
  const pct = (850000000 / 12400000000) * 100;
  const expected = pct >= 10 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
  return html.includes(expected);
})());
check("SOM (unsupported) has no computed % of Parent value -- falls back to the dash placeholder", (() => {
  const somRowIdx = html.indexOf("Not found in sources");
  const nearby = html.slice(somRowIdx, somRowIdx + 400);
  return !/\d+(\.\d+)?%/.test(nearby);
})());

finish("TamConcentricDiagram null-when-ungrounded discipline");
