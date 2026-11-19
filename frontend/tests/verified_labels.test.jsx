// fix/verified-labels: the "verified frameworks / total" number is shown as
// "Verified" with framework counts everywhere -- never as "confidence" or
// a percentage that reads like a probability.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompareModal } from "../src/components/report/CompareModal.tsx";
import { InsightsScreen, ProjectsScreen } from "../src/components/workspace/SecondaryScreens.tsx";
import { FRAMEWORK_NAV_ITEMS } from "../src/components/report/frameworkMeta.ts";
import { check, finish } from "./lib/ssr-assert.mjs";

const KEYS = FRAMEWORK_NAV_ITEMS.map((i) => i.key);

function project(id, verifiedCount, createdAt) {
  const results = {};
  const verification = {};
  KEYS.forEach((key, i) => {
    results[key] = {
      text: `${key} [1].`,
      citations: [{ index: 1, source_url: `https://example.com/${id}/${key}`, source_title: key, similarity: 0.7 }],
    };
    verification[key] = { verified: i < verifiedCount, unsupported_claims: [], claims: [] };
  });
  return {
    id,
    title: `Idea ${id}`,
    idea: "A test idea",
    createdAt,
    versionLabel: `v${id}`,
    report: { stage: "finalizing", frameworks_requested: KEYS, frameworks_allowed: KEYS, results, verification, business_metrics: {} },
  };
}

const baseline = project("1", 6, 1000);
const active = project("2", 7, 2000);
const noop = () => {};

// Compare: baseline (6/10) -> active (7/10), +1 framework.
const compareHtml = renderToStaticMarkup(<CompareModal currentProject={active} projects={[baseline, active]} onClose={noop} />);
check("Compare modal labels the metric 'Verified'", compareHtml.includes(">Verified<"));
check("Compare modal shows framework counts 6/10 → 7/10", compareHtml.includes("6/10 → 7/10"));
check("Compare modal shows the delta in frameworks (+1 framework)", compareHtml.includes("+1 framework"));
check("Compare modal never says 'confidence' or shows a % delta", !/confidence/i.test(compareHtml) && !/%\s*delta/.test(compareHtml));

const worse = renderToStaticMarkup(<CompareModal currentProject={baseline} projects={[baseline, active]} onClose={noop} />);
check("A drop shows a negative framework delta (-1 framework)", worse.includes("7/10 → 6/10") && worse.includes("-1 framework"));

// Projects: average of 6/10 and 7/10 is 6.5/10.
const projectsHtml = renderToStaticMarkup(
  <ProjectsScreen projects={[baseline, active]} onOpenProject={noop} onDeleteProject={noop} onNewAnalysis={noop} />,
);
check("Projects screen says 'Avg verified'", projectsHtml.includes("Avg verified"));
check("Projects screen shows the average as 6.5/10", projectsHtml.includes("6.5/10"));
check("Project cards show each report's verified count (6/10, 7/10)", projectsHtml.includes("6/10") && projectsHtml.includes("7/10"));
check("Projects screen never says 'confidence'", !/confidence/i.test(projectsHtml));

const emptyHtml = renderToStaticMarkup(<ProjectsScreen projects={[]} onOpenProject={noop} onDeleteProject={noop} onNewAnalysis={noop} />);
check("No projects: no average is shown at all, never a fabricated 0/10", !emptyHtml.includes("0/10"));

const insightsHtml = renderToStaticMarkup(<InsightsScreen projects={[baseline, active]} onOpenProject={noop} />);
check("Insights lists '6/10 verified', never '% confidence'", insightsHtml.includes("6/10 verified") && !/confidence/i.test(insightsHtml));

finish("Verified labels: framework counts, never 'confidence'");
