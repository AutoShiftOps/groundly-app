export const FRAMEWORKS = [
  "pestel",
  "porter",
  "swot",
  "tam",
  "stp",
  "bcg",
  "ansoff",
  "value_chain",
  "bmc",
  "balanced_scorecard",
] as const;

export type FrameworkKey = (typeof FRAMEWORKS)[number];

export interface GroundlyCitation {
  index: number;
  source_title: string;
  source_url: string;
  similarity: number;
}

export interface MarketSizing {
  tam?: { value: string | null; note?: string | null } | null;
  sam?: { value: string | null; note?: string | null } | null;
  som?: { value: string | null; note?: string | null } | null;
}

export interface FrameworkResult {
  text: string;
  citations: GroundlyCitation[];
  market_sizing?: MarketSizing | null;
}

export interface FrameworkVerification {
  verified: boolean;
  unsupported_claims?: string[];
}

export interface BusinessMetric {
  label: string;
  rationale: string;
  citation_index: number | null;
  source_framework?: string;
}

export interface GroundlyReport {
  stage: string;
  frameworks_requested: string[];
  frameworks_allowed: string[];
  results: Record<string, FrameworkResult>;
  verification: Record<string, FrameworkVerification>;
  business_metrics: {
    market_size: BusinessMetric | null;
    competitive_pressure: BusinessMetric | null;
    customer_segment: BusinessMetric | null;
    business_model_fit: BusinessMetric | null;
    risk_flags: BusinessMetric | null;
  };
  source?: "groundly" | "grok" | "local";
}

export interface AskResponse {
  answer: string;
  grounded: boolean;
  sources: {
    framework: string;
    citation_index: number | null;
    source_title?: string | null;
    source_url?: string | null;
  }[];
}
