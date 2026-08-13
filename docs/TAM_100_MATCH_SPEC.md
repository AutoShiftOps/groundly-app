# TAM tab: 100% match to the EcoPack mock

Written against `origin/main` @ `8f140da`, additive to Phase 5's Part A (Overview tab move) — this only concerns the TAM tab's own content, unaffected by whether the global verdict/business-cards row lives on Overview or per-tab. Two assumptions made below where the mock implies a real product decision; both are marked so they're easy to override before implementation.

## Current structure vs. mock

Live TAM tab today is **two separate cards**: `MarketSizingPanel` (circles + legend + table) rendered above `FrameworkPanel` (its own header with "TAM" title/Verified pill/Methodology pill, a grounded narrative paragraph, then Key Takeaway + Top Citations). The mock is **one unified card**: icon + "TAM SAM SOM" title + subtitle + Methodology button, then circles/legend/table as the primary content, then Key Takeaway + Top Citations at the bottom of that same card — no narrative paragraph shown at all.

## Concrete deltas to close, in `ReportView.jsx`

1. **Merge into one card.** For `frameworkKey === "tam"` specifically, render a single unified component instead of `MarketSizingPanel` + `FrameworkPanel` stacked separately. Reuse `FrameworkPanel`'s existing header chrome (icon, Verified/Unverified pill, Methodology pill, subtitle) and `FrameworkStrip` (Key Takeaway + Top Citations) — those already match the mock's header/footer — just relocate the circles/legend/table to sit between them instead of the narrative paragraph. Non-TAM frameworks (PESTEL/SWOT/BMC) are untouched by this change.
2. **Card title becomes "TAM SAM SOM"** for this tab specifically, not just "TAM" — override `FRAMEWORK_LABELS.tam` display only in this merged header, or special-case the title string where it's rendered.
3. **Table header wording**: `"Value"` → `"Value (USD)"`, `"CAGR"` → `"CAGR"` with the year range shown only if it's real — see note below, don't hardcode "(2024–2030)" since that's specific to the mock's own scenario, not a general truth for every analysis run at every date.
4. **Table "Metric" column** shows both the abbreviation and full tier name (e.g. "TAM" + "Total Addressable Market" below it) instead of the abbreviation alone — the three full names (Total Addressable Market / Serviceable Available Market / Serviceable Obtainable Market) are static, standard-definition text, safe to hardcode per tier, no fabrication risk.

## Two assumptions made (flag if you want either changed)

**Narrative paragraph**: going with *keep it, but de-emphasized* rather than removing it outright — collapsed under the visual behind a small "Read full analysis" toggle rather than shown by default. Reasoning: matches the mock's visual hierarchy (circles/table are what you see first) without discarding the grounded reasoning this whole report is built to surface — the narrative is still where "why this number" lives, and this project's whole premise is not hiding the reasoning behind a number. If you'd rather match the mock exactly with zero paragraph on this tab at all, that's a one-line change (drop the toggle, don't render it) — just say so.

**Legend's 3rd description line**: going with *add a real grounded schema field* rather than skip it or fake-derive it from unrelated narrative text — extend `market_sizing`'s schema with an optional one-line description per tier (e.g. `"tier_description"`), same `null`-if-ungrounded discipline as `cagr_pct` from Phase 4, verified with real calls before shipping. This is a small, contained schema addition, consistent with everything else in this project, and avoids either fabricating a description or skipping something the mock clearly wants. If this feels like too much for a visual-parity pass, the cheaper fallback is dropping to a 2-line legend (abbreviation + full name only) — smallest-scope option, revisit later.

## Verification checklist for whoever implements this

- TAM tab, real call: confirm single merged card renders, title reads "TAM SAM SOM", Methodology pill present, circles+legend+table are the first thing visible.
- Confirm PESTEL/SWOT/BMC tabs are completely unaffected — this change is scoped to `frameworkKey === "tam"` only.
- If the schema addition (tier description) is built: verify N/N real calls the same way `cagr_pct` was verified, confirm `null` when ungrounded rather than a filled-in guess.
- Confirm the collapsed-narrative toggle (if kept) still shows the full grounded prose on demand — this shouldn't become inaccessible, just not the default view.
