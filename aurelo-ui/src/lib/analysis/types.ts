import type { GroundlyReport } from "@/lib/groundly/types";

export type StageId =
  | "ideating"
  | "researching"
  | "prototyping"
  | "testing"
  | "finalizing";

export type StageStatus = "done" | "active" | "pending";

export type Verdict = "strong" | "promising" | "risky" | "weak";

export type View = "compose" | "running" | "report";

export interface Stage {
  id: StageId;
  label: string;
  hint: string;
}

export interface MarketSlice {
  code: string;
  name: string;
  opportunity: number;
}

export interface Competitor {
  name: string;
  note: string;
}

export interface Insight {
  title: string;
  body: string;
}

export interface AnalysisReport {
  tagline: string;
  verdict: Verdict;
  score: number;
  tam: string;
  sam: string;
  som: string;
  tamNote: string;
  markets: MarketSlice[];
  competitors: Competitor[];
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  insights: Insight[];
  proTips: string[];
}

export interface Project {
  id: string;
  idea: string;
  createdAt: number;
  report: AnalysisReport;
  groundly?: GroundlyReport;
}

export const STAGES: Stage[] = [
  {
    id: "ideating",
    label: "Ideating",
    hint: "Framing the wedge, buyer, and unfair advantage",
  },
  {
    id: "researching",
    label: "Researching",
    hint: "Scanning markets, comps, and demand signals",
  },
  {
    id: "prototyping",
    label: "Prototyping",
    hint: "Stress-testing the offer and GTM motion",
  },
  {
    id: "testing",
    label: "Testing",
    hint: "Scoring risks, unit economics, and timing",
  },
  {
    id: "finalizing",
    label: "Finalizing",
    hint: "Packing TAM, insights, and next moves",
  },
];

export const MARKET_CODES = [
  "US",
  "UK",
  "IN",
  "DE",
  "CA",
  "AU",
  "SG",
  "AE",
  "BR",
] as const;

export const PRO_TIPS = [
  "TAM measures your total addressable market.",
  "SAM is the slice of TAM you can actually serve.",
  "SOM is the share you can realistically win first.",
  "A wedge beats a platform. Start painfully specific.",
  "Price is a positioning decision, not a spreadsheet leftover.",
  "Distribution is the product until it is not.",
];

export function stageStatus(progress: number, index: number): StageStatus {
  const start = index * 20;
  const end = start + 20;
  if (progress >= end) return "done";
  if (progress >= start) return "active";
  return "pending";
}

export function stageIndexFromProgress(progress: number): number {
  return Math.min(4, Math.floor(progress / 20));
}
