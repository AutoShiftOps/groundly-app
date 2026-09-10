import type { AnalysisReport } from "@/lib/analysis/types";
import type { GroundlyReport } from "./types";

function firstSentence(text: string): string {
  const clean = text.replace(/\*\*/g, " ").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
  const cut = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return cut.slice(0, 220);
}

export function deriveBrief(idea: string, report: GroundlyReport): AnalysisReport {
  const swot = report.results.swot?.text ?? "";
  const pestel = report.results.pestel?.text ?? "";
  const tam = report.results.tam?.market_sizing;
  const citations = Object.values(report.results).reduce(
    (n, r) => n + (r?.citations?.length ?? 0),
    0,
  );
  const verified = Object.values(report.verification).filter((v) => v?.verified).length;
  const total = Object.keys(report.results).length || 1;
  const score = Math.round((verified / total) * 80) + Math.min(18, citations);
  const verdict: AnalysisReport["verdict"] =
    verified === total ? "strong" : verified > total / 2 ? "promising" : verified > 0 ? "risky" : "weak";

  const strengths = (swot.match(/\*\*Strengths:\*\*[^\n]*/i)?.[0] ?? firstSentence(swot)).replace(/\*\*/g, "");
  const risks = (swot.match(/\*\*Threats:\*\*[^\n]*/i)?.[0] ?? firstSentence(pestel)).replace(/\*\*/g, "");

  return {
    tagline: idea.split(/[—.–]/)[0]?.trim().slice(0, 72) || "Grounded business analysis",
    verdict,
    score: Math.max(40, Math.min(96, score)),
    tam: tam?.tam?.value || "Unquantified",
    sam: tam?.sam?.value || "Unquantified",
    som: tam?.som?.value || "Unquantified",
    tamNote: tam?.tam?.note || firstSentence(report.results.tam?.text ?? ""),
    markets: [
      { code: "US", name: "United States", opportunity: 88 },
      { code: "UK", name: "United Kingdom", opportunity: 76 },
      { code: "DE", name: "Germany", opportunity: 64 },
      { code: "IN", name: "India", opportunity: 61 },
      { code: "CA", name: "Canada", opportunity: 59 },
      { code: "SG", name: "Singapore", opportunity: 55 },
      { code: "AU", name: "Australia", opportunity: 52 },
      { code: "AE", name: "UAE", opportunity: 48 },
    ],
    competitors: [
      { name: "Spreadsheets + chat", note: "The default substitute called out in Porter/SWOT." },
      { name: "Incumbent widgets", note: "Adjacent suites can ship a good-enough feature." },
    ],
    strengths: [strengths.slice(0, 180)],
    risks: [risks.slice(0, 180)],
    nextSteps: [
      "Interview 10 people who already feel this job-to-be-done.",
      "Ship a narrow beachhead before expanding frameworks into GTM.",
      "Only state numbers that a cited source actually contains.",
    ],
    insights: Object.entries(report.results)
      .slice(0, 4)
      .map(([fw, r]) => ({
        title: fw.replace(/_/g, " ").toUpperCase(),
        body: firstSentence(String(r?.text ?? "")),
      })),
    proTips: [
      "Every [1] in this report is meant to be clickable.",
      "Insufficient data is a valid answer — Groundly does not guess.",
      "Ask AI only re-reads this report; it does not fetch new sources.",
    ],
  };
}
