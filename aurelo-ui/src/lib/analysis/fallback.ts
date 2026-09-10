import type { AnalysisReport, Verdict } from "./types";

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset) % items.length] as T;
}

const VERDICTS: Verdict[] = ["promising", "strong", "risky", "promising"];

export function buildFallbackReport(idea: string): AnalysisReport {
  const seed = hashString(idea.trim().toLowerCase());
  const score = 58 + (seed % 31);
  const verdict = pick(VERDICTS, seed);
  const tamB = 6 + (seed % 24);
  const samB = Math.max(1, Math.round(tamB * 0.22 * 10) / 10);
  const somM = 80 + (seed % 260);
  const rawTitle = idea.split(/[—.–-]/)[0]?.trim() || "This idea";
  const title = rawTitle.length > 42 ? `${rawTitle.slice(0, 42).trim()}…` : rawTitle;

  const markets = [
    { code: "US", name: "United States", opportunity: 70 + (seed % 25) },
    { code: "UK", name: "United Kingdom", opportunity: 62 + (seed % 22) },
    { code: "IN", name: "India", opportunity: 55 + (seed % 28) },
    { code: "DE", name: "Germany", opportunity: 58 + (seed % 20) },
    { code: "CA", name: "Canada", opportunity: 54 + (seed % 18) },
    { code: "AU", name: "Australia", opportunity: 50 + (seed % 16) },
    { code: "SG", name: "Singapore", opportunity: 52 + (seed % 21) },
    { code: "AE", name: "UAE", opportunity: 48 + (seed % 19) },
    { code: "BR", name: "Brazil", opportunity: 44 + (seed % 17) },
  ].sort((a, b) => b.opportunity - a.opportunity);

  return {
    tagline: `${title.replace(/["']/g, "")} has a real job to do — if the wedge stays sharp.`,
    verdict,
    score,
    tam: `$${tamB}.${seed % 9}B`,
    sam: `$${samB}B`,
    som: `$${somM}M`,
    tamNote: `Estimated global spend around the category described in “${title.slice(0, 48)}”.`,
    markets,
    competitors: [
      {
        name: pick(
          ["Incumbent suites", "Spreadsheet + Slack", "Vertical SaaS leader", "Open-source stack"],
          seed,
          1,
        ),
        note: "Owns distribution, not the exact job-to-be-done.",
      },
      {
        name: pick(
          ["Generalist AI copilots", "Agency substitutes", "In-house ops docs", "Marketplace aggregators"],
          seed,
          2,
        ),
        note: "Cheap enough that switching costs have to be emotional, not just functional.",
      },
      {
        name: pick(
          ["Niche specialist", "New seed rival", "Platform widget", "Consultant overlay"],
          seed,
          3,
        ),
        note: "Close on features. Weak on taste, speed, or a founder-native workflow.",
      },
    ],
    strengths: [
      "The problem is already paid for in time, even if not in software.",
      "A sharp beachhead buyer is visible from the one-line pitch.",
      "AI can collapse research and drafting that used to take a team.",
    ],
    risks: [
      "Category language is crowded — without a wedge it reads like a feature.",
      "Data access and integrations will decide whether this feels magical or brittle.",
      "Incumbents can copy the demo faster than they can copy the taste.",
    ],
    nextSteps: [
      "Talk to 10 people who felt this pain in the last 30 days.",
      "Prototype the ‘aha’ screen, not the settings screen.",
      "Price a single seat for the person who feels the pain at 11pm.",
      "Pick one channel you can actually own for 90 days.",
    ],
    insights: [
      {
        title: "The idea is a job, not a category",
        body: `${title} wins if it removes a recurring, slightly humiliating task — not if it becomes a platform on slide 4.`,
      },
      {
        title: "Beachhead before TAM theater",
        body: "The top two markets already concentrate demand. Treat the rest as proof, not a launch plan.",
      },
      {
        title: "Distribution is the silent co-founder",
        body: "If the first 50 users cannot be named, the TAM number is decorative. Name them, then expand.",
      },
    ],
    proTips: [
      "TAM measures your total addressable market.",
      "SAM is who you can serve with today’s product and channels.",
      "SOM is the share you can win before the story changes.",
      "Interviews beat dashboards until you have twelve of them.",
    ],
  };
}
