// Restores the dropped citation_header_count.test.jsx/metric_card_icons
// coverage against the real current ReportView.tsx: the left framework-
// nav rail's per-framework citation count and Verified/Needs-sourcing
// badge are driven ONLY by the real report.results[fw].citations.length
// and report.verification[fw].verified -- never a hardcoded count
// (PR32's own fabrication fix: the nav used to hardcode "10" next to
// Overview regardless of how many frameworks actually ran) and never a
// badge that drifts from the real verification flag.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportView from "../src/components/report/ReportView.tsx";
import { check, finish } from "./lib/ssr-assert.mjs";

function citations(n, startIndex = 1) {
  return Array.from({ length: n }, (_, i) => ({
    index: startIndex + i,
    source_url: `https://example.com/${startIndex + i}`,
    source_title: `Source ${startIndex + i}`,
    similarity: 0.7,
  }));
}

const report = {
  stage: "finalizing",
  frameworks_requested: ["pestel", "swot", "tam"],
  frameworks_allowed: ["pestel", "swot", "tam"],
  results: {
    pestel: { text: "PESTEL analysis [1][2][3].", citations: citations(3, 1) },
    swot: { text: "SWOT analysis [1].", citations: citations(1, 10) },
    tam: { text: "TAM analysis.", citations: [] },
  },
  verification: {
    pestel: { verified: true, unsupported_claims: [] },
    swot: { verified: false, unsupported_claims: ["No inline citation markers found in output"] },
    tam: { verified: false, unsupported_claims: ["No grounded sources retrieved for this section"] },
  },
  business_metrics: {
    market_size: null, competitive_pressure: null, customer_segment: null,
    business_model_fit: null, risk_flags: null,
  },
};

const project = {
  id: "p1", title: "Test Venture", idea: "a test idea for citation counting",
  createdAt: Date.now(), versionLabel: "v1.0", report,
};

const html = renderToStaticMarkup(
  <ReportView project={project} projects={[project]} onStartNewAnalysis={() => {}} />,
);

// --- Overview nav button's own count is the real total framework count, never hardcoded ---
check("Overview nav shows the real total framework count (3), not a hardcoded 10", (() => {
  const overviewIdx = html.indexOf(">Overview<");
  const nearby = html.slice(overviewIdx, overviewIdx + 300);
  return /tabular-nums">\s*3\s*</.test(nearby.replace(/\s+/g, " "));
})());

// --- Header "N sources" reflects the real deduplicated citation count (3 + 1 + 0 = 4) ---
check("Header shows the real total citation count (4 sources)", html.includes("4 sources"));
check("Header never shows the wrong/stale total", !html.includes("3 sources") && !html.includes("5 sources"));

// --- Each framework's nav row shows its own real citation count ---
check("PESTEL nav row shows its real citation count (3)", (() => {
  const idx = html.indexOf(">PESTEL<");
  return /tabular-nums">3</.test(html.slice(idx, idx + 400));
})());
check("SWOT nav row shows its real citation count (1)", (() => {
  const idx = html.indexOf(">SWOT<");
  return /tabular-nums">1</.test(html.slice(idx, idx + 400));
})());
check("TAM nav row shows its real citation count (0), not a fabricated non-zero number", (() => {
  const idx = html.indexOf(">TAM SAM SOM<");
  return /tabular-nums">0</.test(html.slice(idx, idx + 400));
})());

// --- Verified badge presence matches verification[fw].verified exactly ---
check("PESTEL (verified: true) shows the Verified check icon", (() => {
  const idx = html.indexOf(">PESTEL<");
  return html.slice(idx, idx + 600).includes('aria-label="Verified"');
})());
check("SWOT (verified: false) shows the Needs-sourcing icon, not a Verified badge", (() => {
  const idx = html.indexOf(">SWOT<");
  const chunk = html.slice(idx, idx + 600);
  return chunk.includes('aria-label="Needs sourcing"') && !chunk.includes('aria-label="Verified"');
})());
check("TAM (verified: false, zero citations) also shows Needs-sourcing, not Verified", (() => {
  const idx = html.indexOf(">TAM SAM SOM<");
  const chunk = html.slice(idx, idx + 600);
  return chunk.includes('aria-label="Needs sourcing"') && !chunk.includes('aria-label="Verified"');
})());

finish("ReportView left-nav citation counts and verified badges reflect only real data");
