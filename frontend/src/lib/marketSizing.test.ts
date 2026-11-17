import test from "node:test";
import assert from "node:assert/strict";
import {
  formatUsdCompact,
  inferSectorKeywords,
  normalizeMarketSizing,
  parseCurrencyStringToUsd,
} from "./marketSizing";

test("parseCurrencyStringToUsd parses compact currency notations accurately", () => {
  assert.equal(parseCurrencyStringToUsd("$18.6B"), 18_600_000_000);
  assert.equal(parseCurrencyStringToUsd("4.2 billion"), 4_200_000_000);
  assert.equal(parseCurrencyStringToUsd("$220M"), 220_000_000);
  assert.equal(parseCurrencyStringToUsd("$850K"), 850_000);
  assert.equal(parseCurrencyStringToUsd("Initial 5% Market Capture"), null);
});

test("normalizeMarketSizing repairs text labels and string CAGRs cleanly", () => {
  const normalized = normalizeMarketSizing({
    tam: {
      label: "Canadian Corporate Catering Market",
      value_usd: 4_800_000_000,
      cagr_pct: "5.2%" as unknown as number,
      note: "National corporate catering spend",
    },
    sam: {
      label: "$640M",
      cagr_pct: 6.5,
      note: "GTA corporate foodservice",
    },
    som: {
      label: "$24M",
      value_usd: 24_000_000,
      cagr_pct: 12,
      note: "3-year Mississauga and GTA corridor capture",
    },
  });

  assert.equal(normalized?.tam?.label, "$4.8B");
  assert.equal(normalized?.tam?.tier_description, "Canadian Corporate Catering Market");
  assert.equal(normalized?.tam?.cagr_pct, 5.2);
  assert.equal(normalized?.sam?.value_usd, 640_000_000);
  assert.equal(normalized?.som?.value_usd, 24_000_000);
  assert.equal(formatUsdCompact(24_000_000), "$24M");
});

test("inferSectorKeywords extracts catering and foodservice terms for Food Mamba", () => {
  const kw = inferSectorKeywords({
    businessName: "Food Mamba",
    idea: "Canada's all-in-one corporate catering and events platform",
  });
  assert.equal(kw.includes("CATER"), true);
  assert.equal(kw.includes("FOOD"), true);
});
