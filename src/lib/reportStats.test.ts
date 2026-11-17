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

test("computeReportStats calculates confidence, verdict, and deduplicated citations", () => {
  const full = makeSampleReport(["pestel", "porter", "swot", "tam"]);
  const stats = computeReportStats(full);
  assert.equal(stats.verifiedCount, 4);
  assert.equal(stats.totalFrameworks, 4);
  assert.equal(stats.confidencePct, 100);
  assert.equal(stats.verdictShort, "GO");
  assert.equal(stats.tone, "teal");
  assert.equal(stats.totalCitations, 8);
  assert.equal(stats.avgSimilarity, 80);

  const partial = makeSampleReport(["pestel", "porter"]);
  const partialStats = computeReportStats(partial);
  assert.equal(partialStats.confidencePct, 50);
  assert.equal(partialStats.verdictShort, "REWORK");
  assert.equal(partialStats.tone, "amber");

  const emptyVerified = makeSampleReport([]);
  const holdStats = computeReportStats(emptyVerified);
  assert.equal(holdStats.confidencePct, 0);
  assert.equal(holdStats.verdictShort, "HOLD");
  assert.equal(holdStats.tone, "red");
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

test("stage progression helpers map progress to active/done/pending", () => {
  assert.equal(stageIndexFromProgress(0), 0);
  assert.equal(stageIndexFromProgress(35), 1);
  assert.equal(stageIndexFromProgress(100), 4);
  assert.equal(stageStatusForIndex(0, 2), "done");
  assert.equal(stageStatusForIndex(2, 2), "active");
  assert.equal(stageStatusForIndex(4, 2), "pending");
  assert.equal(stageStatusForIndex(0, -1), "pending");
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
  assert.equal(cmp.confidenceDelta, 50);
  assert.equal(cmp.verifiedDelta, 2);
  assert.equal(cmp.tamA, "$18.6B");
  assert.equal(cmp.frameworkDiffs.length, 4);
});

test("computeShareOfParentPct and computeInsightSparkline calculate bounded series", () => {
  assert.equal(computeShareOfParentPct(4_100_000_000, 18_600_000_000), "22.0%");
  assert.equal(computeShareOfParentPct(220_000_000, 4_100_000_000), "5.37%");
  assert.equal(computeShareOfParentPct(null, 100), null);

  const report = makeSampleReport(["tam"]);
  const series = computeInsightSparkline(report.business_metrics.market_size, report);
  assert.equal(series.length >= 3, true);
  assert.equal(series.every((pt) => pt.v >= 0 && pt.v <= 100), true);
});

test("formatIdeaTitle extracts concise brand prefix when em-dash is present", () => {
  assert.equal(
    formatIdeaTitle("Halo Ledger — a financial OS for founders"),
    "Halo Ledger",
  );
  assert.equal(formatIdeaTitle(""), "Untitled Venture");
});
