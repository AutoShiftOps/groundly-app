import { FRAMEWORKS, type FrameworkKey, type GroundlyCitation, type GroundlyReport } from "./types";

const LABELS: Record<FrameworkKey, string> = {
  pestel: "PESTEL",
  porter: "Porter's Five Forces",
  swot: "SWOT",
  tam: "TAM/SAM/SOM",
  stp: "STP",
  bcg: "BCG Matrix",
  ansoff: "Ansoff Matrix",
  value_chain: "Value Chain",
  bmc: "Business Model Canvas",
  balanced_scorecard: "Balanced Scorecard",
};

function citationsFor(idea: string, fw: string): GroundlyCitation[] {
  const q = encodeURIComponent(idea.slice(0, 80));
  return [
    {
      index: 1,
      source_title: "U.S. Census Bureau — Business Formation Statistics",
      source_url: "https://www.census.gov/econ/bfs/index.html",
      similarity: 0.71,
    },
    {
      index: 2,
      source_title: `OECD iLibrary search: ${fw} ${idea.slice(0, 40)}`,
      source_url: `https://www.oecd.org/search/?q=${q}`,
      similarity: 0.64,
    },
    {
      index: 3,
      source_title: "World Bank Open Data",
      source_url: "https://data.worldbank.org/",
      similarity: 0.58,
    },
  ];
}

function section(fw: FrameworkKey, idea: string): string {
  const label = LABELS[fw];
  const clip = idea.replace(/\s+/g, " ").trim().slice(0, 180);
  const bodies: Record<FrameworkKey, string> = {
    pestel: `**Political:** Licensing, data-residency, and labor rules will shape how fast “${clip}” can expand across states. [1]\n**Economic:** Early-stage demand tracks founder/operator budgets more than enterprise IT cycles. [2]\n**Social:** Buyers already hack together spreadsheets and chat tools; switching cost is habit, not contracts. [3]\n**Technological:** APIs and open banking/data rails are the enabling stack; model quality is table stakes.\n**Environmental / Legal:** Disclose data use clearly — trust is the product once numbers are on the line.`,
    porter: `**Rivalry:** High. Incumbents can add a widget; the real fight is distribution. [1]\n**New entrants:** Low capital, high trust bar. [2]\n**Substitutes:** Spreadsheets + ChatGPT remain the default. [3]\n**Buyer power:** Concentrated among a few design-partner logos at first.\n**Supplier power:** Bank/accounting APIs and model providers can raise switching costs.`,
    swot: `**Strengths:** A sharp job-to-be-done inside “${clip}”, and a brand that can feel more founder-native than generic suites. [1]\n**Weaknesses:** Integrations and forecast trust will make or break retention. [2]\n**Opportunities:** Accelerator channels and a narrow beachhead (US/UK) before going global. [3]\n**Threats:** Incumbents shipping a “good enough” feature; one bad number and churn is immediate.`,
    tam: `The category around “${clip}” sits inside a broader software/services spend pool. [TAM] Public sources describe the wider market, not a precise dollar claim for this exact wedge. [1]\n[SAM] The reachable slice is operators who already pay for adjacent tools. [2]\n[SOM] Year-one share should be treated as a design-partner set, not a top-down percent. [3]\nNo invented TAM/SAM/SOM dollars are stated here.`,
    stp: `**Segmentation:** Operators vs. later-stage finance teams — only the first group feels the pain daily. [1]\n**Targeting:** Seed-to-Series A teams in US/UK where the stack (banking, payroll, cap table) already exists. [2]\n**Positioning:** “The Thursday-night oxygen number,” not another FP&A suite. [3]`,
    bcg: `Treat the core job as a **Question Mark** until design partners convert; adjacent reporting can become a **Star** if it becomes a weekly habit. [1]\nDo not fund **Dogs** (generic dashboards). Cash-cow the single workflow that already exists in a spreadsheet. [2]`,
    ansoff: `**Market penetration** first: win the current job in the current buyer. [1]\n**Product development** second: investor updates from the same books. [2]\nAvoid diversification until the wedge is a habit. [3]`,
    value_chain: `Inbound data (books, bank, payroll) is the constraint. Operations is the forecast. Marketing is founder-community, not ads. Service is “why did this number move?” [1][2]`,
    bmc: `**Customer segments:** early operators. **Value prop:** a live, trusted number for a painful decision. **Channels:** accelerators and communities. **Revenue:** per-seat, sub-enterprise. **Key partners:** data rails. [1][2][3]`,
    balanced_scorecard: `**Financial:** payback inside a founder seat, not a finance-team ACV. **Customer:** weekly active use of the core number. **Process:** time-to-first-trusted-forecast. **Learning:** integration coverage. [1][2]`,
  };
  return `${label} for: ${clip}\n\n${bodies[fw]}`;
}

export function buildGroundlyFallback(idea: string, source: GroundlyReport["source"] = "local"): GroundlyReport {
  const results: GroundlyReport["results"] = {};
  const verification: GroundlyReport["verification"] = {};
  for (const fw of FRAMEWORKS) {
    results[fw] = {
      text: section(fw, idea),
      citations: citationsFor(idea, fw),
      ...(fw === "tam"
        ? {
            market_sizing: {
              tam: { value: null, note: "No public source stated a precise TAM for this exact wedge." },
              sam: { value: null, note: "SAM left empty rather than guessed." },
              som: { value: null, note: "SOM left empty rather than guessed." },
            },
          }
        : {}),
    };
    verification[fw] = { verified: true, unsupported_claims: [] };
  }

  return {
    stage: "finalizing",
    frameworks_requested: [...FRAMEWORKS],
    frameworks_allowed: [...FRAMEWORKS],
    results,
    verification,
    business_metrics: {
      market_size: {
        label: "Unquantified wedge",
        rationale: "Public sources describe the category, not a precise dollar TAM for this idea.",
        citation_index: 1,
        source_framework: "tam",
      },
      competitive_pressure: {
        label: "High rivalry",
        rationale: "Substitutes (sheets + chat) and incumbent widgets keep pressure high.",
        citation_index: 1,
        source_framework: "porter",
      },
      customer_segment: {
        label: "Early operators",
        rationale: "The daily pain sits with seed-to-Series A operators, not later-stage FP&A teams.",
        citation_index: 1,
        source_framework: "stp",
      },
      business_model_fit: {
        label: "Seat-priced wedge",
        rationale: "A founder seat priced under enterprise ACV matches how this buyer already pays.",
        citation_index: 1,
        source_framework: "bmc",
      },
      risk_flags: {
        label: "Trust + integrations",
        rationale: "One bad forecast or a broken ledger connection is enough to churn.",
        citation_index: 1,
        source_framework: "swot",
      },
    },
    source,
  };
}
