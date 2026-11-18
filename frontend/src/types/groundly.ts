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
  // Real pgvector cosine score for vector-retrieved citations; null for
  // directory citations (agents/mississauga_data.py), which never go
  // through pgvector -- never synthesized on the backend either way.
  similarity: number | null;
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
  // unify/2c-claim-quality: "fact" needs a real citation and is
  // checked against its source; "analysis" is the model's own
  // judgment, always citation_index: null, and never carries a
  // figure/percentage/named company. Optional/undefined on frameworks
  // not yet migrated (tam/bcg/ansoff keep their own stricter numeric
  // backstops instead) -- treat a missing value the same as "fact".
  claim_type?: "fact" | "analysis";
}

export interface FrameworkResult {
  text: string;
  citations: GroundlyCitation[];
  // Real, per-framework LLM-generated fields (agents/rag_pipeline.py's
  // ASSUMPTIONS_ACTIONS_SUFFIX) -- 2-3 items each, specific to this
  // idea's own analysis, never a generic fallback. Optional because a
  // framework whose generation failed to parse can still omit them.
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

export interface VerifiedClaim {
  text: string;
  citation_indices: number[];
  verdict: "supported" | "partially_supported" | "unsupported";
  reason: string;
  claim_type?: "fact" | "analysis";
}

export interface FrameworkVerification {
  verified: boolean;
  unsupported_claims?: string[];
  // Per-claim results from agents/claim_verifier.py's real LLM
  // verifier -- every cited claim (narrative [N] sentences and every
  // structured point/tier with a citation_index) gets one entry here,
  // including ones that passed. unsupported_claims above stays the
  // flat "what failed and why" list the Verification Flags panel
  // already rendered; claims is the fuller per-claim breakdown.
  claims?: VerifiedClaim[];
  // unify/2c-claim-quality: counts for the "X of Y facts supported"
  // badge. facts_total/facts_supported cover only claim_type="fact"
  // claims (narrative [N] sentences + every fact-typed structured
  // point); analysis_count is the number of claim_type="analysis"
  // points, shown with a separate "Analysis" label, not counted
  // toward the supported fraction.
  facts_total?: number;
  facts_supported?: number;
  analysis_count?: number;
  repair_log?: {
    claims_before: number;
    supported_before: number;
    supported_after: number;
    dropped: number;
    converted: number;
    rewritten: number;
    moved_to_assumptions: number;
  };
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
  // Real City of Mississauga open-data business-directory lookup
  // (agents/mississauga_data.py) -- present only when the request's
  // geography qualified (Mississauga/GTA/Ontario); undefined/null
  // otherwise, never a fabricated default. See ReportView.tsx's
  // directory badge, which renders only when directory_status is set.
  directory_status?: "found" | "sector_context" | "not_found" | null;
  directory_matches?: number | null;
  directory_exact_match?: boolean | null;
  directory_total_sector?: number | null;
  // Whole-report retrieval-health summary computed from the same real
  // citations the UI itself renders -- "grounded" if at least one
  // framework has a real citation, "unavailable" otherwise.
  rag_status?: "grounded" | "search_text_only" | "unavailable" | null;
  // The geography actually used for retrieval/directory lookup (always
  // present) and whether the backend applied its own default because
  // the request sent none -- shown in the report header so a user who
  // never typed a geography can see why directory data appears at all.
  geography?: string;
  geography_defaulted?: boolean;
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
