import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { inferSectorKeywords, normalizeMarketSizing } from "./src/lib/marketSizing";
import {
  buildFilteredDirectoryCitationUrl,
  buildNaicsPriorityPlan,
  DEFAULT_MISSISSAUGA_QUERY_URL,
  formatDirectoryPeerSnippet,
  MISSISSAUGA_EATERIES_QUERY_URL,
  MISSISSAUGA_EMPLOYMENT_QUERY_URL,
  summarizeEmploymentHubs,
  type MississaugaBizRecord,
  type MississaugaEateryRecord,
  type MississaugaEmploymentRow,
} from "./src/lib/mississaugaOpenData";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

interface SearchCitation {
  index: number;
  source_title: string;
  source_url: string;
  similarity: number;
  snippet?: string;
}

const POINT_ARRAY_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      citation_index: { type: Type.INTEGER },
    },
    required: ["text"],
  },
};

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    business_metrics: {
      type: Type.OBJECT,
      properties: {
        market_size: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            rationale: { type: Type.STRING },
            citation_index: { type: Type.INTEGER },
            source_framework: { type: Type.STRING },
          },
          required: ["label", "rationale"],
        },
        competitive_pressure: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            rationale: { type: Type.STRING },
            citation_index: { type: Type.INTEGER },
            source_framework: { type: Type.STRING },
          },
          required: ["label", "rationale"],
        },
        customer_segment: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            rationale: { type: Type.STRING },
            citation_index: { type: Type.INTEGER },
            source_framework: { type: Type.STRING },
          },
          required: ["label", "rationale"],
        },
        business_model_fit: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            rationale: { type: Type.STRING },
            citation_index: { type: Type.INTEGER },
            source_framework: { type: Type.STRING },
          },
          required: ["label", "rationale"],
        },
        risk_flags: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            rationale: { type: Type.STRING },
            citation_index: { type: Type.INTEGER },
            source_framework: { type: Type.STRING },
          },
          required: ["label", "rationale"],
        },
      },
      required: [
        "market_size",
        "competitive_pressure",
        "customer_segment",
        "business_model_fit",
        "risk_flags",
      ],
    },
    pestel: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        pestel_analysis: {
          type: Type.OBJECT,
          properties: {
            political: POINT_ARRAY_SCHEMA,
            economic: POINT_ARRAY_SCHEMA,
            social: POINT_ARRAY_SCHEMA,
            technological: POINT_ARRAY_SCHEMA,
            environmental: POINT_ARRAY_SCHEMA,
            legal: POINT_ARRAY_SCHEMA,
          },
          required: [
            "political",
            "economic",
            "social",
            "technological",
            "environmental",
            "legal",
          ],
        },
      },
      required: ["text", "pestel_analysis", "assumptions", "actions"],
    },
    porter: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        porter_forces: {
          type: Type.OBJECT,
          properties: {
            competitive_rivalry: POINT_ARRAY_SCHEMA,
            threat_of_new_entrants: POINT_ARRAY_SCHEMA,
            bargaining_power_of_suppliers: POINT_ARRAY_SCHEMA,
            bargaining_power_of_buyers: POINT_ARRAY_SCHEMA,
            threat_of_substitutes: POINT_ARRAY_SCHEMA,
          },
          required: [
            "competitive_rivalry",
            "threat_of_new_entrants",
            "bargaining_power_of_suppliers",
            "bargaining_power_of_buyers",
            "threat_of_substitutes",
          ],
        },
      },
      required: ["text", "porter_forces", "assumptions", "actions"],
    },
    swot: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        swot_analysis: {
          type: Type.OBJECT,
          properties: {
            strengths: POINT_ARRAY_SCHEMA,
            weaknesses: POINT_ARRAY_SCHEMA,
            opportunities: POINT_ARRAY_SCHEMA,
            threats: POINT_ARRAY_SCHEMA,
          },
          required: ["strengths", "weaknesses", "opportunities", "threats"],
        },
      },
      required: ["text", "swot_analysis", "assumptions", "actions"],
    },
    tam: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        market_sizing: {
          type: Type.OBJECT,
          properties: {
            tam: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value_usd: { type: Type.NUMBER },
                cagr_pct: { type: Type.NUMBER },
                tier_description: { type: Type.STRING },
                note: { type: Type.STRING },
                citation_index: { type: Type.INTEGER },
              },
              required: ["label", "value_usd", "cagr_pct", "note"],
            },
            sam: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value_usd: { type: Type.NUMBER },
                cagr_pct: { type: Type.NUMBER },
                tier_description: { type: Type.STRING },
                note: { type: Type.STRING },
                citation_index: { type: Type.INTEGER },
              },
              required: ["label", "value_usd", "cagr_pct", "note"],
            },
            som: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value_usd: { type: Type.NUMBER },
                cagr_pct: { type: Type.NUMBER },
                tier_description: { type: Type.STRING },
                note: { type: Type.STRING },
                citation_index: { type: Type.INTEGER },
              },
              required: ["label", "value_usd", "cagr_pct", "note"],
            },
          },
          required: ["tam", "sam", "som"],
        },
      },
      required: ["text", "market_sizing", "assumptions", "actions"],
    },
    stp: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        stp_analysis: {
          type: Type.OBJECT,
          properties: {
            segmentation: POINT_ARRAY_SCHEMA,
            targeting: POINT_ARRAY_SCHEMA,
            positioning: POINT_ARRAY_SCHEMA,
          },
          required: ["segmentation", "targeting", "positioning"],
        },
      },
      required: ["text", "stp_analysis", "assumptions", "actions"],
    },
    bcg: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        bcg_matrix: {
          type: Type.OBJECT,
          properties: {
            quadrant: { type: Type.STRING },
            market_growth_rate_pct: { type: Type.NUMBER },
            market_share_position: { type: Type.STRING },
            rationale: { type: Type.STRING },
            citation_index: { type: Type.INTEGER },
          },
          required: [
            "quadrant",
            "market_growth_rate_pct",
            "market_share_position",
            "rationale",
          ],
        },
      },
      required: ["text", "bcg_matrix", "assumptions", "actions"],
    },
    ansoff: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        ansoff_matrix: {
          type: Type.OBJECT,
          properties: {
            quadrant: { type: Type.STRING },
            market_dimension: { type: Type.STRING },
            product_dimension: { type: Type.STRING },
            rationale: { type: Type.STRING },
            citation_index: { type: Type.INTEGER },
          },
          required: [
            "quadrant",
            "market_dimension",
            "product_dimension",
            "rationale",
          ],
        },
      },
      required: ["text", "ansoff_matrix", "assumptions", "actions"],
    },
    value_chain: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        value_chain: {
          type: Type.OBJECT,
          properties: {
            firm_infrastructure: POINT_ARRAY_SCHEMA,
            human_resource_management: POINT_ARRAY_SCHEMA,
            technology_development: POINT_ARRAY_SCHEMA,
            procurement: POINT_ARRAY_SCHEMA,
            inbound_logistics: POINT_ARRAY_SCHEMA,
            operations: POINT_ARRAY_SCHEMA,
            outbound_logistics: POINT_ARRAY_SCHEMA,
            marketing_and_sales: POINT_ARRAY_SCHEMA,
            service: POINT_ARRAY_SCHEMA,
          },
          required: [
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
        },
      },
      required: ["text", "value_chain", "assumptions", "actions"],
    },
    bmc: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        bmc_canvas: {
          type: Type.OBJECT,
          properties: {
            key_partners: POINT_ARRAY_SCHEMA,
            key_activities: POINT_ARRAY_SCHEMA,
            value_propositions: POINT_ARRAY_SCHEMA,
            key_resources: POINT_ARRAY_SCHEMA,
            customer_relationships: POINT_ARRAY_SCHEMA,
            customer_segments: POINT_ARRAY_SCHEMA,
            channels: POINT_ARRAY_SCHEMA,
            cost_structure: POINT_ARRAY_SCHEMA,
            revenue_streams: POINT_ARRAY_SCHEMA,
          },
          required: [
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
        },
      },
      required: ["text", "bmc_canvas", "assumptions", "actions"],
    },
    balanced_scorecard: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } },
        balanced_scorecard: {
          type: Type.OBJECT,
          properties: {
            financial: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  citation_index: { type: Type.INTEGER },
                  metric_name: { type: Type.STRING },
                  metric_value: { type: Type.STRING },
                  target_value: { type: Type.STRING },
                },
                required: ["text", "metric_name", "metric_value"],
              },
            },
            customer: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  citation_index: { type: Type.INTEGER },
                  metric_name: { type: Type.STRING },
                  metric_value: { type: Type.STRING },
                  target_value: { type: Type.STRING },
                },
                required: ["text", "metric_name", "metric_value"],
              },
            },
            internal_process: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  citation_index: { type: Type.INTEGER },
                  metric_name: { type: Type.STRING },
                  metric_value: { type: Type.STRING },
                  target_value: { type: Type.STRING },
                },
                required: ["text", "metric_name", "metric_value"],
              },
            },
            learning_and_growth: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  citation_index: { type: Type.INTEGER },
                  metric_name: { type: Type.STRING },
                  metric_value: { type: Type.STRING },
                  target_value: { type: Type.STRING },
                },
                required: ["text", "metric_name", "metric_value"],
              },
            },
          },
          required: [
            "financial",
            "customer",
            "internal_process",
            "learning_and_growth",
          ],
        },
      },
      required: ["text", "balanced_scorecard", "assumptions", "actions"],
    },
  },
  required: [
    "business_metrics",
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
  ],
};

interface DirectoryQueryResult {
  summary: string;
  matchedCount: number;
  totalSectorCount?: number;
  exactMatch: boolean;
  sectorKeywords: string[];
  status: "found" | "sector_context" | "not_found";
  directoryCitationUrl: string;
  directoryCitationTitle: string;
  directoryCitationSnippet: string;
  extraSummaries: string[];
  extraCitations: Omit<SearchCitation, "index">[];
}

function extractReadableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || "Request failed.");
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) return String(parsed.error.message);
    if (parsed?.message) return String(parsed.message);
  } catch {
    // Not raw JSON
  }
  return raw;
}

function isTransientHighDemandError(err: unknown): boolean {
  const msg = extractReadableError(err).toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("resource_exhausted") ||
    msg.includes("overloaded") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted")
  );
}

function isQuotaExceededError(err: unknown): boolean {
  const msg = extractReadableError(err).toLowerCase();
  return msg.includes("exceeded your current quota") || msg.includes("billing details");
}

function isSchemaStateLimitError(err: unknown): boolean {
  const msg = extractReadableError(err).toLowerCase();
  return msg.includes("too many states") || msg.includes("schema");
}

async function generateContentResilient(
  ai: GoogleGenAI,
  request: {
    contents: string;
    config?: Record<string, unknown>;
    timeoutMs?: number;
  },
) {
  const primaryModel = process.env.GEMINI_MODEL || "gemini-4-hydrogen";
  const attempts =
    primaryModel === "gemini-3.1-flash-lite"
      ? [
          { model: primaryModel, delayMs: 0, isRetry: false },
          { model: primaryModel, delayMs: 500, isRetry: true },
        ]
      : [
          { model: primaryModel, delayMs: 0, isRetry: false },
          { model: primaryModel, delayMs: 500, isRetry: true },
          { model: "gemini-3.1-flash-lite", delayMs: 200, isRetry: false },
          { model: "gemini-3.1-flash-lite", delayMs: 500, isRetry: true },
        ];

  const perAttemptMs = request.timeoutMs ?? 18000;
  let lastErr: unknown;
  let lastDurationMs = 0;
  const quotaExhaustedModels = new Set<string>();

  for (let idx = 0; idx < attempts.length; idx++) {
    const { model, delayMs, isRetry } = attempts[idx];
    if (isRetry && (quotaExhaustedModels.has(model) || lastDurationMs > 5000)) {
      continue;
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const reqConfig: Record<string, unknown> = request.config
      ? { ...request.config }
      : {};
    reqConfig.abortSignal = AbortSignal.timeout(perAttemptMs);
    if (model === "gemini-3.1-flash-lite") {
      if (reqConfig.tools) {
        delete reqConfig.thinkingConfig;
      } else {
        reqConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      }
      delete reqConfig.responseSchema;
    }
    const started = Date.now();
    try {
      return await ai.models.generateContent({
        model,
        contents: request.contents,
        config: reqConfig,
      });
    } catch (err) {
      lastDurationMs = Date.now() - started;
      lastErr = err;
      if (isQuotaExceededError(err)) {
        quotaExhaustedModels.add(model);
      }
      if (isSchemaStateLimitError(err) && reqConfig.responseSchema) {
        try {
          const relaxed: Record<string, unknown> = {
            ...reqConfig,
            abortSignal: AbortSignal.timeout(perAttemptMs),
          };
          delete relaxed.responseSchema;
          return await ai.models.generateContent({
            model,
            contents: request.contents,
            config: relaxed,
          });
        } catch (retryErr) {
          lastErr = retryErr;
        }
      }
      if (!isTransientHighDemandError(lastErr)) {
        throw lastErr;
      }
    }
  }
  throw lastErr;
}

async function queryMississaugaCommercialHubs(params: {
  isFoodSector: boolean;
  isDefaultEndpoint: boolean;
  geography?: string;
}): Promise<{ summaries: string[]; citations: Omit<SearchCitation, "index">[] }> {
  const summaries: string[] = [];
  const citations: Omit<SearchCitation, "index">[] = [];

  if (!params.isDefaultEndpoint) {
    return { summaries, citations };
  }

  const targetGeo = (params.geography || "Mississauga").toLowerCase();
  const isMississaugaScope =
    targetGeo.includes("mississauga") || targetGeo.includes("gta") || targetGeo.includes("ontario");
  if (!isMississaugaScope) {
    return { summaries, citations };
  }

  // 1. Live 2025 Employment Hubs by Character Area (B2B Office & Hybrid Commuter Density)
  const empPromise = (async () => {
    try {
      const empUrl = new URL(MISSISSAUGA_EMPLOYMENT_QUERY_URL);
      empUrl.searchParams.set("where", "1=1");
      empUrl.searchParams.set("outFields", "*");
      empUrl.searchParams.set("f", "json");
      const resp = await fetch(empUrl.toString(), { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return;
      const json = (await resp.json()) as {
        features?: Array<{ attributes?: MississaugaEmploymentRow }>;
      };
      const rows = (json.features || [])
        .map((f) => f.attributes)
        .filter((r): r is MississaugaEmploymentRow => Boolean(r && r.CA_Type));
      const summarized = summarizeEmploymentHubs(rows);
      if (summarized) {
        summaries.push(summarized.summary);
        empUrl.searchParams.set("f", "pjson");
        citations.push({
          source_title: "City of Mississauga 2025 Employment Survey by Commercial Hub (MED)",
          source_url: empUrl.toString(),
          similarity: 0.93,
          snippet: summarized.snippet,
        });
      }
    } catch {
      // Non-fatal supplementary dataset
    }
  })();

  // 2. Licensed Eateries Registry when venture is in Food/Catering/Hospitality
  const eateriesPromise = params.isFoodSector
    ? (async () => {
        try {
          const whereClause =
            "UPPER(BUSINESSTYPE) LIKE '%CATER%' OR UPPER(BUSINESSNAME) LIKE '%CATER%'";
          const listUrl = new URL(MISSISSAUGA_EATERIES_QUERY_URL);
          listUrl.searchParams.set("where", whereClause);
          listUrl.searchParams.set(
            "outFields",
            "BUSINESSNAME,BUSINESSTYPE,STREET,POSTAL",
          );
          listUrl.searchParams.set("resultRecordCount", "8");
          listUrl.searchParams.set("f", "json");

          const countUrl = new URL(MISSISSAUGA_EATERIES_QUERY_URL);
          countUrl.searchParams.set("where", "1=1");
          countUrl.searchParams.set("returnCountOnly", "true");
          countUrl.searchParams.set("f", "json");

          const [listResp, countResp] = await Promise.all([
            fetch(listUrl.toString(), { signal: AbortSignal.timeout(5000) }),
            fetch(countUrl.toString(), { signal: AbortSignal.timeout(4500) }),
          ]);

          const listJson = listResp.ok
            ? ((await listResp.json()) as {
                features?: Array<{ attributes?: MississaugaEateryRecord }>;
              })
            : null;
          const countJson = countResp.ok
            ? ((await countResp.json()) as { count?: number })
            : null;

          const eateries = (listJson?.features || [])
            .map((f) => f.attributes)
            .filter((r): r is MississaugaEateryRecord => Boolean(r && r.BUSINESSNAME));
          const totalLicensed = typeof countJson?.count === "number" ? countJson.count : undefined;

          if (eateries.length > 0 || totalLicensed) {
            const sampleNames = eateries
              .slice(0, 5)
              .map((e) => `${e.BUSINESSNAME} (${e.STREET || "Mississauga"}${e.POSTAL ? ` ${e.POSTAL}` : ""})`)
              .join("; ");
            summaries.push(
              `MISSISSAUGA LICENSED EATERIES & COMMISSARY SUPPLY (${totalLicensed ? `${totalLicensed.toLocaleString("en-US")} active licensed food premises` : "Active licensed premises"}): Sample licensed catering operators include ${sampleNames}.`,
            );
            listUrl.searchParams.set("f", "pjson");
            citations.push({
              source_title: `Mississauga Licensed Eateries Registry (${totalLicensed ? `${totalLicensed.toLocaleString("en-US")} premises` : "Active Registry"})`,
              source_url: listUrl.toString(),
              similarity: 0.9,
              snippet: `Active health-inspected food & catering supply base (${totalLicensed ? `${totalLicensed.toLocaleString("en-US")} total licensed eateries` : "licensed operators"}), including ${sampleNames}.`,
            });
          }
        } catch {
          // Non-fatal supplementary dataset
        }
      })()
    : Promise.resolve();

  await Promise.all([empPromise, eateriesPromise]);
  return { summaries, citations };
}

async function queryMississaugaDirectory(params: {
  mode: string;
  businessName?: string;
  idea?: string;
  industry?: string;
  geography?: string;
  dataSourceUrl?: string;
}): Promise<DirectoryQueryResult> {
  const isCustomEndpoint = Boolean(
    params.dataSourceUrl && params.dataSourceUrl.startsWith("https://"),
  );
  const endpoint = isCustomEndpoint
    ? (params.dataSourceUrl as string)
    : DEFAULT_MISSISSAUGA_QUERY_URL;

  const sectorKeywords = inferSectorKeywords({
    businessName: params.businessName,
    idea: params.idea,
    industry: params.industry,
  });

  const naicsPlan = buildNaicsPriorityPlan({
    businessName: params.businessName,
    idea: params.idea,
    industry: params.industry,
    sectorKeywords,
  });

  const isFoodSector =
    sectorKeywords.includes("CATER") ||
    sectorKeywords.includes("FOOD") ||
    sectorKeywords.includes("RESTAURANT");

  try {
    const rawBizQuery = (params.businessName || "")
      .replace(/[^a-zA-Z0-9 &.]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 4)
      .map((w) => w.toUpperCase());

    const runQuery = async (whereClause: string): Promise<MississaugaBizRecord[]> => {
      const url = new URL(endpoint);
      url.searchParams.set("f", "json");
      if (!url.searchParams.has("outFields")) {
        url.searchParams.set(
          "outFields",
          "BusinessName,NAICSSector,NAICSCode,NAICSDescription,EmplRange,CHArea,Ward,StreetAddress,WebAddress",
        );
      }
      if (!url.searchParams.has("resultRecordCount")) {
        url.searchParams.set("resultRecordCount", "15");
      }
      url.searchParams.set("where", whereClause);

      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
      if (!resp.ok) return [];
      const json = (await resp.json()) as {
        features?: Array<{ attributes?: MississaugaBizRecord; properties?: MississaugaBizRecord }>;
      };
      return (json.features || [])
        .map((f) => f.attributes || f.properties)
        .filter((r): r is MississaugaBizRecord => Boolean(r && r.BusinessName))
        .slice(0, 15);
    };

    const runCountQuery = async (whereClause: string): Promise<number | undefined> => {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("f", "json");
        url.searchParams.set("returnCountOnly", "true");
        url.searchParams.set("where", whereClause);
        const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
        if (!resp.ok) return undefined;
        const json = (await resp.json()) as { count?: number };
        return typeof json.count === "number" ? json.count : undefined;
      } catch {
        return undefined;
      }
    };

    let rows: MississaugaBizRecord[] = [];
    let exactMatch = false;
    let usedWhereClause = "";
    let totalSectorCount: number | undefined;
    let broadSectorCount: number | undefined;

    const commercialHubPromise = queryMississaugaCommercialHubs({
      isFoodSector,
      isDefaultEndpoint: !isCustomEndpoint,
      geography: params.geography,
    });

    if (params.mode === "business" && rawBizQuery.length > 0) {
      const phrase = rawBizQuery.join(" ");
      usedWhereClause = `UPPER(BusinessName) LIKE '%${phrase}%'`;
      rows = await runQuery(usedWhereClause);
      if (rows.length === 0 && rawBizQuery.length > 1) {
        usedWhereClause = rawBizQuery
          .map((w) => `UPPER(BusinessName) LIKE '%${w}%'`)
          .join(" AND ");
        rows = await runQuery(usedWhereClause);
      }
      if (rows.length > 0) {
        exactMatch = true;
      }
    }

    // Step 1b: If trade name unlisted, prioritize exact 6-digit NAICS (e.g. 722320 Caterers)
    if (rows.length === 0 && !isCustomEndpoint && naicsPlan.exactWhereClause) {
      usedWhereClause = naicsPlan.exactWhereClause;
      const [exactNaicsRows, exactCount, broadCount] = await Promise.all([
        runQuery(naicsPlan.exactWhereClause),
        runCountQuery(naicsPlan.exactWhereClause),
        naicsPlan.broadWhereClause
          ? runCountQuery(naicsPlan.broadWhereClause)
          : Promise.resolve(undefined),
      ]);
      rows = exactNaicsRows;
      totalSectorCount = exactCount;
      broadSectorCount = broadCount;
    }

    // Step 1c: Fallback to keyword sector match (or custom endpoint query)
    if (rows.length === 0 && sectorKeywords.length > 0) {
      usedWhereClause = sectorKeywords
        .map(
          (kw) =>
            `UPPER(NAICSDescription) LIKE '%${kw}%' OR UPPER(NAICSSector) LIKE '%${kw}%' OR UPPER(BusinessName) LIKE '%${kw}%'`,
        )
        .join(" OR ");
      const [sectorRows, countVal] = await Promise.all([
        runQuery(usedWhereClause),
        runCountQuery(usedWhereClause),
      ]);
      rows = sectorRows;
      totalSectorCount = countVal;
    }

    const commercialHubs = await commercialHubPromise;

    if (rows.length === 0) {
      return {
        summary: commercialHubs.summaries.join("\n\n"),
        matchedCount: 0,
        exactMatch: false,
        sectorKeywords,
        status: "not_found",
        directoryCitationUrl: endpoint,
        directoryCitationTitle: "2025 Mississauga Business Directory (Open Data)",
        directoryCitationSnippet: "Trade name and category query returned 0 direct directory rows.",
        extraSummaries: commercialHubs.summaries,
        extraCitations: commercialHubs.citations,
      };
    }

    const lines = rows.map(
      (r, idx) =>
        `${idx + 1}. ${r.BusinessName} | NAICS ${r.NAICSCode || "N/A"}: ${r.NAICSDescription || r.NAICSSector || "Commercial"} | ${r.CHArea || (r.Ward ? `Ward ${r.Ward}` : "Mississauga")}${r.StreetAddress ? ` (${r.StreetAddress})` : ""} | Size: ${r.EmplRange || "N/A"}${r.WebAddress ? ` | Web: ${r.WebAddress}` : ""}`,
    );

    const broadNote =
      broadSectorCount && totalSectorCount && broadSectorCount > totalSectorCount
        ? ` (${broadSectorCount.toLocaleString("en-US")} across broader food/beverage services NAICS 722)`
        : "";

    const header = exactMatch
      ? `MISSISSAUGA 2025 BUSINESS DIRECTORY EXACT MATCHES (${rows.length} records):`
      : `TRADE NAME "${params.businessName || params.idea || ""}" WAS NOT LISTED IN THE 2025 MUNICIPAL SNAPSHOT (common for newer entrants, DBAs, online-first operators, or numbered corps). RETRIEVED ${naicsPlan.categoryLabel.toUpperCase()} PEERS (${rows.length} sampled out of ${totalSectorCount ?? rows.length} registered${broadNote}):`;

    const directoryCitationUrl = buildFilteredDirectoryCitationUrl(endpoint, usedWhereClause);
    const directoryCitationTitle = exactMatch
      ? `2025 Mississauga Business Directory — Exact Match (${rows.length} record${rows.length === 1 ? "" : "s"})`
      : `2025 Mississauga Business Directory — ${naicsPlan.categoryLabel} (${totalSectorCount ?? rows.length} peers)`;
    const directoryCitationSnippet = formatDirectoryPeerSnippet({
      exactMatch,
      businessName: params.businessName || params.idea,
      rows,
      matchedCount: rows.length,
      totalSectorCount,
      categoryLabel: naicsPlan.categoryLabel,
    });

    const combinedSummary = [header, lines.join("\n"), ...commercialHubs.summaries]
      .filter(Boolean)
      .join("\n\n");

    return {
      matchedCount: rows.length,
      totalSectorCount,
      exactMatch,
      sectorKeywords,
      status: exactMatch ? "found" : "sector_context",
      summary: combinedSummary,
      directoryCitationUrl,
      directoryCitationTitle,
      directoryCitationSnippet,
      extraSummaries: commercialHubs.summaries,
      extraCitations: commercialHubs.citations,
    };
  } catch {
    return {
      summary: "",
      matchedCount: 0,
      exactMatch: false,
      sectorKeywords,
      status: "not_found",
      directoryCitationUrl: endpoint,
      directoryCitationTitle: "2025 Mississauga Business Directory (Open Data)",
      directoryCitationSnippet: "Directory query unavailable in this pass.",
      extraSummaries: [],
      extraCitations: [],
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.post("/api/analyze", async (req, res) => {
    const {
      mode = "idea",
      businessName,
      idea,
      industry,
      geography,
      dataSourceUrl,
      frameworks,
    } = req.body ?? {};

    const cleanBusinessName =
      typeof businessName === "string" ? businessName.trim() : "";
    const cleanIdea = typeof idea === "string" ? idea.trim() : "";

    if (mode === "business") {
      if (cleanBusinessName.length < 2) {
        return res
          .status(400)
          .json({ error: "Please enter an existing business name (at least 2 characters)." });
      }
    } else if (cleanIdea.length < 12) {
      return res
        .status(400)
        .json({ error: "Please enter a business idea of at least 12 characters." });
    }

    const ai = createGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          "Live Gemini analysis requires GEMINI_API_KEY in Settings > Secrets, or choose one of the pre-seeded sample ideas (Halo Ledger, NightShift, PeerCharge).",
      });
    }

    try {
      const resolvedGeography =
        typeof geography === "string" && geography.trim().length > 0
          ? geography.trim()
          : "Mississauga, ON, Canada";

      const targetLabel =
        mode === "business"
          ? `Existing Business Audit: ${cleanBusinessName}${cleanIdea ? ` (${cleanIdea})` : ""}`
          : `Business Idea: ${cleanIdea}`;
      const contextLine = [
        targetLabel,
        industry ? `Industry: ${industry}` : null,
        `Geography: ${resolvedGeography}`,
      ]
        .filter(Boolean)
        .join(" | ");

      // Step 1: Check Mississauga Business Directory FIRST + supplementary 2025 Employment & Licensed Eateries datasets
      let citations: SearchCitation[] = [];
      const localData = await queryMississaugaDirectory({
        mode,
        businessName: cleanBusinessName,
        idea: cleanIdea,
        industry,
        geography: resolvedGeography,
        dataSourceUrl,
      });

      const directoryNote =
        localData.status === "found" || localData.status === "sector_context"
          ? localData.summary
          : [
              `DIRECTORY LOOKUP RESULT: "${cleanBusinessName || cleanIdea}" was not found under its trade name in the 2025 Mississauga Business Directory snapshot. Perform full category identification and market analysis using Google Search RAG and industry benchmarks.`,
              ...localData.extraSummaries,
            ]
              .filter(Boolean)
              .join("\n\n");

      if (localData.matchedCount > 0) {
        citations.push({
          index: 1,
          source_title: localData.directoryCitationTitle,
          source_url: localData.directoryCitationUrl,
          similarity: localData.exactMatch ? 0.96 : 0.94,
          snippet: localData.directoryCitationSnippet,
        });
      }

      for (const extraCit of localData.extraCitations) {
        citations.push({
          index: citations.length + 1,
          ...extraCit,
        });
      }

      // Step 2: Live Google Search RAG Grounding
      let researchSummary = directoryNote;
      let ragStatus: "grounded" | "search_text_only" | "unavailable" = "unavailable";
      let ragDetail = "";
      const searchPrompt =
        mode === "business" && !localData.exactMatch
          ? `Identify and research the existing business "${cleanBusinessName}" (${cleanIdea || "local commercial business"}, ${resolvedGeography}${industry ? `, ${industry}` : ""}). Note: absence from a municipal business directory snapshot often occurs for DBA trade names, numbered corporations, recent registrants, or online-first operators—do NOT treat it as non-existent. Use Google Search to find "${cleanBusinessName}", classify its industry/NAICS category, find direct local & national competitors, USD TAM/SAM/SOM market sizing, CAGR growth rates, pricing, and key risks.\n${localData.summary ? `\nLocal category peers already pulled:\n${localData.summary}` : ""}`
          : mode === "business"
            ? `Research deeper competitive context, customer reviews, growth opportunities, USD TAM/SAM/SOM market sizing, CAGR growth rates, unit economics, and regulatory dynamics for this existing business:\n${contextLine}\nDirectory profile already retrieved:\n${localData.summary}`
            : `Research market sizing (TAM, SAM, SOM in USD), CAGR growth rates, major competitors, unit economics, regulatory considerations, and target buyer dynamics for this venture:\n${contextLine}\nProvide concrete dollar figures, competitor names, and market dynamics.`;

      try {
        const searchResp = await generateContentResilient(ai, {
          contents: searchPrompt,
          timeoutMs: 10000,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        const searchText = searchResp.text || "";
        researchSummary = [directoryNote, searchText]
          .filter(Boolean)
          .join("\n\n");
        const meta = searchResp.candidates?.[0]?.groundingMetadata;
        const chunks = meta?.groundingChunks || [];
        const seenUrls = new Set<string>();
        chunks.forEach((chunk) => {
          const web = chunk.web;
          if (web?.uri && !seenUrls.has(web.uri)) {
            seenUrls.add(web.uri);
            citations.push({
              index: citations.length + 1,
              source_title: web.title || web.uri,
              source_url: web.uri,
              similarity: Number((0.92 - citations.length * 0.025).toFixed(2)),
            });
          }
        });
        ragStatus = seenUrls.size > 0 ? "grounded" : searchText ? "search_text_only" : "unavailable";
        if (ragStatus !== "grounded") {
          ragDetail = `Search text len=${searchText.length}, queries=${JSON.stringify(meta?.webSearchQueries || [])}`;
        }
      } catch (searchErr) {
        ragStatus = "unavailable";
        ragDetail = extractReadableError(searchErr);
        console.warn("[Groundly Search RAG] Grounding fallback error:", ragDetail);
      }

      const citationCatalog =
        citations.length > 0
          ? citations
              .slice(0, 12)
              .map(
                (c) =>
                  `[${c.index}] ${c.source_title} (${c.source_url})${c.snippet ? `\n    Evidence: ${c.snippet}` : ""}`,
              )
              .join("\n")
          : "No external URLs available in this run (do NOT invent URLs or citation indices).";

      // Step 3: Map retrieved directory peers + Search RAG research into strict 10-framework structured JSON
      const synthPrompt = `You are a senior venture strategy & market analyst. Analyze the business below using the retrieved directory peers, Search RAG research notes, and citation catalog. Return ONLY valid JSON.
${contextLine}

IMPORTANT ANALYTICAL RULES:
- If an existing business's trade name is not in the 2025 Mississauga Business Directory snapshot, recognize that municipal snapshots often omit DBA trade names, numbered legal entities, online-first/commissary operators, and recent registrants. Identify its exact industry/NAICS category and evaluate both the business concept and its local sector peers thoroughly.
- Never fabricate citations or invent fake URLs. Use ONLY integer citation_index values (1..${citations.length}) listed in CITATION CATALOG; if CITATION CATALOG is empty, omit citation_index (null) rather than writing [1].
- For tam.market_sizing (tam, sam, som):
  * label MUST be a compact USD dollar string like "$4.8B", "$620M", or "$24M" (NEVER prose words!).
  * value_usd MUST be a numeric USD number (e.g. 4800000000, 620000000, 24000000) with TAM >= SAM >= SOM.
  * cagr_pct MUST be a numeric percentage (e.g. 6.4), NOT a string.
  * tier_description MUST hold the short descriptive scope (e.g. "Canadian commercial corporate catering market").

RETRIEVED RESEARCH & LOCAL SECTOR PEERS:
${researchSummary || "Use rigorous industry benchmarks and clearly separate verified local data from category estimates."}

CITATION CATALOG:
${citationCatalog}

Required top-level JSON keys:
- business_metrics: { market_size, competitive_pressure, customer_segment, business_model_fit, risk_flags } (each { label, rationale, citation_index, source_framework })
- pestel: { text, assumptions, actions, pestel_analysis: { political, economic, social, technological, environmental, legal } } (point arrays of { text, citation_index })
- porter: { text, assumptions, actions, porter_forces: { competitive_rivalry, threat_of_new_entrants, bargaining_power_of_suppliers, bargaining_power_of_buyers, threat_of_substitutes } }
- swot: { text, assumptions, actions, swot_analysis: { strengths, weaknesses, opportunities, threats } }
- tam: { text, assumptions, actions, market_sizing: { tam, sam, som } } (each { label, value_usd, cagr_pct, tier_description, note, citation_index })
- stp: { text, assumptions, actions, stp_analysis: { segmentation, targeting, positioning } }
- bcg: { text, assumptions, actions, bcg_matrix: { quadrant ("star"|"question_mark"|"cash_cow"|"dog"), market_growth_rate_pct, market_share_position, rationale, citation_index } }
- ansoff: { text, assumptions, actions, ansoff_matrix: { quadrant ("market_penetration"|"product_development"|"market_development"|"diversification"), market_dimension, product_dimension, rationale, citation_index } }
- value_chain: { text, assumptions, actions, value_chain: { firm_infrastructure, human_resource_management, technology_development, procurement, inbound_logistics, operations, outbound_logistics, marketing_and_sales, service } }
- bmc: { text, assumptions, actions, bmc_canvas: { key_partners, key_activities, value_propositions, key_resources, customer_relationships, customer_segments, channels, cost_structure, revenue_streams } }
- balanced_scorecard: { text, assumptions, actions, balanced_scorecard: { financial, customer, internal_process, learning_and_growth } } (arrays of { text, citation_index, metric_name, metric_value, target_value })

Populate all 10 frameworks completely with concise, decision-grade points, 2-3 realistic assumptions, and 2-3 concrete actions per framework.`;

      const structuredResp = await generateContentResilient(ai, {
        contents: synthPrompt,
        timeoutMs: 20000,
        config: {
          responseMimeType: "application/json",
          responseSchema: REPORT_SCHEMA,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawJsonText = (structuredResp.text || "{}")
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      const parsed = JSON.parse(rawJsonText);
      if (parsed?.tam?.market_sizing) {
        parsed.tam.market_sizing = normalizeMarketSizing(parsed.tam.market_sizing);
      }

      const requested = Array.isArray(frameworks)
        ? frameworks
        : [
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
          ];

      const results: Record<string, unknown> = {};
      const verification: Record<string, { verified: boolean; unsupported_claims: string[] }> = {};
      const maxCitIdx = citations.length;
      const hasDirectoryCitation = localData.matchedCount > 0;
      const hasEmploymentCitation = localData.extraCitations.some((c) =>
        c.source_title.includes("Employment"),
      );
      const hasWebCitations = citations.some(
        (c) => !c.source_url.includes("mississauga.ca") && !c.source_url.includes("arcgis.com"),
      );

      for (const fw of requested) {
        const fwData = parsed[fw] || {};
        const fwCitations = citations.slice(0, 6);
        const hasText = typeof fwData.text === "string" && fwData.text.length > 0;
        const claimsNotes: string[] = [];

        if (mode === "business" && !localData.exactMatch) {
          claimsNotes.push(
            hasDirectoryCitation
              ? `"${cleanBusinessName}" was not listed by trade name in the 2025 Mississauga Business Directory (common for DBAs, numbered corporations, or newer entrants); benchmarked against ${localData.totalSectorCount ?? localData.matchedCount} local Mississauga category peers.`
              : `"${cleanBusinessName}" was not found in the 2025 Mississauga Business Directory.`,
          );
        }
        if (!hasWebCitations) {
          claimsNotes.push(
            ragDetail.toLowerCase().includes("quota")
              ? "Live Google Search RAG quota was reached on the current API key; local benchmarks use verified 2025 Mississauga Open Data (Business Directory, Employment Hubs & Licensed Eateries) — upgrade the key in Settings > Secrets for live web citations."
              : "No external web search chunks returned; external market sizing relies on local Open Data & category benchmarks.",
          );
        }

        if (fw === "tam" && fwData?.market_sizing) {
          for (const tierKey of ["tam", "sam", "som"] as const) {
            const tier = fwData.market_sizing[tierKey];
            if (tier && (tier.citation_index == null || tier.citation_index > maxCitIdx || maxCitIdx === 0)) {
              tier.citation_index = maxCitIdx > 0 ? 1 : null;
            }
          }
        }

        results[fw] = {
          ...fwData,
          citations: fwCitations,
        };
        const groundedByOpenData =
          (hasDirectoryCitation && (fw === "porter" || fw === "stp" || fw === "swot" || fw === "bmc")) ||
          (hasEmploymentCitation && fw === "tam");
        verification[fw] = {
          verified: hasText && (hasWebCitations || groundedByOpenData),
          unsupported_claims: claimsNotes,
        };
      }

      return res.json({
        stage: "finalizing",
        directory_status: localData.status,
        directory_matches: localData.matchedCount,
        directory_exact_match: localData.exactMatch,
        directory_total_sector: localData.totalSectorCount,
        rag_status: ragStatus,
        ...(ragDetail ? { rag_detail: ragDetail } : {}),
        frameworks_requested: requested,
        frameworks_allowed: requested,
        results,
        verification,
        business_metrics: parsed.business_metrics,
        source: "gemini",
      });
    } catch (err) {
      console.error("/api/analyze error:", err);
      const message = extractReadableError(err);
      const statusCode = isTransientHighDemandError(err) ? 503 : 500;
      return res.status(statusCode).json({ error: message });
    }
  });

  app.post("/api/ask", async (req, res) => {
    const { idea, question, results } = req.body ?? {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Question is required." });
    }

    const ai = createGeminiClient();
    if (!ai) {
      // Deterministic grounded fallback over report results when no API key is attached
      const entries = Object.entries(results || {}) as [
        string,
        { text?: string; citations?: SearchCitation[] },
      ][];
      const lowerQ = question.toLowerCase();
      const matched =
        entries.find(([, val]) =>
          lowerQ
            .split(/\s+/)
            .some((word) => word.length > 3 && val?.text?.toLowerCase().includes(word)),
        ) || entries[0];

      if (!matched) {
        return res.json({
          answer: "No framework data is available in the current report to answer that question.",
          grounded: false,
          sources: [],
        });
      }

      const [fwKey, fwVal] = matched;
      const firstCit = fwVal?.citations?.[0];
      return res.json({
        answer: `From ${fwKey.toUpperCase()}: ${fwVal?.text || "See framework details."}`,
        grounded: Boolean(firstCit),
        sources: firstCit
          ? [
              {
                framework: fwKey,
                citation_index: firstCit.index,
                source_title: firstCit.source_title,
                source_url: firstCit.source_url,
              },
            ]
          : [],
      });
    }

    try {
      const compactContext = Object.entries(results || {})
        .map(([fw, val]) => {
          const fwVal = val as { text?: string; citations?: SearchCitation[] };
          const cits = (fwVal.citations || [])
            .map((c) => `[${c.index}] ${c.source_title}`)
            .join("; ");
          return `## ${fw.toUpperCase()}\n${fwVal.text || ""}\nCitations: ${cits}`;
        })
        .join("\n\n");

      const response = await generateContentResilient(ai, {
        contents: `Idea: ${idea}\n\nReport Context:\n${compactContext}\n\nUser Question: ${question}\n\nAnswer concisely in 2-4 sentences using ONLY the report context above. Reference [n] citation numbers when supported.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      return res.json({
        answer: response.text || "Unable to extract an answer from the report.",
        grounded: true,
        sources: [],
      });
    } catch (err) {
      console.error("/api/ask error:", err);
      const statusCode = isTransientHighDemandError(err) ? 503 : 500;
      return res.status(statusCode).json({
        error: extractReadableError(err),
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Groundly server listening on http://localhost:${PORT}`);
  });
}

startServer();
