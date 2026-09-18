const STRUCTURED_KEYS = {
  pestel: ["political", "economic", "social", "technological", "environmental", "legal"],
  swot: ["strengths", "weaknesses", "opportunities", "threats"],
  porter: [
    "competitive_rivalry",
    "threat_of_new_entrants",
    "bargaining_power_of_suppliers",
    "bargaining_power_of_buyers",
    "threat_of_substitutes",
  ],
  stp: ["segmentation", "targeting", "positioning"],
  bmc: [
    "key_partners",
    "key_activities",
    "value_propositions",
    "key_resources",
    "customer_relationships",
    "customer_segments",
    "channels",
    "cost_structure",
    "revenue_streams",
  ],
  value_chain: [
    "firm_infrastructure",
    "human_resource_management",
    "technology_development",
    "procurement",
    "inbound_logistics",
    "operations",
    "outbound_logistics",
    "marketing_and_sales",
    "service",
  ],
  balanced_scorecard: ["financial", "customer", "internal_process", "learning_and_growth"],
};

export function hydrateReport(report) {
  if (!report?.results) return report;
  const results = {};
  for (const [key, value] of Object.entries(report.results)) {
    results[key] = value;
  }
  return { ...report, results };
}
