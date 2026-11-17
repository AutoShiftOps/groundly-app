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

export type StageId =
  | "ideating"
  | "researching"
  | "prototyping"
  | "testing"
  | "finalizing";

export type StageStatus = "done" | "active" | "pending";

export interface StageDefinition {
  id: StageId;
  label: string;
  subtitle: string;
  fact: string;
}

export interface GroundlyCitation {
  index: number;
  source_title: string;
  source_url: string;
  similarity: number;
  snippet?: string;
}

export interface MarketTier {
  value?: string | number | null;
  value_usd?: number | null;
  label?: string | null;
  note?: string | null;
  citation_index?: number | null;
  cagr_pct?: number | null;
  tier_description?: string | null;
}

export interface MarketSizing {
  tam?: MarketTier | null;
  sam?: MarketTier | null;
  som?: MarketTier | null;
}

export interface StructuredPoint {
  text: string;
  citation_index: number | null;
  metric_name?: string | null;
  metric_value?: string | number | null;
  target_value?: string | number | null;
}

export interface FrameworkResult {
  text: string;
  citations: GroundlyCitation[];
  assumptions?: string[];
  actions?: string[];
  market_sizing?: MarketSizing | null;
  pestel_analysis?: Record<string, StructuredPoint[]>;
  swot_analysis?: Record<string, StructuredPoint[]>;
  porter_forces?: Record<string, StructuredPoint[]>;
  stp_analysis?: Record<string, StructuredPoint[]>;
  bmc_canvas?: Record<string, StructuredPoint[]>;
  value_chain?: Record<string, StructuredPoint[]>;
  balanced_scorecard?: Record<string, StructuredPoint[]>;
  bcg_matrix?: {
    quadrant: "star" | "question_mark" | "cash_cow" | "dog" | string;
    market_growth_rate_pct?: number | null;
    market_share_position?: string | null;
    rationale?: string;
    citation_index?: number | null;
  } | null;
  ansoff_matrix?: {
    quadrant:
      | "market_penetration"
      | "product_development"
      | "market_development"
      | "diversification"
      | string;
    market_dimension?: string;
    product_dimension?: string;
    rationale?: string;
    citation_index?: number | null;
  } | null;
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
  directory_status?: "found" | "sector_context" | "not_found";
  directory_matches?: number;
  directory_exact_match?: boolean;
  directory_total_sector?: number;
  rag_status?: "grounded" | "search_text_only" | "unavailable";
  rag_detail?: string;
  source?: "gemini" | "demo";
}

export interface SavedProject {
  id: string;
  title: string;
  idea: string;
  industry?: string;
  geography?: string;
  createdAt: number;
  versionLabel: string;
  report: GroundlyReport;
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
