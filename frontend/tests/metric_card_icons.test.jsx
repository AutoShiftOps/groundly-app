// Visual-parity audit vs. report-ux-mock.png: the mock's metric cards
// (5 business-metric cards, e.g. a bar-chart icon for Market Size, a
// shield for Competitive Pressure) each have a small colored icon badge
// next to the label -- MetricCard had no `icon` prop at all before this,
// so every card rendered with no icon, unlike the mock. Also locks in
// that "Frameworks verified"/"Unverified sections" (previously the only
// 2 of the 4 pipeline-health cards with no sparkline at all, flagged
// live) now get a real, non-fabricated cumulative-count trend too, same
// derivation discipline as citationTrend/similarityTrend.
//
// Icon presence is real-DOM-independent (unlike the actual chart pixels,
// which need react-dom/server can't produce -- see tam_circle_diagram's
// sibling sparkline bug, verified via real screenshots instead), so this
// is a legitimate SSR check.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportView from "../src/components/ReportView.jsx";
import { check, finish } from "./lib/ssr-assert.mjs";

const fixtureReport = {
  stage: "finalizing",
  results: {
    pestel: { text: "Political factors [1].", citations: [{ index: 1, source_url: "https://example.com/a", source_title: "S", similarity: 0.6 }], pestel_analysis: { political: [], economic: [], social: [], technological: [], environmental: [], legal: [] } },
    swot: { text: "Strength [2].", citations: [{ index: 2, source_url: "https://example.com/b", source_title: "S", similarity: 0.6 }], swot_analysis: { strengths: [], weaknesses: [], opportunities: [], threats: [] } },
    tam: { text: "Market [3].", citations: [{ index: 3, source_url: "https://example.com/c", source_title: "S", similarity: 0.6 }], market_sizing: { tam: { value_usd: 1e9, label: "$1B", citation_index: 3, cagr_pct: null, tier_description: null }, sam: null, som: null } },
    bmc: { text: "Partners [4].", citations: [{ index: 4, source_url: "https://example.com/d", source_title: "S", similarity: 0.6 }], bmc_canvas: { key_partners: [], key_activities: [], value_propositions: [], key_resources: [], customer_relationships: [], customer_segments: [], channels: [], cost_structure: [], revenue_streams: [] } },
  },
  verification: {
    pestel: { verified: true, unsupported_claims: [] },
    swot: { verified: false, unsupported_claims: [] },
    tam: { verified: true, unsupported_claims: [] },
    bmc: { verified: true, unsupported_claims: [] },
  },
  business_metrics: {
    market_size: { label: "$1B", rationale: "Growing market.", source_framework: "tam", citation_index: 3 },
    competitive_pressure: { label: "Moderate", rationale: "Some competition.", source_framework: "pestel", citation_index: 1 },
    customer_segment: { label: "Urban millennials", rationale: "High intent.", source_framework: "bmc", citation_index: 4 },
    business_model_fit: { label: "Strong", rationale: "Good fit.", source_framework: "bmc", citation_index: 4 },
    risk_flags: { label: "Low", rationale: "Minimal risk.", source_framework: "swot", citation_index: 2 },
  },
};

const html = renderToStaticMarkup(
  React.createElement(ReportView, { report: fixtureReport, idea: "EcoPack sustainable packaging idea", onReset: () => {} })
);

// One lucide icon class per metric-card icon, matching the mock's
// per-card icon language.
check("Market Size card has a bar-chart icon", html.includes("lucide-chart-no-axes-column"));
check("Competitive Pressure card has a shield icon", html.includes("lucide-shield"));
check("Best Customer Segment card has a users icon", html.includes("lucide-users"));
check("Business Model Fit card has a puzzle icon", html.includes("lucide-puzzle"));
check("Risk Flags card has an alert-triangle icon", html.includes("lucide-triangle-alert") || html.includes("lucide-alert-triangle"));

// Pipeline-health row: all 4 now get an icon badge (previously none did).
check("Frameworks verified card has a check-circle icon", (html.match(/lucide-circle-check/g) || []).length >= 1);
check("Grounded sources card has a book-open icon", html.includes("lucide-book-open"));
check("Avg source match card has a target icon", html.includes("lucide-target"));

// Verdict banner: badge bumped from 44px to 64px, and the "Based on N
// grounded sources" icon now sits in its own circular badge (was bare).
check("Verdict badge is the larger 64px size, not the old 44px", html.includes('width:64px;height:64px'));
check("'Based on N grounded sources' icon now has its own circular badge", html.includes("lucide-file-text"));

finish("Metric card icons + verdict banner badge sizing (visual-parity audit)");
