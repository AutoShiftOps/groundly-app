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

const LABEL_ALIASES = {
  political: ["political"],
  economic: ["economic"],
  social: ["social"],
  technological: ["technological", "technology"],
  environmental: ["environmental", "environment"],
  legal: ["legal"],
  strengths: ["strengths", "strength"],
  weaknesses: ["weaknesses", "weakness"],
  opportunities: ["opportunities", "opportunity"],
  threats: ["threats", "threat"],
  competitive_rivalry: ["competitive rivalry", "rivalry"],
  threat_of_new_entrants: ["threat of new entrants", "new entrants", "entrants"],
  bargaining_power_of_suppliers: ["bargaining power of suppliers", "supplier power", "suppliers"],
  bargaining_power_of_buyers: ["bargaining power of buyers", "buyer power", "buyers"],
  threat_of_substitutes: ["threat of substitutes", "substitutes"],
  segmentation: ["segmentation"],
  targeting: ["targeting"],
  positioning: ["positioning"],
  key_partners: ["key partners", "partners"],
  key_activities: ["key activities", "activities"],
  value_propositions: ["value propositions", "value prop"],
  key_resources: ["key resources", "resources"],
  customer_relationships: ["customer relationships"],
  customer_segments: ["customer segments", "segments"],
  channels: ["channels"],
  cost_structure: ["cost structure", "costs"],
  revenue_streams: ["revenue streams", "revenue"],
  firm_infrastructure: ["firm infrastructure", "infrastructure"],
  human_resource_management: ["human resource", "hr management"],
  technology_development: ["technology development", "technology"],
  procurement: ["procurement"],
  inbound_logistics: ["inbound logistics", "inbound"],
  operations: ["operations"],
  outbound_logistics: ["outbound logistics", "outbound"],
  marketing_and_sales: ["marketing and sales", "marketing", "sales"],
  service: ["service"],
  financial: ["financial"],
  customer: ["customer"],
  internal_process: ["internal process", "process"],
  learning_and_growth: ["learning and growth", "learning"],
};

function cite(text) {
  const m = text.match(/\[(\d+)\]/);
  return m ? Number(m[1]) : null;
}

function stripCite(text) {
  return text.replace(/\*\*/g, "").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

function pointsFrom(block) {
  const chunks = block
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  const source = chunks.length ? chunks : [block];
  return source
    .map((line) => {
      const text = stripCite(line);
      if (!text) return null;
      return { text, citation_index: cite(line) };
    })
    .filter((p) => Boolean(p));
}

function extractCategories(text, keys) {
  const out = {};
  for (const key of keys) out[key] = [];
  if (!text) return out;

  const labels = keys.flatMap((key) =>
    (LABEL_ALIASES[key] || [key]).map((alias) => ({ key, alias })),
  );
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*)?(${labels.map((l) => l.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:\\*\\*)?\\s*[:\\-]\\s*`,
    "gi",
  );
  const hits = [];
  let match;
  while ((match = pattern.exec(text))) {
    const alias = match[1].toLowerCase();
    const found = labels.find((l) => l.alias.toLowerCase() === alias);
    if (!found) continue;
    hits.push({ key: found.key, index: match.index + match[0].length, length: match[0].length });
  }

  if (hits.length === 0) {
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length) out[keys[0]] = pointsFrom(sentences.join("\n"));
    return out;
  }

  hits.forEach((hit, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index - hits[i + 1].length : text.length;
    const block = text.slice(hit.index, end).trim();
    const pts = pointsFrom(block);
    if (pts.length) out[hit.key] = [...out[hit.key], ...pts];
  });
  return out;
}

function detectBcg(text) {
  const lower = text.toLowerCase();
  const quadrant = lower.includes("cash cow")
    ? "cash_cow"
    : lower.includes("question mark")
      ? "question_mark"
      : lower.includes("star")
        ? "star"
        : lower.includes("dog")
          ? "dog"
          : null;
  if (!quadrant) return null;
  const growth = lower.match(/(\d+(?:\.\d+)?)\s*%/);
  return {
    quadrant,
    market_growth_rate_pct: growth ? Number(growth[1]) : null,
    market_share_position: lower.includes("high") ? "high" : "emerging",
    rationale: stripCite(text).slice(0, 420),
    citation_index: cite(text),
  };
}

function detectAnsoff(text) {
  const lower = text.toLowerCase();
  const quadrant = lower.includes("diversification")
    ? "diversification"
    : lower.includes("product development")
      ? "product_development"
      : lower.includes("market development")
        ? "market_development"
        : lower.includes("market penetration") || lower.includes("penetration")
          ? "market_penetration"
          : null;
  if (!quadrant) return null;
  const market = quadrant === "market_development" || quadrant === "diversification" ? "new" : "existing";
  const product = quadrant === "product_development" || quadrant === "diversification" ? "new" : "existing";
  return {
    quadrant,
    market_dimension: market,
    product_dimension: product,
    rationale: stripCite(text).slice(0, 420),
    citation_index: cite(text),
  };
}

export function hydrateFrameworkResult(key, result) {
  if (!result) return result;
  const next = { ...result };
  const text = result.text || "";

  if (key === "tam" && !next.market_sizing) {
    next.market_sizing = {
      tam: { value: null, note: "No public source stated a precise TAM for this exact wedge." },
      sam: { value: null, note: "SAM left empty rather than guessed." },
      som: { value: null, note: "SOM left empty rather than guessed." },
    };
  }

  const cats = STRUCTURED_KEYS[key];
  if (cats) {
    const field =
      key === "pestel"
        ? "pestel_analysis"
        : key === "swot"
          ? "swot_analysis"
          : key === "porter"
            ? "porter_forces"
            : key === "stp"
              ? "stp_analysis"
              : key === "bmc"
                ? "bmc_canvas"
                : key === "value_chain"
                  ? "value_chain"
                  : key === "balanced_scorecard"
                    ? "balanced_scorecard"
                    : null;
    if (field && !next[field]) {
      next[field] = extractCategories(text, cats);
    }
  }

  if (key === "bcg" && !next.bcg_matrix) {
    const matrix = detectBcg(text);
    if (matrix) next.bcg_matrix = matrix;
  }
  if (key === "ansoff" && !next.ansoff_matrix) {
    const matrix = detectAnsoff(text);
    if (matrix) next.ansoff_matrix = matrix;
  }

  return next;
}

export function hydrateReport(report) {
  if (!report?.results) return report;
  const results = {};
  for (const [key, value] of Object.entries(report.results)) {
    results[key] = hydrateFrameworkResult(key, value);
  }
  return { ...report, results };
}
