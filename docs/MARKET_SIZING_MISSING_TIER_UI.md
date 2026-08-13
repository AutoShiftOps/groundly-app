# Follow-up: don't hide missing TAM/SAM/SOM tiers, mark them explicitly

Small, standalone addition — send alongside or after Phase 4, not part of it, since Phase 4 is already in progress. Frontend-only, no backend/schema change, no dependency on Phase 4's fixes.

## Problem

`MarketSizingPanel` (`frontend/src/components/ReportView.jsx`) currently drops any TAM/SAM/SOM tier that comes back `null` from `market_sizing` — `marketTiersFromApi()` does `.filter(Boolean)`, so a missing tier just silently doesn't appear. That's inconsistent with how the rest of this file already handles missing grounded data: `StructuredItemList` (the PESTEL/SWOT/BMC renderer) shows **"No grounded points for this category"** instead of hiding an empty category; the Phase 2 business-metric cards show an explicit **"Not enough data — run the X framework"** state instead of omitting a card. `MarketSizingPanel` should follow the same convention.

## Change

In `marketTiersFromApi()`:

- Stop filtering nulls out. Always return all 3 entries (`tam`, `sam`, `som`), each with a `present: true | false` flag — `present: true` plus real `value`/`displayValue`/`citationIndex` when the API returned that tier, `present: false` with no value when it didn't.

In the circle diagram (the `<svg>` block in `MarketSizingPanel`):

- Only compute a real radius and draw a solid circle for `present: true` tiers — there's no value to size a `present: false` tier by, and faking one would be fabricating a number this file has never fabricated anywhere else.
- For each `present: false` tier, draw a dashed/ghost ring at a fixed placeholder radius (doesn't need to be proportional to anything, it's explicitly not data) with a small "No data found" label near it — visually present in the diagram so its absence is obvious, not just missing from the picture entirely.

In the table below the diagram:

- Always render one row per tier, all 3, in order.
- For `present: false` rows: `Value` column shows "No data found" (muted/italic — reuse the same styling already applied to the "Insufficient grounded data available for this section" paragraph elsewhere in this file, so it reads as the same kind of empty state, not a new one), `Source` column shows "—".

## Why this matters

Right now a viewer has no way to tell "SAM wasn't stated in the sources" apart from "SAM doesn't apply to this business" apart from "something's broken" — they just see one circle and no explanation. An explicit "no data found" state removes that ambiguity without inventing any numbers, and it makes the report's honesty about grounding gaps visible instead of silent, which is the same discipline this file already applies everywhere else.
