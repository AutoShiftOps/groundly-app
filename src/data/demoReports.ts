import { FRAMEWORKS, type GroundlyReport, type SavedProject } from "../types/groundly";

export const SAMPLE_IDEAS = [
  "Halo Ledger — a financial OS for early-stage founders that forecasts runway, flags hiring risk, and drafts investor updates from live books.",
  "NightShift — chef-grade 10-minute meal kits engineered specifically for hospital, logistics, and shift workers operating 7pm to 7am.",
  "PeerCharge — a neighborhood reservation and billing network for sharing private residential EV chargers in dense apartment districts.",
] as const;

const HALO_LEDGER_REPORT: GroundlyReport = {
  stage: "finalizing",
  frameworks_requested: [...FRAMEWORKS],
  frameworks_allowed: [...FRAMEWORKS],
  source: "demo",
  business_metrics: {
    market_size: {
      label: "$18.6B Global FP&A & Founder Ops",
      rationale:
        "Venture-backed seed to Series B software companies represent a $4.1B serviceable segment growing 16.4% annually as finance automation shifts down-market [1].",
      citation_index: 1,
      source_framework: "tam",
    },
    competitive_pressure: {
      label: "High — Fragmented Incumbents",
      rationale:
        "Incumbents split between banking wrappers (Mercury) and enterprise FP&A (Causal, Mosaic), leaving sub-15-person teams reliant on brittle spreadsheets [2].",
      citation_index: 2,
      source_framework: "porter",
    },
    customer_segment: {
      label: "Seed-to-Series A Founders (4–25 FTE)",
      rationale:
        "Founders post-seed without a full-time VP Finance feel acute weekly cash-zero anxiety and spend 6+ hours monthly compiling investor updates [3].",
      citation_index: 3,
      source_framework: "stp",
    },
    business_model_fit: {
      label: "Strong — $79/mo Wedge + Expansion",
      rationale:
        "Read-only Plaid + QuickBooks ingestion enables sub-10-minute onboarding with 84% gross margin SaaS economics and low human bookkeeping overhead [4].",
      citation_index: 4,
      source_framework: "bmc",
    },
    risk_flags: {
      label: "Moderate — Ledger Sync & Trust Bar",
      rationale:
        "Categorization drift or broken bank OAuth tokens erode trust rapidly; one erroneous runway projection triggers immediate founder churn [5].",
      citation_index: 5,
      source_framework: "swot",
    },
  },
  verification: {
    pestel: { verified: true, unsupported_claims: [] },
    porter: { verified: true, unsupported_claims: [] },
    swot: { verified: true, unsupported_claims: [] },
    tam: { verified: true, unsupported_claims: [] },
    stp: { verified: true, unsupported_claims: [] },
    bcg: { verified: true, unsupported_claims: [] },
    ansoff: { verified: true, unsupported_claims: [] },
    value_chain: { verified: true, unsupported_claims: [] },
    bmc: { verified: true, unsupported_claims: [] },
    balanced_scorecard: { verified: true, unsupported_claims: [] },
  },
  results: {
    pestel: {
      text: "Macro tightening in venture funding has elevated cash-runway discipline from an annual board exercise to a weekly operational necessity for seed founders [1]. Open-banking APIs and SOC 2 compliance automation lower entry barriers, while strict financial accuracy expectations require deterministic ledger reconciliation alongside LLM narrative synthesis [5].",
      citations: [
        {
          index: 1,
          source_title: "Carta State of Private Markets — Seed Burn & Runway Trends",
          source_url: "https://carta.com/data/state-of-private-markets/",
          similarity: 0.91,
          snippet: "Median seed burn ratios contracted 22% as founders extended runway targets to 24 months.",
        },
        {
          index: 5,
          source_title: "Plaid Fintech Benchmark Report — Open Banking Reliability",
          source_url: "https://plaid.com/resources/fintech/",
          similarity: 0.84,
          snippet: "Real-time cash flow APIs power automated treasury visibility for 68% of new SaaS finance tools.",
        },
      ],
      assumptions: [
        "Seed funding velocity remains selective over the next 24 months, preserving demand for burn-rate tooling.",
        "Accounting APIs (QuickBooks Online, Xero, Gusto) maintain open partner tiers without prohibitive per-seat fees.",
      ],
      actions: [
        "Ship SOC 2 Type I readiness and read-only OAuth scoping prior to general availability.",
        "Build deterministic cash-reconciliation checks before LLM-generated investor narratives.",
      ],
      pestel_analysis: {
        political: [
          {
            text: "R&D tax credit amortization rules (Section 174) force startups to model cash tax liabilities earlier in their lifecycle [1].",
            citation_index: 1,
          },
        ],
        economic: [
          {
            text: "Higher interest rates compressed seed-to-Series A graduation rates, making 24-month runway planning mission-critical [1].",
            citation_index: 1,
          },
        ],
        social: [
          {
            text: "Lean AI-native teams (3–12 employees) operate without dedicated finance hires longer than prior startup cohorts [3].",
            citation_index: 3,
          },
        ],
        technological: [
          {
            text: "Open-banking webhooks (Plaid, Finicity) combined with payroll APIs enable live burn-rate tracking without manual CSV uploads [5].",
            citation_index: 5,
          },
        ],
        environmental: [
          {
            text: "Cloud-native serverless ledger pipelines keep infrastructure compute footprint under 0.4% of gross revenue [4].",
            citation_index: 4,
          },
        ],
        legal: [
          {
            text: "Read-only aggregation avoids money-transmitter licensing, though SEC marketing rules apply to automated investor updates [5].",
            citation_index: 5,
          },
        ],
      },
    },
    porter: {
      text: "Competitive rivalry is intense among horizontal FP&A platforms, yet few products serve the sub-25-employee founder wedge cleanly [2]. Buyer switching costs are low at onboarding but rise steeply once historical scenario models and board update templates accumulate.",
      citations: [
        {
          index: 2,
          source_title: "G2 Financial Planning & Analysis Grid — SMB Segment",
          source_url: "https://www.g2.com/categories/budgeting-and-forecasting",
          similarity: 0.88,
          snippet: "SMB FP&A tools average 6-week implementation times, driving 41% of seed teams back to spreadsheets.",
        },
      ],
      assumptions: [
        "Neobanks like Mercury or Brex will treat deep scenario modeling as secondary to card interchange revenue.",
      ],
      actions: [
        "Anchor product differentiation on zero-setup 5-minute forecast generation vs. 6-week enterprise FP&A onboarding.",
        "Lock in recurring workflow habit via monthly investor update drafting.",
      ],
      porter_forces: {
        competitive_rivalry: [
          {
            text: "High fragmentation between enterprise FP&A (Mosaic, Causal, Pigment) and generic spreadsheets, with heavy price competition above $500/mo [2].",
            citation_index: 2,
          },
        ],
        threat_of_new_entrants: [
          {
            text: "Moderate — LLM wrappers can parse CSVs easily, but building durable multi-ledger accrual reconciliation requires deep domain engineering [5].",
            citation_index: 5,
          },
        ],
        bargaining_power_of_suppliers: [
          {
            text: "Moderate-High — Concentration in bank aggregation (Plaid) and accounting APIs (Intuit) creates upstream API pricing dependency [5].",
            citation_index: 5,
          },
        ],
        bargaining_power_of_buyers: [
          {
            text: "High initially — Seed founders are price-sensitive and compare every SaaS seat against free Notion/Sheets templates [2].",
            citation_index: 2,
          },
        ],
        threat_of_substitutes: [
          {
            text: "High — Google Sheets templates paired with fractional CFOs remain the default status quo for 70% of pre-Series A startups [2].",
            citation_index: 2,
          },
        ],
      },
    },
    swot: {
      text: "Halo Ledger pairs acute pain-point specificity (weekly cash-zero visibility and hiring scenario stress-testing) with an automated investor update wedge [3]. Key vulnerabilities center on upstream bank sync fragility and potential feature bundling by startup neobanks [5].",
      citations: [
        {
          index: 3,
          source_title: "First Round Review — Founder Finance Habits Study",
          source_url: "https://review.firstround.com/",
          similarity: 0.86,
          snippet: "Founders spend an average of 6.5 hours each month reconciling runway and drafting investor updates.",
        },
        {
          index: 5,
          source_title: "Plaid Fintech Benchmark Report",
          source_url: "https://plaid.com/resources/fintech/",
          similarity: 0.84,
        },
      ],
      assumptions: [
        "Founders will grant read-only accounting access if time-to-first-forecast is under 3 minutes.",
      ],
      actions: [
        "Provide instant demo sandbox and CSV import fallback alongside Plaid live sync.",
        "Build automated anomaly detection that flags stale bank tokens before runway charts drift.",
      ],
      swot_analysis: {
        strengths: [
          {
            text: "Purpose-built for founder psychology: converts raw ledger entries into clear hiring and burn decisions in under 5 minutes [3].",
            citation_index: 3,
          },
          {
            text: "Automated investor update drafting creates a recurring monthly retention loop beyond passive dashboards [3].",
            citation_index: 3,
          },
        ],
        weaknesses: [
          {
            text: "Cash-basis vs. accrual accounting edge cases can skew runway predictions without careful normalization [5].",
            citation_index: 5,
          },
        ],
        opportunities: [
          {
            text: "Partnering with seed accelerators and fractional CFO networks turns a B2B2C channel into low-CAC distribution [1].",
            citation_index: 1,
          },
        ],
        threats: [
          {
            text: "Startup neobanks adding lightweight runway widgets directly inside checking dashboards [2].",
            citation_index: 2,
          },
        ],
      },
    },
    tam: {
      text: "Global spend across SMB financial planning, treasury analytics, and automated founder reporting reaches $18.6B (TAM) [1]. Narrowing to venture-backed and high-growth digital startups in North America, UK, and EU yields a $4.1B SAM, with a realistic 3-year SaaS wedge of $220M SOM at $948 ACV [4].",
      citations: [
        {
          index: 1,
          source_title: "Gartner SMB Finance Automation Forecast",
          source_url: "https://www.gartner.com/en/finance",
          similarity: 0.92,
          snippet: "Global SMB FP&A software expenditure reached $18.6B with 14.8% projected 5-year CAGR.",
        },
        {
          index: 4,
          source_title: "SaaS Capital — Early-Stage Fintech Benchmark",
          source_url: "https://www.saas-capital.com/",
          similarity: 0.85,
          snippet: "Vertical finance SaaS wedges targeting sub-50 FTE firms average $800-$1,400 ACV.",
        },
      ],
      assumptions: [
        "230,000 active venture-backed and bootstrapped SaaS startups in US/UK/EU form the core serviceable base.",
        "Net dollar retention of 112% achieved via multi-entity and board-pack upsells.",
      ],
      actions: [
        "Price initial wedge at $79/mo ($948/yr) to bypass procurement committees and land on founder corporate cards.",
      ],
      market_sizing: {
        tam: {
          value: "$18.6B",
          value_usd: 18_600_000_000,
          label: "$18.6B",
          cagr_pct: 14.8,
          note: "Global SMB financial planning, cash-flow analytics, and reporting software spend.",
          tier_description: "All global SMBs requiring cash forecasting and financial reporting.",
          citation_index: 1,
        },
        sam: {
          value: "$4.1B",
          value_usd: 4_100_000_000,
          label: "$4.1B",
          cagr_pct: 16.4,
          note: "Cloud-native startups (seed to Series B) using digital ledgers in US, UK, EU, and SG.",
          tier_description: "Digitally banked startups with 3–50 employees on QBO, Xero, or Stripe.",
          citation_index: 1,
        },
        som: {
          value: "$220M",
          value_usd: 220_000_000,
          label: "$220M",
          cagr_pct: 22.5,
          note: "Achievable 5% capture of seed-stage tech startups via accelerator and CFO partner channels.",
          tier_description: "Bottom-up target: ~230k reachable startups at ~$948 annual contract value.",
          citation_index: 4,
        },
      },
    },
    stp: {
      text: "Segmentation isolates teams between pre-seed spreadsheet chaos and Series B enterprise ERP deployments [3]. Targeting US & UK seed founders (4–25 FTE) maximizes willingness-to-pay and data cleanliness.",
      citations: [
        {
          index: 3,
          source_title: "First Round Review — Founder Finance Habits Study",
          source_url: "https://review.firstround.com/",
          similarity: 0.86,
        },
      ],
      assumptions: [
        "Non-finance technical founders convert 2.4x faster than companies with an internal controller.",
      ],
      actions: [
        "Launch US + UK beachhead messaging focused exclusively on 'Thursday night payroll & hiring confidence'.",
      ],
      stp_analysis: {
        segmentation: [
          {
            text: "Bootstrapped micro-agencies (1–3 FTE): high volume, high churn, low ACV ceiling [4].",
            citation_index: 4,
          },
          {
            text: "Seed-to-Series A startups (4–25 FTE): acute runway & hiring stakes, clean SaaS banking [1].",
            citation_index: 1,
          },
          {
            text: "Series B+ growth firms (50+ FTE): multi-department budgets served by Mosaic/Pigment [2].",
            citation_index: 2,
          },
        ],
        targeting: [
          {
            text: "Primary ICP: Seed-to-Series A software/AI founders in US & UK with $500k–$5M cash in bank [1].",
            citation_index: 1,
          },
        ],
        positioning: [
          {
            text: "The live financial co-pilot that answers 'can we afford two engineers?' and drafts your board update automatically [3].",
            citation_index: 3,
          },
        ],
      },
    },
    bcg: {
      text: "Positioned squarely in the Question Mark quadrant: high underlying category growth (16.4% CAGR in SMB FP&A automation) paired with nascent initial market share against entrenched spreadsheets [1].",
      citations: [
        {
          index: 1,
          source_title: "Gartner SMB Finance Automation Forecast",
          source_url: "https://www.gartner.com/en/finance",
          similarity: 0.9,
        },
      ],
      assumptions: [
        "Category growth sustains >14% CAGR as AI reconciliation reduces manual bookkeeping costs.",
      ],
      actions: [
        "Focus capital strictly on activation speed and accelerator distribution to convert into a category Star.",
      ],
      bcg_matrix: {
        quadrant: "question_mark",
        market_growth_rate_pct: 16.4,
        market_share_position: "Emerging challenger (<1% share) in high-growth seed finance OS niche",
        rationale:
          "Strong market tailwinds (16.4% SAM CAGR) justify aggressive product-led growth investment to win share before neobanks consolidate the workflow [1].",
        citation_index: 1,
      },
    },
    ansoff: {
      text: "Optimal early expansion follows Product Development: deepening value for the core seed-founder ICP (adding scenario stress-testing, headcount planning, and investor CRM) rather than premature horizontal SMB diversification [4].",
      citations: [
        {
          index: 4,
          source_title: "SaaS Capital — Early-Stage Fintech Benchmark",
          source_url: "https://www.saas-capital.com/",
          similarity: 0.85,
        },
      ],
      assumptions: [
        "Existing seed users adopt adjacent workflows (board decks, 409A prep) at >40% attach rate.",
      ],
      actions: [
        "Sequence roadmap: Live Runway -> Hiring Simulator -> Auto Investor Update -> Scenario Compare.",
      ],
      ansoff_matrix: {
        quadrant: "product_development",
        market_dimension: "Existing Beachhead (Seed-to-Series A Tech Founders)",
        product_dimension: "New Capabilities (AI Narrative Updates & Hiring Stress-Tests)",
        rationale:
          "Deepening workflow capture within the seed founder cohort drives expansion ARPU without diluting positioning against broad SMB accounting suites [4].",
        citation_index: 4,
      },
    },
    value_chain: {
      text: "Value creation hinges on frictionless inbound data ingestion (bank + payroll + billing sync) and deterministic scenario calculation, converting raw transactions into executive clarity [5].",
      citations: [
        {
          index: 5,
          source_title: "Plaid Fintech Benchmark Report",
          source_url: "https://plaid.com/resources/fintech/",
          similarity: 0.84,
        },
      ],
      assumptions: [
        "Automated categorization accuracy exceeds 94% on SaaS vendor spend.",
      ],
      actions: [
        "Invest 60% of initial engineering velocity in connector resilience and anomaly guardrails.",
      ],
      value_chain: {
        firm_infrastructure: [
          { text: "SOC 2 Type II security posture and read-only financial vault architecture [5].", citation_index: 5 },
        ],
        human_resource_management: [
          { text: "Small senior product-engineering pod paired with fractional CPA advisors [4].", citation_index: 4 },
        ],
        technology_development: [
          { text: "Deterministic cash-burn forecast engine coupled with citation-backed LLM narrative writer [3].", citation_index: 3 },
        ],
        procurement: [
          { text: "Tiered API partnerships with Plaid, Merge.dev, and Stripe Billing [5].", citation_index: 5 },
        ],
        inbound_logistics: [
          { text: "Real-time OAuth ingestion from checking accounts, corporate cards, and Gusto/Rippling [5].", citation_index: 5 },
        ],
        operations: [
          { text: "Automated vendor normalization, recurring spend detection, and Monte Carlo runway bands [1].", citation_index: 1 },
        ],
        outbound_logistics: [
          { text: "One-click branded investor update links, PDF board packs, and Slack burn alerts [3].", citation_index: 3 },
        ],
        marketing_and_sales: [
          { text: "Interactive public runway calculator + YC/Techstars accelerator perk distribution [4].", citation_index: 4 },
        ],
        service: [
          { text: "In-app financial sanity checks and async fractional-CFO escalation channel [2].", citation_index: 2 },
        ],
      },
    },
    bmc: {
      text: "High-margin self-serve SaaS model ($79–$199/mo) anchored on rapid time-to-value and viral distribution via monthly investor update emails sent to angel and VC stakeholders [4].",
      citations: [
        {
          index: 4,
          source_title: "SaaS Capital — Early-Stage Fintech Benchmark",
          source_url: "https://www.saas-capital.com/",
          similarity: 0.85,
        },
      ],
      assumptions: [
        "Investor update recipients generate 15%+ organic referral signups across portfolio founders.",
      ],
      actions: [
        "Include a subtle 'Forecasted with Halo Ledger' footer on shared investor memos.",
      ],
      bmc_canvas: {
        key_partners: [{ text: "Plaid, Intuit QBO, Stripe, Seed Accelerators, Fractional CFOs [5].", citation_index: 5 }],
        key_activities: [{ text: "Ledger normalization, scenario simulation, narrative generation [3].", citation_index: 3 }],
        value_propositions: [{ text: "Real-time runway truth, zero-spreadsheet hiring impact, 2-minute investor updates [3].", citation_index: 3 }],
        key_resources: [{ text: "Multi-ledger reconciliation engine and benchmark cohort dataset [1].", citation_index: 1 }],
        customer_relationships: [{ text: "Product-led self-serve onboarding with proactive Slack runway alerts [4].", citation_index: 4 }],
        customer_segments: [{ text: "Venture-backed Seed/Series A founders (4–25 FTE) without a full-time CFO [1].", citation_index: 1 }],
        channels: [{ text: "Investor-update viral loop, accelerator perks, founder Slack communities [4].", citation_index: 4 }],
        cost_structure: [{ text: "Aggregation API per-connection fees, cloud inference, SOC 2 compliance [5].", citation_index: 5 }],
        revenue_streams: [{ text: "Tiered SaaS ($79/mo Starter, $199/mo Growth, $499/mo Multi-Entity) [4].", citation_index: 4 }],
      },
    },
    balanced_scorecard: {
      text: "Operational scorecard pairs SaaS capital efficiency (LTV:CAC > 4x) with strict forecast precision and time-to-first-insight under 5 minutes [4].",
      citations: [
        {
          index: 4,
          source_title: "SaaS Capital — Early-Stage Fintech Benchmark",
          source_url: "https://www.saas-capital.com/",
          similarity: 0.87,
        },
      ],
      assumptions: [
        "Net monthly logo churn stays below 2.2% once a founder sends two consecutive investor updates.",
      ],
      actions: [
        "Track 'Forecast Accuracy Delta' at 30/60/90 days as the North Star reliability metric.",
      ],
      balanced_scorecard: {
        financial: [
          {
            text: "Achieve top-quartile SaaS gross margins through automated ledger parsing [4].",
            citation_index: 4,
            metric_name: "Gross Margin",
            metric_value: "84%",
            target_value: "86%",
          },
        ],
        customer: [
          {
            text: "Compress time-to-first-runway-forecast during initial OAuth onboarding [3].",
            citation_index: 3,
            metric_name: "Time to First Forecast",
            metric_value: "4.2 min",
            target_value: "< 3.0 min",
          },
        ],
        internal_process: [
          {
            text: "Maintain deterministic reconciliation accuracy against bank statement closes [5].",
            citation_index: 5,
            metric_name: "Auto-Categorization Precision",
            metric_value: "94.5%",
            target_value: "98.0%",
          },
        ],
        learning_and_growth: [
          {
            text: "Drive organic founder acquisition via shared board and investor update links [4].",
            citation_index: 4,
            metric_name: "Viral Referral Share",
            metric_value: "18%",
            target_value: "25%",
          },
        ],
      },
    },
  },
};

const NIGHTSHIFT_REPORT: GroundlyReport = {
  stage: "finalizing",
  frameworks_requested: [...FRAMEWORKS],
  frameworks_allowed: [...FRAMEWORKS],
  source: "demo",
  business_metrics: {
    market_size: {
      label: "$11.4B Prepared & Shift Meal Market",
      rationale:
        "24/7 healthcare, logistics, and manufacturing shifts account for 21M US workers underserved by daytime meal delivery windows [1].",
      citation_index: 1,
      source_framework: "tam",
    },
    competitive_pressure: {
      label: "Moderate — Daytime Meal-Kit Focus",
      rationale:
        "Factor and HelloFresh optimize for residential evening dinners, leaving hospital campuses and night depots reliant on vending machines [2].",
      citation_index: 2,
      source_framework: "porter",
    },
    customer_segment: {
      label: "Hospital & Night-Shift Nurses (7p–7a)",
      rationale:
        "12-hour clinical shifts generate high willingness-to-pay for warm, high-protein, zero-prep nutrition delivered to smart hospital lockers [3].",
      citation_index: 3,
      source_framework: "stp",
    },
    business_model_fit: {
      label: "Rework — Cold-Chain CapEx Heavy",
      rationale:
        "Smart refrigerated lockers at employer hubs solve last-mile unit economics, but upfront hardware + commissary waste need tight density [4].",
      citation_index: 4,
      source_framework: "bmc",
    },
    risk_flags: {
      label: "Elevated — Perishable Spoilage & Logistics",
      rationale:
        "Unsold fresh inventory above 8% wipes out contribution margin unless subsidized via B2B hospital employer stipends [4].",
      citation_index: 4,
      source_framework: "swot",
    },
  },
  verification: {
    pestel: { verified: true, unsupported_claims: [] },
    porter: { verified: true, unsupported_claims: [] },
    swot: { verified: true, unsupported_claims: [] },
    tam: { verified: true, unsupported_claims: [] },
    stp: { verified: true, unsupported_claims: [] },
    bcg: { verified: true, unsupported_claims: [] },
    ansoff: { verified: true, unsupported_claims: [] },
    value_chain: { verified: false, unsupported_claims: ["Commissary lease cost per metro lacks verified citation"] },
    bmc: { verified: true, unsupported_claims: [] },
    balanced_scorecard: { verified: false, unsupported_claims: ["Locker payback period unverified across regional hubs"] },
  },
  results: {
    pestel: {
      text: "Shift-work fatigue and hospital nurse retention crises push health systems to fund overnight wellness perks [1]. Food safety regulations (FDA/local health codes) govern cold-chain locker temperatures strictly [4].",
      citations: [
        {
          index: 1,
          source_title: "Bureau of Labor Statistics — Shift & Night Worker Demographics",
          source_url: "https://www.bls.gov/news.release/flex2.nr0.htm",
          similarity: 0.89,
        },
        {
          index: 4,
          source_title: "Food Logistics Cold-Chain Compliance Guide",
          source_url: "https://www.foodlogistics.com/",
          similarity: 0.78,
        },
      ],
      assumptions: ["Hospital HR budgets continue subsidizing overnight clinical staff meals."],
      actions: ["Pilot B2B smart-fridge subsidies at two Tier-1 metro hospital campuses before D2C home delivery."],
      pestel_analysis: {
        political: [{ text: "Hospital wellness grants and union break-time mandates support employer-provided nutrition [1].", citation_index: 1 }],
        economic: [{ text: "Night-shift differential wages give nurses disposable income for $11–$14 ready meals [1].", citation_index: 1 }],
        social: [{ text: "Growing awareness of circadian metabolic health drives demand for low-glycemic night meals [3].", citation_index: 3 }],
        technological: [{ text: "IoT smart refrigerated kiosks enable unattended 2am badge-tap checkout [4].", citation_index: 4 }],
        environmental: [{ text: "Reusable returnable meal trays cut single-use insulated shipping box waste by 70% [4].", citation_index: 4 }],
        legal: [{ text: "Automated temperature telemetry logs satisfy municipal commissary health inspections [4].", citation_index: 4 }],
      },
    },
    porter: {
      text: "Direct competition inside hospitals between 11pm and 5am is sparse—legacy caterers close kitchens after 8pm [2]. However, cold-chain hardware capex and perishable spoilage create unforgiving unit-economic barriers [4].",
      citations: [
        {
          index: 2,
          source_title: "Grand View Research — Ready-to-Eat Meal Delivery Market",
          source_url: "https://www.grandviewresearch.com/",
          similarity: 0.86,
        },
        {
          index: 4,
          source_title: "Food Logistics Cold-Chain Compliance Guide",
          source_url: "https://www.foodlogistics.com/",
          similarity: 0.81,
        },
      ],
      assumptions: ["Regional commissary partners maintain <4% spoilage across 48-hour shelf windows."],
      actions: ["Lock exclusive 24-month hospital corridor locker placement agreements with facility ops."],
      porter_forces: {
        competitive_rivalry: [{ text: "Daytime meal-kit leaders (Factor, CookUnity) ignore unattended overnight employer hubs [2].", citation_index: 2 }],
        threat_of_new_entrants: [{ text: "Moderate-Low — Smart fridge telemetry + commissary density require coordinated logistics [4].", citation_index: 4 }],
        bargaining_power_of_suppliers: [{ text: "Moderate — Regional USDA-inspected kitchens hold pricing leverage until metro volume scales [4].", citation_index: 4 }],
        bargaining_power_of_buyers: [{ text: "High — Hospital procurement demands clinical nutrition benchmarks and strict service-level uptime [3].", citation_index: 3 }],
        threat_of_substitutes: [{ text: "High — Vending machines, fast-food drive-thrus, and home-packed leftovers compete at lower price points [1].", citation_index: 1 }],
      },
    },
    swot: {
      text: "Clear structural whitespace serving 21M overnight shift workers with employer-subsidized smart kiosks [1], offset by high cold-chain inventory risk [4].",
      citations: [
        {
          index: 1,
          source_title: "Bureau of Labor Statistics — Shift & Night Worker Demographics",
          source_url: "https://www.bls.gov/news.release/flex2.nr0.htm",
          similarity: 0.88,
        },
        {
          index: 4,
          source_title: "Food Logistics Cold-Chain Compliance Guide",
          source_url: "https://www.foodlogistics.com/",
          similarity: 0.79,
        },
      ],
      assumptions: ["Zero-waste markdowns at 6am salvage 60% of unsold overnight stock."],
      actions: ["Bundle dynamic 5am shift-end clearance pricing into the mobile companion app."],
      swot_analysis: {
        strengths: [
          { text: "10-minute heat-and-eat chef menu calibrated specifically for overnight circadian digestion [3].", citation_index: 3 },
          { text: "Badge-tap smart locker checkout eliminates delivery tipping and wait delays during short breaks [4].", citation_index: 4 },
        ],
        weaknesses: [
          { text: "Upfront refrigerated kiosk lease/capex ($4.5k/unit) delays metro breakeven [4].", citation_index: 4 },
        ],
        opportunities: [
          { text: "Hospital HR retention stipends turn B2C customer acquisition into predictable B2B2C contracts [3].", citation_index: 3 },
        ],
        threats: [
          { text: "Spoilage above 8% or regional commissary labor shortages compress gross margins sharply [4].", citation_index: 4 },
        ],
      },
    },
    tam: {
      text: "The US prepared meal delivery segment totals $11.4B (TAM) [2]. Focusing on employer-hub and residential night-shift workers yields a $2.3B SAM, with a metropolitan hospital-corridor wedge of $140M SOM [3].",
      citations: [
        {
          index: 2,
          source_title: "Grand View Research — Ready-to-Eat Meal Delivery Market",
          source_url: "https://www.grandviewresearch.com/",
          similarity: 0.87,
        },
        {
          index: 3,
          source_title: "Becker's Hospital Review — Workforce Retention Benefits",
          source_url: "https://www.beckershospitalreview.com/",
          similarity: 0.83,
        },
      ],
      assumptions: ["Average worker orders 3.2 meals/week at $13.50 ASP."],
      actions: ["Validate 40% attach rate across 1,500 night-shift employees at flagship hospital pilot."],
      market_sizing: {
        tam: { value: "$11.4B", value_usd: 11_400_000_000, label: "$11.4B", cagr_pct: 12.1, note: "US prepared & ready-to-heat meal delivery spend.", citation_index: 2 },
        sam: { value: "$2.3B", value_usd: 2_300_000_000, label: "$2.3B", cagr_pct: 13.8, note: "21M US evening/night-shift workers across healthcare & logistics.", citation_index: 1 },
        som: { value: "$140M", value_usd: 140_000_000, label: "$140M", cagr_pct: 18.5, note: "Top 15 US medical & logistics corridors via B2B smart kiosks.", citation_index: 3 },
      },
    },
    stp: {
      text: "Target acute-care hospital campuses (7pm–7am clinical staff) first to lock dense nightly unit volume before expanding to fulfillment warehouses [3].",
      citations: [
        {
          index: 3,
          source_title: "Becker's Hospital Review — Workforce Retention Benefits",
          source_url: "https://www.beckershospitalreview.com/",
          similarity: 0.85,
        },
      ],
      assumptions: ["Hospital nurse managers champion wellness perks with zero cafeteria staffing overhead."],
      actions: ["Launch 30-day subsidized tasting cart at nursing shift handoff."],
      stp_analysis: {
        segmentation: [
          { text: "Acute-care overnight nurses/ER clinicians vs. third-shift warehouse & airport ground crews [1].", citation_index: 1 },
        ],
        targeting: [
          { text: "500+ bed urban medical centers with >600 active night-shift clinicians per campus [3].", citation_index: 3 },
        ],
        positioning: [
          { text: "Fresh chef nutrition always stocked 20 steps from the nursing station—never vending-machine junk [3].", citation_index: 3 },
        ],
      },
    },
    bcg: {
      text: "Classified as a high-growth Question Mark requiring disciplined hub density before expanding cold-chain SKUs [2].",
      citations: [
        {
          index: 2,
          source_title: "Grand View Research — Ready-to-Eat Meal Delivery Market",
          source_url: "https://www.grandviewresearch.com/",
          similarity: 0.84,
        },
      ],
      assumptions: ["Smart locker density drives 68% repeat weekly order frequency."],
      actions: ["Cap initial menu to 8 high-velocity SKUs to minimize prep waste."],
      bcg_matrix: {
        quadrant: "question_mark",
        market_growth_rate_pct: 13.8,
        market_share_position: "First-mover in attended overnight B2B2C hospital nutrition",
        rationale: "Prepared shift-meal demand grows fast, while capital efficiency hinges on per-locker sell-through above 85% [2].",
        citation_index: 2,
      },
    },
    ansoff: {
      text: "Product Development strategy pairing freshly cooked regional menus with IoT smart-locker distribution inside existing medical corridors [4].",
      citations: [
        {
          index: 4,
          source_title: "Food Logistics Cold-Chain Compliance Guide",
          source_url: "https://www.foodlogistics.com/",
          similarity: 0.81,
        },
      ],
      assumptions: ["Employer wellness budgets cover 30%–50% of per-meal subsidy."],
      actions: ["Standardize white-label kiosk telemetry API for hospital badge systems."],
      ansoff_matrix: {
        quadrant: "product_development",
        market_dimension: "Existing urban hospital & 24/7 logistics shift workforces [1]",
        product_dimension: "Unattended cold-chain IoT lockers + circadian chef meal subscription [4]",
        rationale: "Delivering purpose-built unattended dining directly inside high-density night workplaces avoids residential last-mile courier losses [4].",
        citation_index: 4,
      },
    },
    value_chain: {
      text: "Automated batch commissary cooking, single-van midnight corridor milk-runs, and contactless badge-tap lockers compress last-mile labor costs [4].",
      citations: [
        {
          index: 4,
          source_title: "Food Logistics Cold-Chain Compliance Guide",
          source_url: "https://www.foodlogistics.com/",
          similarity: 0.77,
        },
      ],
      assumptions: ["One refrigerated van services 14 lockers per 3-hour evening route."],
      actions: ["Audit commissary kitchen lease cost and van route density across target metro."],
      value_chain: {
        firm_infrastructure: [{ text: "Hospital facilities compliance, FDA cold-chain telemetry, and B2B billing [4].", citation_index: 4 }],
        human_resource_management: [{ text: "Central culinary prep team + evening restocking route drivers [1].", citation_index: 1 }],
        technology_development: [{ text: "RFID meal tray inventory tracking + dynamic 5am markdown algorithm [4].", citation_index: 4 }],
        procurement: [{ text: "Bulk wholesale protein/produce contracts and reusable returnable trays [2].", citation_index: 2 }],
        inbound_logistics: [{ text: "Morning commissary receiving with 24-hour prep cycle [4].", citation_index: 4 }],
        operations: [{ text: "Blast-chilled sealed chef packaging rated for 72-hour freshness [4].", citation_index: 4 }],
        outbound_logistics: [{ text: "Fixed 5pm–8pm milk-run restocking across hospital locker network [3].", citation_index: 3 }],
        marketing_and_sales: [{ text: "Hospital HR benefits partnerships + shift-change QR tasting drops [3].", citation_index: 3 }],
        service: [{ text: "Instant self-serve refund credit via QR scan inside smart kiosk [4].", citation_index: 4 }],
      },
    },
    bmc: {
      text: "Hybrid B2B2C revenue blends monthly employer kiosk hosting fees with $12.50 average per-meal consumer transactions [3].",
      citations: [
        {
          index: 3,
          source_title: "Becker's Hospital Review — Workforce Retention Benefits",
          source_url: "https://www.beckershospitalreview.com/",
          similarity: 0.85,
        },
      ],
      assumptions: ["Each hospital kiosk averages 42 paid meals per 24-hour cycle."],
      actions: ["Negotiate employer minimum monthly spend guarantees on pilot lockers."],
      bmc_canvas: {
        key_partners: [{ text: "Hospital HR departments, regional commissary kitchens, kiosk OEMs [3].", citation_index: 3 }],
        key_activities: [{ text: "Menu rotation, demand forecasting, cold-chain restocking [4].", citation_index: 4 }],
        value_propositions: [{ text: "Hot-ready chef meals available 24/7 inside the breakroom in 10 minutes [3].", citation_index: 3 }],
        key_resources: [{ text: "RFID smart fridge fleet and proprietary shift-demand dataset [4].", citation_index: 4 }],
        customer_relationships: [{ text: "Employer-subsidized wallet credits + personalized weekly meal drops [3].", citation_index: 3 }],
        customer_segments: [{ text: "7pm–7am nurses, residents, logistics hub operators [1].", citation_index: 1 }],
        channels: [{ text: "Breakroom kiosks, hospital intranet perks, shift crew referrals [3].", citation_index: 3 }],
        cost_structure: [{ text: "Food COGS (34%), commissary kitchen lease, locker depreciation, spoilage [4].", citation_index: 4 }],
        revenue_streams: [{ text: "$12.50 meal sales + $650/mo B2B campus kiosk hosting fee [3].", citation_index: 3 }],
      },
    },
    balanced_scorecard: {
      text: "Operational discipline centers on keeping perishable spoilage under 5% while driving per-locker utilization past 85% [4].",
      citations: [
        {
          index: 4,
          source_title: "Food Logistics Cold-Chain Compliance Guide",
          source_url: "https://www.foodlogistics.com/",
          similarity: 0.79,
        },
      ],
      assumptions: ["Hardware payback compresses to 9 months once lockers hit 45 meals/day."],
      actions: ["Publish weekly spoilage & locker payback telemetry before Series A."],
      balanced_scorecard: {
        financial: [
          {
            text: "Control food + packaging COGS while lifting contribution margin per kiosk [4].",
            citation_index: 4,
            metric_name: "Contribution Margin",
            metric_value: "41%",
            target_value: "52%",
          },
        ],
        customer: [
          {
            text: "Drive weekly active reorder cadence among night-shift badge holders [3].",
            citation_index: 3,
            metric_name: "Weekly Repeat Rate",
            metric_value: "64%",
            target_value: "75%",
          },
        ],
        internal_process: [
          {
            text: "Minimize expired meal write-offs with predictive RFID restock alerts [4].",
            citation_index: 4,
            metric_name: "Spoilage Rate",
            metric_value: "6.8%",
            target_value: "< 4.5%",
          },
        ],
        learning_and_growth: [
          {
            text: "Expand curated high-protein menus co-designed with nurse advisory boards [3].",
            citation_index: 3,
            metric_name: "Employer NPS",
            metric_value: "58",
            target_value: "70+",
          },
        ],
      },
    },
  },
};

const PEERCHARGE_REPORT: GroundlyReport = {
  stage: "finalizing",
  frameworks_requested: [...FRAMEWORKS],
  frameworks_allowed: [...FRAMEWORKS],
  source: "demo",
  business_metrics: {
    market_size: {
      label: "$9.8B Urban EV Charging Software",
      rationale:
        "38% of urban EV intenders live in multi-unit housing without dedicated garage charging, creating acute neighborhood supply gaps [1].",
      citation_index: 1,
      source_framework: "tam",
    },
    competitive_pressure: {
      label: "Moderate-High — Public Fast Chargers",
      rationale:
        "Tesla Superchargers and ChargePoint dominate highway fast charging, while peer residential Level-2 sharing remains hyper-local [2].",
      citation_index: 2,
      source_framework: "porter",
    },
    customer_segment: {
      label: "Urban Condo/Townhome EV Drivers",
      rationale:
        "Overnight Level-2 charging within 3 blocks beats 45-minute public fast-charger queues on cost and convenience [3].",
      citation_index: 3,
      source_framework: "stp",
    },
    business_model_fit: {
      label: "Viable — 18% Marketplace Take Rate",
      rationale:
        "Asset-light OCPP smart-plug integration lets hosts monetize idle driveways without PeerCharge owning hardware [4].",
      citation_index: 4,
      source_framework: "bmc",
    },
    risk_flags: {
      label: "High — HOA/Utility & Liability Hurdles",
      rationale:
        "Municipal driveway zoning, utility resale tariffs, and slip-and-fall host liability restrict dense neighborhood scaling [5].",
      citation_index: 5,
      source_framework: "swot",
    },
  },
  verification: {
    pestel: { verified: true, unsupported_claims: [] },
    porter: { verified: true, unsupported_claims: [] },
    swot: { verified: true, unsupported_claims: [] },
    tam: { verified: true, unsupported_claims: [] },
    stp: { verified: true, unsupported_claims: [] },
    bcg: { verified: false, unsupported_claims: ["Local host churn rate after 6 months not cited"] },
    ansoff: { verified: true, unsupported_claims: [] },
    value_chain: { verified: true, unsupported_claims: [] },
    bmc: { verified: true, unsupported_claims: [] },
    balanced_scorecard: { verified: true, unsupported_claims: [] },
  },
  results: {
    pestel: {
      text: "Rapid urban EV adoption outpaces public Level-2 curb installations [1], though municipal utility resale statutes and HOA parking rules remain tight hurdles [5].",
      citations: [
        {
          index: 1,
          source_title: "IEA Global EV Outlook — Residential & Urban Charging Gaps",
          source_url: "https://www.iea.org/reports/global-ev-outlook",
          similarity: 0.9,
        },
        {
          index: 5,
          source_title: "DOE Alternative Fuels Data Center — Residential EV Zoning",
          source_url: "https://afdc.energy.gov/",
          similarity: 0.82,
        },
      ],
      assumptions: ["Utilities permit peer-to-peer kWh reimbursement structured as parking/hardware rental."],
      actions: ["Structure host payouts as time-based driveway access fees rather than electricity resale."],
      pestel_analysis: {
        political: [{ text: "NEVI incentives prioritize highway fast chargers, leaving urban residential streets underserved [2].", citation_index: 2 }],
        economic: [{ text: "Home off-peak kWh rates ($0.14/kWh) undercut public fast-charger pricing by 55% [1].", citation_index: 1 }],
        social: [{ text: "Multi-unit apartment dwellers postpone EV purchases due to overnight charging anxiety [1].", citation_index: 1 }],
        technological: [{ text: "OCPP 2.0.1 residential smart wallboxes expose remote start/stop billing APIs [4].", citation_index: 4 }],
        environmental: [{ text: "Shifting charging to solar-heavy daytime homeowner driveways cuts grid peak load [1].", citation_index: 1 }],
        legal: [{ text: "Slip-and-fall umbrella coverage and municipal curb access ordinances vary by city [5].", citation_index: 5 }],
      },
    },
    porter: {
      text: "Incumbent charging networks focus on commercial retail and highways [2], creating space for neighborhood Level-2 sharing if local density builds quickly.",
      citations: [
        {
          index: 2,
          source_title: "NREL National EV Infrastructure Needs Study",
          source_url: "https://www.nrel.gov/",
          similarity: 0.85,
        },
      ],
      assumptions: ["Neighborhood density of 3+ hosts within 0.4 miles sustains repeat booking conversion."],
      actions: ["Seed hyper-local homeowner clusters before opening driver signups in a zip code."],
      porter_forces: {
        competitive_rivalry: [{ text: "ChargePoint and EVgo target commercial lots rather than residential driveways [2].", citation_index: 2 }],
        threat_of_new_entrants: [{ text: "Moderate — Software booking is simple, but verified host liquidity is hard to replicate [4].", citation_index: 4 }],
        bargaining_power_of_suppliers: [{ text: "Low — OCPP protocol works across Wallbox, ChargePoint Home, and Emporia hardware [4].", citation_index: 4 }],
        bargaining_power_of_buyers: [{ text: "High — Drivers switch to public DC fast chargers if a driveway is blocked or unreliable [3].", citation_index: 3 }],
        threat_of_substitutes: [{ text: "Moderate — Curbside lamp-post chargers and workplace charging stations compete directly [1].", citation_index: 1 }],
      },
    },
    swot: {
      text: "Asset-light software layer unlocks thousands of idle residential chargers without capex [4], but HOA resistance and off-platform disintermediation pose risks [5].",
      citations: [
        {
          index: 4,
          source_title: "OCPP Open Charge Alliance — Residential Interoperability Brief",
          source_url: "https://openchargealliance.org/",
          similarity: 0.84,
        },
        {
          index: 5,
          source_title: "DOE Alternative Fuels Data Center — Residential EV Zoning",
          source_url: "https://afdc.energy.gov/",
          similarity: 0.81,
        },
      ],
      assumptions: ["Automated kWh metering and embedded insurance keep bookings on-platform."],
      actions: ["Launch automatic host occupancy sensors to prevent iced/blocked driveway incidents."],
      swot_analysis: {
        strengths: [
          { text: "Zero hardware deployment capex—connects directly to existing homeowner OCPP chargers [4].", citation_index: 4 },
          { text: "Overnight Level-2 charging costs 40% less than public DC fast chargers [1].", citation_index: 1 },
        ],
        weaknesses: [
          { text: "Hyper-local two-sided cold start requires dense block-by-block supply [2].", citation_index: 2 },
        ],
        opportunities: [
          { text: "Apartment property managers can partner for overflow neighborhood resident charging [1].", citation_index: 1 },
        ],
        threats: [
          { text: "Municipal zoning complaints or repeat drivers cutting cash side-deals with hosts [5].", citation_index: 5 },
        ],
      },
    },
    tam: {
      text: "Global EV charging infrastructure software & network services total $9.8B (TAM) [1]. Urban residential Level-2 sharing across high-EV-adoption metros represents a $1.6B SAM and $95M 3-year SOM [2].",
      citations: [
        {
          index: 1,
          source_title: "IEA Global EV Outlook — Residential & Urban Charging Gaps",
          source_url: "https://www.iea.org/reports/global-ev-outlook",
          similarity: 0.9,
        },
        {
          index: 2,
          source_title: "NREL National EV Infrastructure Needs Study",
          source_url: "https://www.nrel.gov/",
          similarity: 0.85,
        },
      ],
      assumptions: ["20% of suburban/rowhouse Level-2 owners are willing to share daytime or overnight slots."],
      actions: ["Launch single-neighborhood density test in San Francisco Sunset or Brooklyn Park Slope."],
      market_sizing: {
        tam: { value: "$9.8B", value_usd: 9_800_000_000, label: "$9.8B", cagr_pct: 24.5, note: "Global EV charging network management and consumer billing spend.", citation_index: 1 },
        sam: { value: "$1.6B", value_usd: 1_600_000_000, label: "$1.6B", cagr_pct: 21.0, note: "Dense metro neighborhoods with >15% EV penetration and constrained garage access.", citation_index: 2 },
        som: { value: "$95M", value_usd: 95_000_000, label: "$95M", cagr_pct: 26.0, note: "Top 10 North American & EU EV metros at 18% marketplace take rate.", citation_index: 2 },
      },
    },
    stp: {
      text: "Focus initially on dense street-parked EV neighborhoods within 1 mile of single-family rowhouse zones [3].",
      citations: [
        {
          index: 3,
          source_title: "PlugShare Urban EV Driver Survey",
          source_url: "https://www.plugshare.com/",
          similarity: 0.84,
        },
      ],
      assumptions: ["Drivers pay a convenience premium for guaranteed overnight reserved charging slots."],
      actions: ["Offer $100 utility rebate top-ups to the first 50 verified hosts in each launch zip code."],
      stp_analysis: {
        segmentation: [
          { text: "Street-parked condo EV owners vs. weekend rideshare fleet drivers [1].", citation_index: 1 },
        ],
        targeting: [
          { text: "Mixed rowhouse/apartment corridors with >12% EV registrations and tight curb parking [3].", citation_index: 3 },
        ],
        positioning: [
          { text: "Your neighbor's guaranteed overnight Level-2 spot—booked in 2 taps, no fast-charger lines [3].", citation_index: 3 },
        ],
      },
    },
    bcg: {
      text: "Emerging Question Mark with strong macro tailwinds, gated by host retention after initial utility-bill cycles [2].",
      citations: [
        {
          index: 2,
          source_title: "NREL National EV Infrastructure Needs Study",
          source_url: "https://www.nrel.gov/",
          similarity: 0.83,
        },
      ],
      assumptions: ["Hosts earn $160–$280/mo net after off-peak electricity costs."],
      actions: ["Track 6-month residential host retention across early test neighborhoods."],
      bcg_matrix: {
        quadrant: "question_mark",
        market_growth_rate_pct: 21.0,
        market_share_position: "Hyper-local P2P residential charging marketplace",
        rationale: "High macro EV growth invites marketplace monetization once host payout reliability exceeds 6 months [2].",
        citation_index: 2,
      },
    },
    ansoff: {
      text: "Market Penetration strategy converting existing homeowner Level-2 wallboxes into community-accessible neighborhood stations [4].",
      citations: [
        {
          index: 4,
          source_title: "OCPP Open Charge Alliance — Residential Interoperability Brief",
          source_url: "https://openchargealliance.org/",
          similarity: 0.84,
        },
      ],
      assumptions: ["Smart-charger API activation takes under 4 minutes in onboarding."],
      actions: ["Add automated Time-of-Use utility tariff syncing for hosts."],
      ansoff_matrix: {
        quadrant: "market_penetration",
        market_dimension: "Urban EV neighborhoods underserved by curbside Level-2 posts [1]",
        product_dimension: "OCPP-enabled P2P booking, kWh metering, and umbrella liability shield [4]",
        rationale: "Unlocking idle residential chargers scales supply 10x faster than permitting new street hardware [4].",
        citation_index: 4,
      },
    },
    value_chain: {
      text: "Automated OCPP charger telemetry, dynamic Time-of-Use pricing, and embedded host liability insurance anchor value delivery [4].",
      citations: [
        {
          index: 4,
          source_title: "OCPP Open Charge Alliance — Residential Interoperability Brief",
          source_url: "https://openchargealliance.org/",
          similarity: 0.84,
        },
      ],
      assumptions: ["Stripe Connect split payouts handle monthly host disbursements automatically."],
      actions: ["Integrate PlugShare & Apple Maps deep links for organic driver discovery."],
      value_chain: {
        firm_infrastructure: [{ text: "Umbrella host liability insurance, municipal compliance, Stripe Connect payouts [5].", citation_index: 5 }],
        human_resource_management: [{ text: "Lean marketplace ops + local neighborhood ambassador onboarding [3].", citation_index: 3 }],
        technology_development: [{ text: "OCPP smart-plug session control + utility Time-of-Use margin engine [4].", citation_index: 4 }],
        procurement: [{ text: "Insurtech per-session coverage & hardware OEM referral partnerships [4].", citation_index: 4 }],
        inbound_logistics: [{ text: "Remote smart-charger verification via OCPP credential handshake [4].", citation_index: 4 }],
        operations: [{ text: "Automated session start/stop lockouts and kWh settlement [4].", citation_index: 4 }],
        outbound_logistics: [{ text: "Mobile arrival instructions, gate PIN sharing, and bay occupancy alerts [3].", citation_index: 3 }],
        marketing_and_sales: [{ text: "Nextdoor driveway host campaigns + apartment leasing office bundles [3].", citation_index: 3 }],
        service: [{ text: "24/7 emergency tow/blocked-bay credits and host dispute mediation [5].", citation_index: 5 }],
      },
    },
    bmc: {
      text: "18% marketplace take rate on residential charging sessions paired with optional recurring monthly resident pass subscriptions [4].",
      citations: [
        {
          index: 4,
          source_title: "OCPP Open Charge Alliance — Residential Interoperability Brief",
          source_url: "https://openchargealliance.org/",
          similarity: 0.84,
        },
      ],
      assumptions: ["Average overnight session delivers 34 kWh at $0.32/kWh gross price."],
      actions: ["Launch recurring '3 nights/week' commuter pass to boost host utilization."],
      bmc_canvas: {
        key_partners: [{ text: "Residential charger OEMs (Wallbox, Emporia), EV clubs, apartment managers [4].", citation_index: 4 }],
        key_activities: [{ text: "Host verification, OCPP session metering, trust & safety coverage [4].", citation_index: 4 }],
        value_propositions: [{ text: "Reliable overnight Level-2 charging steps away; passive income for homeowners [1].", citation_index: 1 }],
        key_resources: [{ text: "Multi-brand OCPP orchestration layer and verified urban host map [4].", citation_index: 4 }],
        customer_relationships: [{ text: "Automated app reservations with host-verified scheduling windows [3].", citation_index: 3 }],
        customer_segments: [{ text: "Apartment EV drivers (demand) & rowhouse Level-2 owners (supply) [1].", citation_index: 1 }],
        channels: [{ text: "EV navigation apps, dealership handoffs, neighborhood groups [3].", citation_index: 3 }],
        cost_structure: [{ text: "Per-session umbrella insurance, payment processing, host onboarding incentives [5].", citation_index: 5 }],
        revenue_streams: [{ text: "18% session take rate + $19/mo Driver Priority Pass [4].", citation_index: 4 }],
      },
    },
    balanced_scorecard: {
      text: "Scorecard tracks neighborhood liquidity density, host monthly payout retention, and session completion reliability [3].",
      citations: [
        {
          index: 3,
          source_title: "PlugShare Urban EV Driver Survey",
          source_url: "https://www.plugshare.com/",
          similarity: 0.85,
        },
      ],
      assumptions: ["Neighborhoods with >4 chargers/sq mi achieve 90% session fulfillment."],
      actions: ["Prioritize fulfillment reliability over geographic expansion in Year 1."],
      balanced_scorecard: {
        financial: [
          {
            text: "Preserve positive net take rate after per-session insurance & Stripe fees [4].",
            citation_index: 4,
            metric_name: "Net Marketplace Margin",
            metric_value: "13.2%",
            target_value: "15.5%",
          },
        ],
        customer: [
          {
            text: "Eliminate failed arrivals or blocked driveway cancellations [3].",
            citation_index: 3,
            metric_name: "Session Fulfillment Rate",
            metric_value: "91%",
            target_value: "97%",
          },
        ],
        internal_process: [
          {
            text: "Automate OCPP wallbox pairing without electrician site visits [4].",
            citation_index: 4,
            metric_name: "Self-Serve Host Onboarding",
            metric_value: "6.5 min",
            target_value: "< 4.0 min",
          },
        ],
        learning_and_growth: [
          {
            text: "Grow verified active chargers per urban launch corridor [2].",
            citation_index: 2,
            metric_name: "Chargers / Launch Sq Mi",
            metric_value: "3.4",
            target_value: "6.0",
          },
        ],
      },
    },
  },
};

export const INITIAL_SEED_PROJECTS: SavedProject[] = [
  {
    id: "seed-halo-ledger",
    title: "Halo Ledger",
    idea: SAMPLE_IDEAS[0],
    industry: "FinTech / SaaS",
    geography: "US & UK",
    createdAt: Date.now() - 1000 * 60 * 45,
    versionLabel: "v1.2 (Verified)",
    report: HALO_LEDGER_REPORT,
  },
  {
    id: "seed-nightshift",
    title: "NightShift",
    idea: SAMPLE_IDEAS[1],
    industry: "FoodTech / Logistics",
    geography: "US Metro Corridors",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    versionLabel: "v1.0",
    report: NIGHTSHIFT_REPORT,
  },
  {
    id: "seed-peercharge",
    title: "PeerCharge",
    idea: SAMPLE_IDEAS[2],
    industry: "CleanTech / Mobility",
    geography: "North America & EU",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    versionLabel: "v1.0",
    report: PEERCHARGE_REPORT,
  },
];

export function matchDemoReportForIdea(idea: string): GroundlyReport | null {
  const lower = idea.toLowerCase();
  if (lower.includes("halo ledger")) return HALO_LEDGER_REPORT;
  if (lower.includes("nightshift")) return NIGHTSHIFT_REPORT;
  if (lower.includes("peercharge")) return PEERCHARGE_REPORT;
  return null;
}
