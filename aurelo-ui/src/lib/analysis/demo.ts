import type { AnalysisReport } from "./types";

export const DEMO_IDEA =
  "Halo Ledger — a neon-lit financial OS for early-stage founders that forecasts runway, flags hiring risk, and drafts investor updates from the books.";

export const DEMO_REPORT: AnalysisReport = {
  tagline: "Runway intelligence for founders who live in the numbers.",
  verdict: "promising",
  score: 78,
  tam: "$18.6B",
  sam: "$4.1B",
  som: "$220M",
  tamNote:
    "Global spend on founder-grade finance ops, FP&A tooling, and investor reporting across seed to Series B.",
  markets: [
    { code: "US", name: "United States", opportunity: 92 },
    { code: "UK", name: "United Kingdom", opportunity: 81 },
    { code: "DE", name: "Germany", opportunity: 74 },
    { code: "IN", name: "India", opportunity: 71 },
    { code: "SG", name: "Singapore", opportunity: 68 },
    { code: "CA", name: "Canada", opportunity: 66 },
    { code: "AU", name: "Australia", opportunity: 62 },
    { code: "AE", name: "UAE", opportunity: 58 },
    { code: "BR", name: "Brazil", opportunity: 51 },
  ],
  competitors: [
    {
      name: "Mercury + Carta stack",
      note: "Strong brand, weak forecasting. Founders still live in sheets.",
    },
    {
      name: "Pilot / Bench",
      note: "Bookkeeping-first. Slow on forward-looking runway risk.",
    },
    {
      name: "Causal / Mosaic",
      note: "FP&A for later-stage teams. Heavy for a 4-person seed company.",
    },
    {
      name: "ChatGPT + Notion",
      note: "The real incumbent. Cheap, messy, and already in the workflow.",
    },
  ],
  strengths: [
    "A clear, painful job: ‘how many months of oxygen do we have?’",
    "Natural expansion from runway into hiring, burn, and investor updates.",
    "Founder-aesthetic brand can out-feel generic fintech dashboards.",
  ],
  risks: [
    "Bank/accounting integrations are a graveyard of half-connected ledgers.",
    "Trust bar is extreme — one bad forecast and churn is immediate.",
    "Incumbents can ship a ‘runway’ widget without becoming a full OS.",
  ],
  nextSteps: [
    "Interview 12 seed founders who currently forecast in a spreadsheet.",
    "Ship a read-only runway view from Plaid + Stripe in two weeks.",
    "Price a founder seat, not a finance-team seat — sub-$80/mo wedge.",
    "Partner with one accelerator for a 30-company design partner round.",
  ],
  insights: [
    {
      title: "The spreadsheet is the competitor",
      body: "Founders do not feel underserved by banks. They feel abandoned by their own model the week after a hire. Win the Thursday night ‘can we make payroll’ moment.",
    },
    {
      title: "US + UK first, not global day one",
      body: "92 and 81 opportunity scores cluster where seed checks, USD/GBP banking, and Carta-like stacks already exist. India is a fast-follow talent market, not the beachhead.",
    },
    {
      title: "Draft the update, don’t ask for the data",
      body: "The wedge that converts is an investor update written from the books. Reporting is the habit. Forecasting is the upsell.",
    },
  ],
  proTips: [
    "TAM measures your total addressable market.",
    "A 4-person seed team will not implement an FP&A suite. They will open a live runway number.",
    "Price against panic, not against QuickBooks.",
    "Design partner logos beat feature lists in this category.",
  ],
};
