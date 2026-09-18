// frontend/src/lib/reportStats.js
//
// Extracted from ReportView.jsx's own useReportStats hook (same logic,
// as a plain function) so the new Projects/Insights/Market screens can
// compute the exact same real verdict/confidence numbers for a SAVED
// report as the live report view shows for the active one -- one
// computation, not a second hand-copied version that could drift.
// ReportView.jsx's hook now just wraps this in useMemo.
export function computeReportStats(report) {
  const frameworks = Object.keys(report?.results || {});
  const verifiedCount = frameworks.filter((fw) => report.verification?.[fw]?.verified).length;
  const totalFrameworks = frameworks.length;

  let totalCitations = 0, similaritySum = 0, similarityCount = 0;

  frameworks.forEach((fw) => {
    const citations = report.results[fw]?.citations || [];
    const seen = new Set();
    citations.forEach((c) => {
      if (!seen.has(c.source_url)) { seen.add(c.source_url); totalCitations += 1; }
      similaritySum += c.similarity;
      similarityCount += 1;
    });
  });

  const avgSimilarity = similarityCount ? Math.round((similaritySum / similarityCount) * 100) : 0;
  const confidencePct = totalFrameworks ? Math.round((verifiedCount / totalFrameworks) * 100) : 0;
  const unverifiedCount = totalFrameworks - verifiedCount;

  let verdict = "Insufficient Data", verdictSub = "Not enough grounded sources yet to form a verdict.", tone = "amber";
  if (totalFrameworks > 0 && verifiedCount === totalFrameworks) {
    verdict = "Proceed With Confidence";
    verdictSub = "All frameworks are backed by verified, grounded sources.";
    tone = "teal";
  } else if (verifiedCount > 0) {
    verdict = "Proceed With Caution";
    verdictSub = `${unverifiedCount} of ${totalFrameworks} sections need stronger sourcing.`;
    tone = "amber";
  } else if (totalFrameworks > 0) {
    verdict = "Gather More Sources";
    verdictSub = "No sections passed grounding verification yet.";
    tone = "red";
  }

  return { frameworks, verifiedCount, totalFrameworks, totalCitations, avgSimilarity, confidencePct, unverifiedCount, verdict, verdictSub, tone };
}
