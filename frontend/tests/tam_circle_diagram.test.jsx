// Restores the dropped tam_circle_diagram.test.jsx coverage against the
// real current component (FrameworkDiagrams.tsx's TamConcentricDiagram):
// a real tier renders a filled, solid-stroke circle; a tier with no real
// value_usd renders the dashed "ghost ring" style, never a filled circle
// dressed up to look like real data.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TamConcentricDiagram } from "../src/components/report/FrameworkDiagrams.tsx";
import { check, finish } from "./lib/ssr-assert.mjs";

const allRealMarketSizing = {
  tam: { value_usd: 6100000000, label: "$6.1B", citation_index: 1, cagr_pct: 20, tier_description: "Global home EV charging market" },
  sam: { value_usd: 330000000, label: "$330M", citation_index: 3, cagr_pct: null, tier_description: "Home charging subscription market" },
  som: { value_usd: 8000000, label: "$8M", citation_index: 2, cagr_pct: null, tier_description: "Projected 3-year revenue" },
};

const htmlAllReal = renderToStaticMarkup(<TamConcentricDiagram marketSizing={allRealMarketSizing} />);

check("All 3 present tiers render as exactly 3 circles", (htmlAllReal.match(/<circle/g) || []).length === 3);
check("TAM ring uses its real gradient fill (url(#tamGrad)), not 'none'", htmlAllReal.includes('fill="url(#tamGrad)"'));
check("SAM ring uses its real gradient fill (url(#samGrad)), not 'none'", htmlAllReal.includes('fill="url(#samGrad)"'));
check("SOM ring uses its real gradient fill (url(#somGrad)), not 'none'", htmlAllReal.includes('fill="url(#somGrad)"'));
check("No ring uses the dashed ghost-ring stroke when every tier is real", !htmlAllReal.includes('stroke-dasharray="5 5"'));
check("TAM value rendered inline in the ring itself", htmlAllReal.includes("$6.1B"));
check("SAM value rendered inline in the ring itself", htmlAllReal.includes("$330M"));
check("SOM value rendered inline in the ring itself", htmlAllReal.includes("$8M"));

const somMissingMarketSizing = {
  tam: allRealMarketSizing.tam,
  sam: allRealMarketSizing.sam,
  som: { value_usd: null, label: "Not found in sources", citation_index: null, cagr_pct: null, tier_description: null },
};

const htmlSomMissing = renderToStaticMarkup(<TamConcentricDiagram marketSizing={somMissingMarketSizing} />);

check("SOM's ring falls back to the dashed ghost-ring style when unsupported", htmlSomMissing.includes('stroke-dasharray="5 5"'));
check("SOM's ring is unfilled ('none'), not dressed up with the real gradient", (() => {
  const somCircleIdx = htmlSomMissing.indexOf('cy="189"');
  const circleTag = htmlSomMissing.slice(Math.max(0, somCircleIdx - 200), somCircleIdx + 50);
  return circleTag.includes('fill="none"');
})());
check("TAM/SAM rings stay solid (real data) even though SOM is unsupported -- per-tier, not all-or-nothing", (() => {
  const dashedCount = (htmlSomMissing.match(/stroke-dasharray="5 5"/g) || []).length;
  return dashedCount === 1; // only SOM's ring, not TAM/SAM too
})());

finish("TAM SAM SOM circle diagram: per-tier real-vs-unsupported styling");
