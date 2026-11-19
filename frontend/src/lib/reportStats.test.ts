import test from "node:test";
import assert from "node:assert/strict";
import {
  computeEvidenceScore,
  computeInsightSparkline,
  computeProjectComparison,
  computeReportStats,
  computeShareOfParentPct,
  dedupeCitations,
  formatIdeaTitle,
  STAGE_DEFINITIONS,
  stageIndexFromProgress,
  stageStatusForIndex,
} from "./reportStats";
import type { GroundlyReport, SavedProject } from "../types/groundly";

function makeSampleReport(verifiedKeys: string[]): GroundlyReport {
  const allKeys = ["pestel", "porter", "swot", "tam"];
  const results: GroundlyReport["results"] = {};
  const verification: GroundlyReport["verification"] = {};
  for (const key of allKeys) {
    results[key] = {
      text: `${key} analysis summary`,
      citations: [
        {
          index: 1,
          source_title: `Report ${key}`,
          source_url: `https://example.com/${key}`,
          similarity: 0.86,
        },
        {
          index: 2,
          source_title: "Shared Source",
          source_url: "https://example.com/shared",
          similarity: 0.74,
        },
      ],
      ...(key === "tam"
        ? {
            market_sizing: {
              tam: { label: "$18.6B", value_usd: 18_600_000_000, cagr_pct: 14.2 },
              sam: { label: "$4.1B", value_usd: 4_100_000_000, cagr_pct: 16.5 },
              som: { label: "$220M", value_usd: 220_000_000, cagr_pct: 21.0 },
            },
          }
        : {}),
    };
    verification[key] = {
      verified: verifiedKeys.includes(key),
      unsupported_claims: verifiedKeys.includes(key) ? [] : ["Missing source"],
    };
  }
  return {
    stage: "finalizing",
    frameworks_requested: allKeys,
    frameworks_allowed: allKeys,
    results,
    verification,
    business_metrics: {
      market_size: {
        label: "$18.6B TAM",
        rationale: "Growing seed finance ops spend",
        citation_index: 1,
        source_framework: "tam",
      },
      competitive_pressure: null,
      customer_segment: null,
      business_model_fit: null,
      risk_flags: null,
    },
  };
}

test("computeReportStats calculates the verified share, verdict, and deduplicated citations", () => {
  const full = makeSampleReport(["pestel", "porter", "swot", "tam"]);
  const stats = computeReportStats(full);
  assert.equal(stats.verifiedCount, 4);
  assert.equal(stats.totalFrameworks, 4);
  assert.equal(stats.verifiedPct, 100);
  assert.equal(stats.verdictShort, "GO");
  assert.equal(stats.tone, "teal");
  assert.equal(stats.totalCitations, 8);
  assert.equal(stats.avgSimilarity, 80);

  const partial = makeSampleReport(["pestel", "porter"]);
  const partialStats = computeReportStats(partial);
  assert.equal(partialStats.verifiedPct, 50);
  assert.equal(partialStats.verdictShort, "REWORK");
  assert.equal(partialStats.tone, "amber");

  const emptyVerified = makeSampleReport([]);
  const holdStats = computeReportStats(emptyVerified);
  assert.equal(holdStats.verifiedPct, 0);
  assert.equal(holdStats.verdictShort, "HOLD");
  assert.equal(holdStats.tone, "red");
});

// agents/mississauga_data.py's directory citations carry similarity:
// null (never pgvector-matched) -- averaging them in as 0% would
// misrepresent a report that's fully grounded in real, cited directory
// data as having a "0% match" quality score. avgSimilarity must ignore
// null-similarity citations entirely, and report null itself (not 0)
// when there's no real vector-matched citation anywhere to average.
test("computeReportStats never averages a directory citation's null similarity in as 0%", () => {
  const report = makeSampleReport(["pestel"]);
  report.results.pestel.citations = [
    { index: 1, source_title: "Directory", source_url: "https://services6.arcgis.com/x", similarity: null },
  ];
  const stats = computeReportStats(report);
  // Other frameworks still have real 0.86/0.74 citations, so the real
  // average must be unaffected by pestel's null-similarity citation.
  assert.equal(stats.avgSimilarity, 80);

  const allDirectoryReport = makeSampleReport([]);
  for (const key of Object.keys(allDirectoryReport.results)) {
    allDirectoryReport.results[key].citations = [
      { index: 1, source_title: "Directory", source_url: "https://services6.arcgis.com/x", similarity: null },
    ];
  }
  const allDirectoryStats = computeReportStats(allDirectoryReport);
  assert.equal(allDirectoryStats.avgSimilarity, null, "with zero real vector-matched citations, avgSimilarity must be null (not a fabricated 0%)");
  assert.equal(allDirectoryStats.totalCitations, 4, "directory citations still count toward totalCitations -- they're real, just not similarity-scored");
});

test("dedupeCitations removes duplicate source_url entries preserving order", () => {
  const deduped = dedupeCitations([
    { index: 1, source_title: "A", source_url: "https://a.com", similarity: 0.9 },
    { index: 2, source_title: "A dup", source_url: "https://a.com", similarity: 0.85 },
    { index: 3, source_title: "B", source_url: "https://b.com", similarity: 0.78 },
  ]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].index, 1);
  assert.equal(deduped[1].index, 3);
});

test("computeEvidenceScore computes /10 score from citation similarity", () => {
  const report = makeSampleReport(["tam"]);
  const score = computeEvidenceScore(report.business_metrics.market_size, report);
  assert.equal(score, 8.6);
});

test("computeEvidenceScore returns null (never a fabricated 0) when the cited citation's similarity is null", () => {
  // `null * 100` silently coerces to 0 in JS -- the real bug this
  // guards against: a directory citation (similarity: null) must never
  // produce a fake "0.0" evidence score.
  const report = makeSampleReport(["tam"]);
  report.results.tam.citations = [
    { index: 1, source_title: "Mississauga Business Directory", source_url: "https://arcgis.example.com", similarity: null },
  ];
  report.business_metrics.market_size = { label: "$1B", rationale: "x", citation_index: 1, source_framework: "tam" };
  const score = computeEvidenceScore(report.business_metrics.market_size, report);
  assert.equal(score, null);
});

test("computeEvidenceScore's fallback average skips null similarities instead of averaging them in as 0", () => {
  const report = makeSampleReport(["tam"]);
  report.results.tam.citations = [
    { index: 1, source_title: "Directory", source_url: "https://arcgis.example.com", similarity: null },
    { index: 2, source_title: "Web", source_url: "https://example.com/2", similarity: 0.8 },
  ];
  // No citation_index -- computeEvidenceScore falls back to averaging
  // every citation's similarity; only the one real score (0.8) should
  // count, not (null + 0.8) / 2.
  report.business_metrics.market_size = { label: "$1B", rationale: "x", citation_index: null, source_framework: "tam" };
  const score = computeEvidenceScore(report.business_metrics.market_size, report);
  assert.equal(score, 8);
});

test("stage progression helpers map progress to passed/active/pending while waiting", () => {
  assert.equal(stageIndexFromProgress(0), 0);
  assert.equal(stageIndexFromProgress(35), 1);
  assert.equal(stageIndexFromProgress(100), 4);
  assert.equal(stageStatusForIndex(0, 2), "passed");
  assert.equal(stageStatusForIndex(2, 2), "active");
  assert.equal(stageStatusForIndex(4, 2), "pending");
  assert.equal(stageStatusForIndex(0, -1), "pending");
});

test("STAGE_DEFINITIONS has the 5 real pipeline stages, with no unsourced 'fact' lines", () => {
  assert.deepEqual(
    STAGE_DEFINITIONS.map((s) => s.label),
    ["Reading idea", "Searching sources", "Writing analysis", "Checking claims", "Building report"],
  );
  for (const stage of STAGE_DEFINITIONS) {
    assert.ok(stage.subtitle.length > 0);
    assert.equal("fact" in stage, false);
  }
});

test("no stage shows done before the report arrives; all tick together once it does", () => {
  // Every timer position the loading screen can reach while waiting
  // (App caps progress at 92 until the response arrives).
  for (let progress = 0; progress <= 92; progress += 0.9) {
    const active = stageIndexFromProgress(progress);
    for (let i = 0; i < STAGE_DEFINITIONS.length; i++) {
      assert.notEqual(stageStatusForIndex(i, active), "done", `stage ${i} at ${progress}%`);
    }
  }
  const atArrival = stageIndexFromProgress(100);
  assert.deepEqual(
    STAGE_DEFINITIONS.map((_, i) => stageStatusForIndex(i, atArrival, true)),
    ["done", "done", "done", "done", "done"],
  );
});

test("computeProjectComparison produces accurate deltas between versions", () => {
  const p1: SavedProject = {
    id: "a",
    title: "V1",
    idea: "Test idea",
    createdAt: 1000,
    versionLabel: "v1.0",
    report: makeSampleReport(["pestel", "porter"]),
  };
  const p2: SavedProject = {
    id: "b",
    title: "V2",
    idea: "Test idea refined",
    createdAt: 2000,
    versionLabel: "v2.0",
    report: makeSampleReport(["pestel", "porter", "swot", "tam"]),
  };
  const cmp = computeProjectComparison(p1, p2);
  assert.equal(cmp.verifiedDelta, 2); // frameworks, not percentage points
  assert.equal("confidenceDelta" in cmp, false);
  assert.equal(cmp.tamA, "$18.6B");
  assert.equal(cmp.frameworkDiffs.length, 4);
});

test("computeShareOfParentPct calculates bounded percentages honestly", () => {
  assert.equal(computeShareOfParentPct(4_100_000_000, 18_600_000_000), "22.0%");
  assert.equal(computeShareOfParentPct(220_000_000, 4_100_000_000), "5.37%");
  assert.equal(computeShareOfParentPct(null, 100), null);
});

// computeInsightSparkline must never fabricate a trend: with fewer than 3
// real per-citation similarity values (the sample report's "tam" framework
// has exactly 2), there isn't enough real data to plot a meaningful line,
// so it returns null rather than inventing one from a single evidence
// score (the previous, now-removed behavior).
test("computeInsightSparkline returns null instead of a fabricated trend when under 3 citations", () => {
  const report = makeSampleReport(["tam"]);
  const series = computeInsightSparkline(report.business_metrics.market_size, report);
  assert.equal(series, null);
});

test("computeInsightSparkline returns the real per-citation similarity series when enough citations exist", () => {
  const report = makeSampleReport(["tam"]);
  report.results.tam.citations = [
    { index: 1, source_title: "A", source_url: "https://a.com", similarity: 0.9 },
    { index: 2, source_title: "B", source_url: "https://b.com", similarity: 0.8 },
    { index: 3, source_title: "C", source_url: "https://c.com", similarity: 0.7 },
  ];
  const series = computeInsightSparkline(report.business_metrics.market_size, report);
  assert.deepEqual(series, [{ v: 90 }, { v: 80 }, { v: 70 }]);
});

test("formatIdeaTitle extracts concise brand prefix when em-dash is present", () => {
  assert.equal(
    formatIdeaTitle("Halo Ledger — a financial OS for founders"),
    "Halo Ledger",
  );
  assert.equal(formatIdeaTitle(""), "Untitled Venture");
});
