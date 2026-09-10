import { createServerFn } from "@tanstack/react-start";
import { buildGroundlyFallback } from "./fallback";
import { FRAMEWORKS, type AskResponse, type GroundlyReport } from "./types";

const DEFAULT_API = "https://groundly-api.onrender.com";

function apiBase(): string {
  return (
    process.env.GROUNDLY_API_URL ||
    process.env.VITE_API_BASE_URL ||
    DEFAULT_API
  ).replace(/\/$/, "");
}

function isReport(value: unknown): value is GroundlyReport {
  if (!value || typeof value !== "object") return false;
  const r = value as GroundlyReport;
  return Boolean(r.results && r.verification);
}

async function grokFrameworks(idea: string): Promise<GroundlyReport | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.3,
        max_tokens: 3200,
        messages: [
          {
            role: "system",
            content: `You are Groundly. Return ONLY JSON matching:
{"results":{"pestel":{"text":"...use [1][2] markers...","citations":[{"index":1,"source_title":"","source_url":"https://...","similarity":0.7}]},"porter":{...},"swot":{...},"tam":{"text":"...","citations":[...],"market_sizing":{"tam":{"value":null,"note":""},"sam":{"value":null,"note":""},"som":{"value":null,"note":""}}},"stp":{...},"bcg":{...},"ansoff":{...},"value_chain":{...},"bmc":{...},"balanced_scorecard":{...}},
"verification":{"pestel":{"verified":true,"unsupported_claims":[]}},
"business_metrics":{"market_size":{"label":"","rationale":"","citation_index":1,"source_framework":"tam"},"competitive_pressure":{"label":"","rationale":"","citation_index":1,"source_framework":"porter"},"customer_segment":{"label":"","rationale":"","citation_index":1,"source_framework":"stp"},"business_model_fit":{"label":"","rationale":"","citation_index":1,"source_framework":"bmc"},"risk_flags":{"label":"","rationale":"","citation_index":1,"source_framework":"swot"}}}
Rules: never invent dollar figures; if unknown, value=null. Citations must be real public URLs. Text 3-6 sentences per framework with [N] markers.`,
          },
          { role: "user", content: `Business idea:\n${idea}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<GroundlyReport>;
    if (!parsed.results) return null;
    return {
      stage: "finalizing",
      frameworks_requested: [...FRAMEWORKS],
      frameworks_allowed: [...FRAMEWORKS],
      results: parsed.results,
      verification: parsed.verification ?? {},
      business_metrics: parsed.business_metrics ?? {
        market_size: null,
        competitive_pressure: null,
        customer_segment: null,
        business_model_fit: null,
        risk_flags: null,
      },
      source: "grok",
    };
  } catch {
    return null;
  }
}

export const analyzeIdeaGroundly = createServerFn({ method: "POST" })
  .validator((input: { idea: string }) => ({
    idea: String(input?.idea ?? "").trim().slice(0, 600),
  }))
  .handler(async ({ data }) => {
    const idea = data.idea;
    if (idea.length < 8) return { ok: false as const, error: "Idea is too short." };

    const base = apiBase();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const res = await fetch(`${base}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          idea,
          frameworks: [...FRAMEWORKS],
          tier: "free",
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const json: unknown = await res.json();
        if (isReport(json)) {
          return { ok: true as const, report: { ...json, source: "groundly" as const } };
        }
      }
    } catch {
      // fall through
    }

    const grok = await grokFrameworks(idea);
    if (grok) return { ok: true as const, report: grok };
    return { ok: true as const, report: buildGroundlyFallback(idea, "local") };
  });

export const askReportQuestion = createServerFn({ method: "POST" })
  .validator((input: { idea: string; question: string; results: unknown; frameworks_allowed: string[] }) => ({
    idea: String(input?.idea ?? "").slice(0, 600),
    question: String(input?.question ?? "").slice(0, 400),
    results: input?.results ?? {},
    frameworks_allowed: Array.isArray(input?.frameworks_allowed) ? input.frameworks_allowed : [...FRAMEWORKS],
  }))
  .handler(async ({ data }): Promise<AskResponse> => {
    const base = apiBase();
    try {
      const res = await fetch(`${base}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return (await res.json()) as AskResponse;
    } catch {
      // fall through
    }

    const apiKey = process.env.XAI_API_KEY;
    if (apiKey) {
      try {
        const sections = Object.entries(data.results as Record<string, { text?: string }>)
          .filter(([, v]) => v?.text)
          .map(([fw, v]) => `[${fw.toUpperCase()}]\n${v.text}`)
          .join("\n\n");
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-4.5",
            temperature: 0.2,
            max_tokens: 600,
            messages: [
              {
                role: "system",
                content:
                  "Answer only from the report sections. JSON: {answer, grounded, sources:[{framework, citation_index}]}. If the report does not cover it, grounded=false.",
              },
              { role: "user", content: `IDEA: ${data.idea}\n\n${sections}\n\nQUESTION: ${data.question}` },
            ],
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const match = body.choices?.[0]?.message?.content?.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]) as AskResponse;
        }
      } catch {
        // fall through
      }
    }

    return {
      answer: "This session could not reach the Groundly API, so Ask AI is limited to the report text already on screen. Try again in a moment.",
      grounded: false,
      sources: [],
    };
  });
