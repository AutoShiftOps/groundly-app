import type {
  BusinessMetric,
  FrameworkKey,
  GroundlyCitation,
  GroundlyReport,
  SavedProject,
  StageDefinition,
  StageStatus,
} from "../types/groundly";

// What the backend pipeline actually does, in order. Five stages so the
// train geometry (one car per stage) is unchanged.
export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: "reading",
    label: "Reading idea",
    subtitle: "Understanding the idea, market category and geography",
  },
  {
    id: "searching",
    label: "Searching sources",
    subtitle: "Mississauga Open Data, the research library and the web",
  },
  {
    id: "writing",
    label: "Writing analysis",
    subtitle: "Drafting all 10 frameworks from the sources found",
  },
  {
    id: "checking",
    label: "Checking claims",
    subtitle: "Verifying every fact against its cited source",
  },
  {
    id: "building",
    label: "Building report",
    subtitle: "Scores, summary and sources list",
  },
];

export type VerdictTone = "teal" | "amber" | "red";

export interface ReportStats {
  frameworks: string[];
  verifiedCount: number;
  totalFrameworks: number;
  totalCitations: number;
  // null when every citation is a directory citation (no real pgvector
  // score at all) -- "0% match" would misrepresent that as a bad score
  // rather than "not applicable."
  avgSimilarity: number | null;
  confidencePct: number;
  unverifiedCount: number;
  verdict: string;
  verdictShort: "GO" | "REWORK" | "HOLD";
  verdictSub: string;
  tone: VerdictTone;
}

export interface MetricTrends {
  citationTrend: { v: number }[];
  similarityTrend: { v: number }[];
  verifiedTrend: { v: number }[];
  unverifiedTrend: { v: number }[];
}

export interface CitedItemWithFramework extends GroundlyCitation {
  framework: string;
}

export interface ProjectComparison {
  confidenceDelta: number;
  citationDelta: number;
  similarityDelta: number;
  verifiedDelta: number;
  tamA: string;
  tamB: string;
  samA: string;
  samB: string;
  somA: string;
  somB: string;
  frameworkDiffs: {
    key: string;
    verifiedA: boolean;
    verifiedB: boolean;
    citationsA: number;
    citationsB: number;
  }[];
}

// The backend returns the whole report in one response, so the stage index
// while waiting comes from a timer, not real progress. Stages behind the
// timer are only "passed"; every stage becomes "done" together, and only
// once the report has actually arrived.
export function stageStatusForIndex(
  index: number,
  activeStageIndex: number,
  reportArrived = false,
): StageStatus {
  if (reportArrived) return "done";
  if (activeStageIndex < 0) return "pending";
  if (index < activeStageIndex) return "passed";
  if (index === activeStageIndex) return "active";
  return "pending";
}

export function stageIndexFromProgress(progress: number): number {
  if (progress <= 0) return 0;
  return Math.min(4, Math.floor(Math.min(99.9, progress) / 20));
}

export function dedupeCitations(
  citations: GroundlyCitation[] | undefined,
): GroundlyCitation[] {
  if (!citations || citations.length === 0) return [];
  const seen = new Set<string>();
  const out: GroundlyCitation[] = [];
  for (const c of citations) {
    const key = c.source_url || `${c.index}-${c.source_title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function collectAllCitations(
  report: GroundlyReport | null | undefined,
): CitedItemWithFramework[] {
  if (!report?.results) return [];
  const seen = new Set<string>();
  const out: CitedItemWithFramework[] = [];
  for (const [fw, result] of Object.entries(report.results)) {
    for (const c of result.citations || []) {
      const key = c.source_url || `${c.index}-${c.source_title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...c, framework: fw });
    }
  }
  return out;
}

export function computeReportStats(
  report: GroundlyReport | null | undefined,
): ReportStats {
  const frameworks = Object.keys(report?.results || {});
  const totalFrameworks = frameworks.length;
  const verifiedCount = frameworks.filter(
    (fw) => report?.verification?.[fw]?.verified,
  ).length;

  let totalCitations = 0;
  let similaritySum = 0;
  let similarityCount = 0;

  for (const fw of frameworks) {
    const citations = report?.results?.[fw]?.citations || [];
    const seen = new Set<string>();
    for (const c of citations) {
      const key = c.source_url || `${c.index}-${c.source_title}`;
      if (!seen.has(key)) {
        seen.add(key);
        totalCitations += 1;
      }
      // Directory citations (agents/mississauga_data.py) carry
      // similarity: null -- they were never pgvector-matched, so
      // averaging them in as if they scored 0% would understate the
      // real vector-matched citations' quality. Only real scores count
      // toward this average.
      if (typeof c.similarity === "number") {
        similaritySum += c.similarity;
        similarityCount += 1;
      }
    }
  }

  const avgSimilarity = similarityCount
    ? Math.round((similaritySum / similarityCount) * 100)
    : null;
  const confidencePct = totalFrameworks
    ? Math.round((verifiedCount / totalFrameworks) * 100)
    : 0;
  const unverifiedCount = totalFrameworks - verifiedCount;

  let verdict = "Insufficient Data";
  let verdictShort: "GO" | "REWORK" | "HOLD" = "HOLD";
  let verdictSub = "Not enough grounded sources yet to form a verdict.";
  let tone: VerdictTone = "amber";

  if (totalFrameworks > 0 && verifiedCount === totalFrameworks) {
    verdict = "Proceed With Confidence";
    verdictShort = "GO";
    verdictSub = "All 10 strategic frameworks are backed by grounded citations.";
    tone = "teal";
  } else if (verifiedCount >= Math.ceil(totalFrameworks * 0.5) && verifiedCount > 0) {
    verdict = "Proceed With Caution";
    verdictShort = "REWORK";
    verdictSub = `${unverifiedCount} of ${totalFrameworks} sections require stronger empirical sourcing.`;
    tone = "amber";
  } else if (totalFrameworks > 0) {
    verdict = "Gather More Sources";
    verdictShort = "HOLD";
    verdictSub = "Core strategic assumptions lack sufficient external grounding.";
    tone = "red";
  }

  return {
    frameworks,
    verifiedCount,
    totalFrameworks,
    totalCitations,
    avgSimilarity,
    confidencePct,
    unverifiedCount,
    verdict,
    verdictShort,
    verdictSub,
    tone,
  };
}

export function computeMetricTrends(
  report: GroundlyReport | null | undefined,
): MetricTrends {
  const frameworks = Object.keys(report?.results || {});
  let cumulativeCitations = 0;
  let cumulativeVerified = 0;
  let cumulativeUnverified = 0;
  const citationTrend: { v: number }[] = [];
  const similarityTrend: { v: number }[] = [];
  const verifiedTrend: { v: number }[] = [];
  const unverifiedTrend: { v: number }[] = [];

  for (const fw of frameworks) {
    const citations = report?.results?.[fw]?.citations || [];
    const seen = new Set<string>();
    let simSum = 0;
    for (const c of citations) {
      const key = c.source_url || `${c.index}-${c.source_title}`;
      if (!seen.has(key)) {
        seen.add(key);
        cumulativeCitations += 1;
      }
      simSum += c.similarity;
    }
    citationTrend.push({ v: cumulativeCitations });
    similarityTrend.push({
      v: citations.length ? Math.round((simSum / citations.length) * 100) : 0,
    });
    if (report?.verification?.[fw]?.verified) cumulativeVerified += 1;
    else cumulativeUnverified += 1;
    verifiedTrend.push({ v: cumulativeVerified });
    unverifiedTrend.push({ v: cumulativeUnverified });
  }

  return {
    citationTrend,
    similarityTrend,
    verifiedTrend,
    unverifiedTrend,
  };
}

export function computeEvidenceScore(
  metric: BusinessMetric | null | undefined,
  report: GroundlyReport | null | undefined,
): number | null {
  if (!metric || !report) return null;
  const fw = metric.source_framework;
  const citations = fw ? report.results?.[fw]?.citations || [] : [];
  if (citations.length === 0) return null;
  const cited = metric.citation_index
    ? citations.find((c) => c.index === metric.citation_index)
    : null;
  const similarity = cited
    ? cited.similarity
    : citations.reduce((sum, c) => sum + c.similarity, 0) / citations.length;
  return Math.round(similarity * 100) / 10;
}

export function computeProjectComparison(
  projectA: SavedProject,
  projectB: SavedProject,
): ProjectComparison {
  const statsA = computeReportStats(projectA.report);
  const statsB = computeReportStats(projectB.report);

  const allKeys = Array.from(
    new Set([...statsA.frameworks, ...statsB.frameworks]),
  ) as FrameworkKey[];

  const tamSizingA = projectA.report.results?.tam?.market_sizing;
  const tamSizingB = projectB.report.results?.tam?.market_sizing;

  return {
    confidenceDelta: statsB.confidencePct - statsA.confidencePct,
    citationDelta: statsB.totalCitations - statsA.totalCitations,
    similarityDelta: (statsB.avgSimilarity ?? 0) - (statsA.avgSimilarity ?? 0),
    verifiedDelta: statsB.verifiedCount - statsA.verifiedCount,
    tamA: tamSizingA?.tam?.label || "—",
    tamB: tamSizingB?.tam?.label || "—",
    samA: tamSizingA?.sam?.label || "—",
    samB: tamSizingB?.sam?.label || "—",
    somA: tamSizingA?.som?.label || "—",
    somB: tamSizingB?.som?.label || "—",
    frameworkDiffs: allKeys.map((key) => ({
      key,
      verifiedA: Boolean(projectA.report.verification?.[key]?.verified),
      verifiedB: Boolean(projectB.report.verification?.[key]?.verified),
      citationsA: projectA.report.results?.[key]?.citations?.length || 0,
      citationsB: projectB.report.results?.[key]?.citations?.length || 0,
    })),
  };
}

export function computeShareOfParentPct(
  childUsd: number | null | undefined,
  parentUsd: number | null | undefined,
): string | null {
  if (
    childUsd == null ||
    parentUsd == null ||
    !Number.isFinite(childUsd) ||
    !Number.isFinite(parentUsd) ||
    parentUsd <= 0 ||
    childUsd <= 0
  ) {
    return null;
  }
  const pct = (childUsd / parentUsd) * 100;
  return pct >= 10 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
}

// Returns real per-citation similarity values for this metric's source
// framework, or null when there isn't enough real data to plot a
// meaningful line. Previously this fabricated a 6-point "trend" out of a
// single evidence score (with made-up +/- offsets) whenever fewer than 3
// citations existed -- removed: a sparkline with no real backing data is
// an honest gap, not something to paper over with an invented shape.
export function computeInsightSparkline(
  metric: BusinessMetric | null | undefined,
  report: GroundlyReport | null | undefined,
): { v: number }[] | null {
  const fw = metric?.source_framework;
  const citations = fw ? report?.results?.[fw]?.citations || [] : [];
  const real = citations.filter((c) => typeof c.similarity === "number");
  if (real.length < 3) return null;
  return real.map((c) => ({ v: Math.round(c.similarity * 100) }));
}

export function formatIdeaTitle(idea: string): string {
  const clean = idea.trim();
  if (!clean) return "Untitled Venture";
  const dashSplit = clean.split("—")[0]?.trim();
  if (dashSplit && dashSplit.length >= 3 && dashSplit.length <= 42) {
    return dashSplit;
  }
  return clean.length > 56 ? `${clean.slice(0, 56)}…` : clean;
}
