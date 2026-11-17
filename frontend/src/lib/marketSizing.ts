import type { MarketSizing, MarketTier } from "../types/groundly";

export function parseCurrencyStringToUsd(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw !== "string") return null;

  const match = raw.match(
    /\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(trillion|billion|million|thousand|tn|bn|t|b|m|k)?\b/i,
  );
  if (!match) return null;

  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return null;

  const unit = (match[2] || "").toLowerCase();
  const mult =
    unit === "t" || unit === "tn" || unit === "trillion"
      ? 1_000_000_000_000
      : unit === "b" || unit === "bn" || unit === "billion"
        ? 1_000_000_000
        : unit === "m" || unit === "million"
          ? 1_000_000
          : unit === "k" || unit === "thousand"
            ? 1_000
            : 1;

  const val = base * mult;
  // Require a unit suffix OR substantial dollar value to avoid treating "5% market capture" as $5 USD
  if (mult === 1 && !raw.includes("$") && val < 10_000) {
    return null;
  }
  if (raw.includes("%") && mult === 1 && val < 1_000) {
    return null;
  }
  return val;
}

export function formatUsdCompact(usd: number | null | undefined): string | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  if (usd >= 1_000_000_000_000) {
    return `$${Number((usd / 1_000_000_000_000).toFixed(2))}T`;
  }
  if (usd >= 1_000_000_000) {
    return `$${Number((usd / 1_000_000_000).toFixed(1))}B`;
  }
  if (usd >= 1_000_000) {
    const decimals = usd >= 100_000_000 ? 0 : 1;
    return `$${Number((usd / 1_000_000).toFixed(decimals))}M`;
  }
  if (usd >= 1_000) {
    return `$${Math.round(usd / 1_000)}K`;
  }
  return `$${Math.round(usd)}`;
}

function parseNumericCagr(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^0-9.-]/g, "");
    const num = Number(cleaned);
    if (cleaned.length > 0 && Number.isFinite(num)) return num;
  }
  return null;
}

function hasCurrencyDisplay(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\$|\b\d+(?:\.\d+)?\s*(?:T|B|M|K|Bn|Mn)\b/i.test(text);
}

function normalizeTier(raw: MarketTier | null | undefined): MarketTier | null {
  if (!raw || typeof raw !== "object") return null;

  let usd =
    parseCurrencyStringToUsd(raw.value_usd) ??
    parseCurrencyStringToUsd(raw.value) ??
    parseCurrencyStringToUsd(raw.label) ??
    parseCurrencyStringToUsd(raw.note);

  let label = typeof raw.label === "string" ? raw.label.trim() : "";
  let tierDescription =
    typeof raw.tier_description === "string" ? raw.tier_description.trim() : "";

  if (!hasCurrencyDisplay(label)) {
    if (label && !tierDescription) {
      tierDescription = label;
    }
    const formatted = formatUsdCompact(usd);
    if (formatted) {
      label = formatted;
    }
  } else if (!usd) {
    usd = parseCurrencyStringToUsd(label);
  }

  const cagr = parseNumericCagr(raw.cagr_pct);

  return {
    ...raw,
    label: label || (formatUsdCompact(usd) ?? undefined),
    value: formatUsdCompact(usd) ?? (typeof raw.value === "string" ? raw.value : undefined),
    value_usd: usd,
    cagr_pct: cagr,
    tier_description: tierDescription || undefined,
  };
}

export function normalizeMarketSizing(
  sizing: MarketSizing | null | undefined,
): MarketSizing | null | undefined {
  if (!sizing || typeof sizing !== "object") return sizing;
  const tam = normalizeTier(sizing.tam);
  const sam = normalizeTier(sizing.sam);
  const som = normalizeTier(sizing.som);

  // Previously, if SAM/SOM came back larger than their parent tier (which
  // can legitimately happen with noisy LLM-extracted figures), this
  // silently overwrote the real backend numbers with an invented 25%-of-
  // TAM / 10%-of-SAM guess and re-labeled them as if still the model's
  // own output. Removed: these are real, cited figures -- display them
  // as returned rather than substituting a fabricated ratio.

  return { tam, sam, som };
}

const SECTOR_MAP: Array<{ pattern: RegExp; terms: string[] }> = [
  {
    pattern: /\b(food|cater|restaurant|cafe|coffee|bakery|meal|kitchen|culinary|dining|bistro|hospitality|event)\b/i,
    terms: ["CATER", "FOOD", "RESTAURANT"],
  },
  {
    pattern: /\b(health|physio|clinic|dental|medical|pharma|wellness|therapy|chiro|fitness)\b/i,
    terms: ["HEALTH", "CLINIC", "MEDICAL"],
  },
  {
    pattern: /\b(software|saas|tech|ai|cloud|fintech|data|platform|digital|it|cyber|app)\b/i,
    terms: ["SOFTWARE", "COMPUTER", "TECHNOLOGY", "CONSULTING"],
  },
  {
    pattern: /\b(logistics|freight|truck|shipping|courier|warehouse|supply|delivery|transport)\b/i,
    terms: ["FREIGHT", "TRANSPORT", "WAREHOUS", "COURIER"],
  },
  {
    pattern: /\b(retail|ecommerce|shop|store|apparel|fashion|grocery|supermarket)\b/i,
    terms: ["RETAIL", "STORE", "GROCERY"],
  },
  {
    pattern: /\b(construct|contractor|plumbing|hvac|electrical|engineering|architect)\b/i,
    terms: ["CONSTRUCT", "CONTRACT", "ENGINEER"],
  },
];

export function inferSectorKeywords(params: {
  businessName?: string;
  idea?: string;
  industry?: string;
}): string[] {
  const combined = [params.industry, params.idea, params.businessName]
    .filter(Boolean)
    .join(" ");
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of SECTOR_MAP) {
    if (entry.pattern.test(combined)) {
      for (const term of entry.terms) {
        if (!seen.has(term)) {
          seen.add(term);
          out.push(term);
        }
      }
    }
  }

  if (out.length === 0) {
    const tokens = combined
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim().toUpperCase())
      .filter(
        (w) =>
          w.length >= 4 &&
          !["CANADA", "MISSISSAUGA", "ONTARIO", "BUSINESS", "PLATFORM", "COMPANY", "CORP"].includes(
            w,
          ),
      );
    for (const tok of tokens.slice(0, 3)) {
      if (!seen.has(tok)) {
        seen.add(tok);
        out.push(tok);
      }
    }
  }

  return out.slice(0, 4);
}
