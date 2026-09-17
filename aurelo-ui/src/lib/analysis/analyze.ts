import { createServerFn } from "@tanstack/react-start";
import { buildFallbackReport } from "./fallback";
import type { AnalysisReport, Verdict } from "./types";

const SYSTEM = `You are Aurelo, a precise startup analyst. Return ONLY compact JSON, no markdown, matching:
{"tagline":"max 12 words","verdict":"strong|promising|risky|weak","score":0-100,"tam":"$12.4B","sam":"$3.1B","som":"$180M","tamNote":"one sentence","markets":[{"code":"US","name":"United States","opportunity":0-100}],"competitors":[{"name":"","note":""}],"strengths":[""],"risks":[""],"nextSteps":[""],"insights":[{"title":"","body":""}],"proTips":[""]}
Use 6-9 markets with real ISO-style codes, 3-4 competitors, 3 strengths, 3 risks, 4 nextSteps, 3 insights, 4 proTips. Be numeric, specific, and skeptical.`;

function asReport(raw: unknown, idea: string): AnalysisReport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const verdicts: Verdict[] = ["strong", "promising", "risky", "weak"];
  const verdict = verdicts.includes(r.verdict as Verdict)
    ? (r.verdict as Verdict)
    : "promising";
  const markets = Array.isArray(r.markets) ? r.markets : [];
  const insights = Array.isArray(r.insights) ? r.insights : [];
  const competitors = Array.isArray(r.competitors) ? r.competitors : [];
  if (markets.length < 3 || insights.length < 1) return null;
  return {
    tagline: String(r.tagline ?? "").slice(0, 120) || "A focused wedge with room to grow.",
    verdict,
    score: Math.max(1, Math.min(99, Number(r.score) || 70)),
    tam: String(r.tam ?? "$8.4B"),
    sam: String(r.sam ?? "$1.9B"),
    som: String(r.som ?? "$140M"),
    tamNote: String(r.tamNote ?? "Category spend estimated from adjacent software markets."),
    markets: markets.slice(0, 9).map((m) => {
      const item = (m ?? {}) as Record<string, unknown>;
      return {
        code: String(item.code ?? "US").slice(0, 4).toUpperCase(),
        name: String(item.name ?? "Market").slice(0, 40),
        opportunity: Math.max(1, Math.min(99, Number(item.opportunity) || 50)),
      };
    }),
    competitors: competitors.slice(0, 5).map((c) => {
      const item = (c ?? {}) as Record<string, unknown>;
      return {
        name: String(item.name ?? "Competitor").slice(0, 60),
        note: String(item.note ?? "").slice(0, 180),
      };
    }),
    strengths: (Array.isArray(r.strengths) ? r.strengths : []).map((s) =>
      String(s).slice(0, 180),
    ).slice(0, 4),
    risks: (Array.isArray(r.risks) ? r.risks : []).map((s) => String(s).slice(0, 180)).slice(0, 4),
    nextSteps: (Array.isArray(r.nextSteps) ? r.nextSteps : []).map((s) =>
      String(s).slice(0, 180),
    ).slice(0, 5),
    insights: insights.slice(0, 4).map((i) => {
      const item = (i ?? {}) as Record<string, unknown>;
      return {
        title: String(item.title ?? "Insight").slice(0, 80),
        body: String(item.body ?? "").slice(0, 360),
      };
    }),
    proTips: (Array.isArray(r.proTips) ? r.proTips : []).map((s) => String(s).slice(0, 160)).slice(
      0,
      6,
    ),
  };
}

function parseModelJson(text: string, idea: string): AnalysisReport | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/\{[\s\S]*\}/);
  const blob = fenced ? fenced[0] : trimmed;
  try {
    return asReport(JSON.parse(blob), idea);
  } catch {
    return null;
  }
}

export const analyzeIdea = createServerFn({ method: "POST" })
  .validator((input: { idea: string }) => ({
    idea: String(input?.idea ?? "").trim().slice(0, 600),
  }))
  .handler(async ({ data }) => {
    const idea = data.idea;
    if (idea.length < 8) {
      return { ok: false as const, error: "Idea is too short." };
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: true as const, report: buildFallbackReport(idea), source: "local" as const };
    }

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.6,
          max_tokens: 1400,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Business idea:\n${idea}` },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: true as const, report: buildFallbackReport(idea), source: "local" as const };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      const parsed = parseModelJson(text, idea);
      if (!parsed) {
        return { ok: true as const, report: buildFallbackReport(idea), source: "local" as const };
      }
      return { ok: true as const, report: parsed, source: "grok" as const };
    } catch {
      return { ok: true as const, report: buildFallbackReport(idea), source: "local" as const };
    }
  });
