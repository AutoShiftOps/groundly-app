# Spec: Business-Judgment Metrics & Structured Framework Rendering

Written against `origin/main` @ `c98b49a` (2026-08-12). Hand this to the implementing agent as-is — every reference below is to real code, not invented file names.

## Problem statement

The current report (`ReportView.jsx`) shows, per framework, only `{ text, citations }` rendered as a paragraph, plus one shared top row of **pipeline-health** metrics (`MetricRow`: Frameworks verified, Grounded sources, Avg source match, Unverified sections — all computed client-side from `verification`/`citations`, see lines 217–227).

The target mock (`report-ux-mock.jpg`, the "EcoPack" reference) additionally shows:

1. A row of 5 **business-judgment** cards: Market Size ($), Competitive Pressure, Best Customer Segment, Business Model Fit, Risk Flags — each with a qualitative label and a /10 score.
2. A TAM/SAM/SOM concentric-circle diagram + breakdown table.
3. The same "Methodology / Key Takeaway / Top Citations / structured visual" treatment applied to every framework, not just TAM.

Item 2 is **already built** in the frontend (`MarketSizingPanel`, `ReportView.jsx` ~L370–430) but silently no-ops whenever the model doesn't emit `[TAM]`/`[SAM]`/`[SOM]` tags with a parseable figure — which is often, because tagging compliance is prompt-only (see the existing code comment at `MarketSizingPanel`: *"verified 0/5 real calls actually followed it"* re: the abbreviated-unit rule — same failure mode applies to tag emission itself). Item 1 and item 3 do not exist anywhere in the backend's data model: `run_pipeline()` / `generate_with_citations()` (`agents/rag_pipeline.py`) only ever return grounded prose + a citation list, never a structured or scored field.

So this is three separable pieces of work, not one flag to flip. Recommended order below is chosen so each phase is shippable and testable on its own, and each phase's structured-output mechanism gets reused by the next.

---

## Phase 1 — Fix TAM tag reliability (unblocks the circle diagram that already exists)

**Root cause:** `TAM_TAGGING_INSTRUCTION` (`agents/rag_pipeline.py` L39–49) asks `gpt-4o-mini` to prefix figures with bracket tags inside free-form prose. Compliance is unverified/flaky by the repo's own admission. `MarketSizingPanel` then has to regex-recover structure from prose after the fact (`tagFigureRegex`, `parseMarketTiers`, `ReportView.jsx` L320–360) — a lossy, best-effort parse of something that should never have been unstructured in the first place.

**Fix:** when `framework_tag == "tam"`, stop asking for inline tags and instead request a structured sidecar via OpenAI's `response_format={"type": "json_schema", ...}` (or function-calling, whichever the installed `openai==1.56.1` SDK version supports cleanly — both do) **in addition to** the normal prose generation call. Two viable shapes:

- **Preferred:** single call, `response_format` = JSON schema with `{ "narrative": string, "market_sizing": { "tam": {value_usd, label, citation_index} | null, "sam": {...} | null, "som": {...} | null } }`. One round-trip, one cost, guaranteed-parseable structure.
- **Fallback if JSON mode fights with citation-marker prose:** keep the existing prose call, add a second lightweight structured-extraction call over the same context that returns `market_sizing` only. Costs one extra call per TAM section but keeps the prose path completely unchanged.

Either way, `generate_with_citations()`'s return shape gains an optional key:

```python
{
  "text": "...",
  "citations": [...],
  "market_sizing": {  # only present when framework_tag == "tam"; null if not stated
    "tam": {"value_usd": 68_300_000_000, "label": "$68.3B", "citation_index": 1},
    "sam": {"value_usd": 18_700_000_000, "label": "$18.7B", "citation_index": 2},
    "som": {"value_usd": 1_900_000_000, "label": "$1.9B", "citation_index": 3},
  } | None
}
```

`backend/routers/*.py`'s `analyze()` passes this through into `results[framework]` unchanged (it already forwards the whole `pipeline_output` dict — check the exact assignment at the `results[framework] = {...}` line, L63, and add `market_sizing` to that dict).

**Frontend change:** `MarketSizingPanel` swaps its regex-parse of `result.text` for a direct read of `result.market_sizing`; delete `parseMarketTiers`/`tagFigureRegex`/`UNIT_MULTIPLIER`/`MARKET_TIERS` once the new field is live (or keep them behind a fallback for one release if you want a soft cutover — but don't maintain both parsers long-term). `stripMarketTags()` also becomes dead code once the model stops emitting inline `[TAM]` markers in prose — but only remove it after confirming the new prompt truly drops them, since old cached/replayed responses may still contain them.

**Test:** re-run the same TAM query 10–20 times (matching the "two independent 20-call batches" discipline already used for the bailout-rate fix) and confirm `market_sizing` is non-null whenever the source text actually states a figure. This is the same regression class as the bailout-rate work — verify with real calls, not a single manual check.

---

## Phase 2 — The 5-card business-metrics row

**This is the one open product decision that actually matters, so read this section before implementing anything.**

### What the 5 cards can honestly represent

The mock's cards each pair a qualitative judgment ("Moderate", "Eco-conscious Millennials", "Strong") with a numeric `/10`. There are two fundamentally different things that number could mean, and the codebase has already picked a side for everything else in this report:

- **(a) Evidence-grounding strength** — "how well is this claim supported by the retrieved sources" — a *computed* number, same category as `stats.confidencePct` and `stats.avgSimilarity` today (`ReportView.jsx` L57–90), which are derived from citation count/similarity, never asked of the LLM.
- **(b) Subjective business-quality judgment** — "how strong is this business's competitive position, out of 10" — a number the *LLM would have to invent*, because no amount of grounding makes "6.2/10" a fact rather than an opinion.

Given the file's own governing comment (*"No fabricated numbers... every number shown is computed from report.results / report.verification"*, `ReportView.jsx` L12–14) and the `lastSentence()` comment about refusing to fabricate a summary field, **(a) is the only option consistent with how this codebase already treats numbers.** Recommendation: **the qualitative label/description is LLM-generated and grounded with a citation (same discipline as the rest of the report); the numeric meter is computed server- or client-side from real signals (citation count for that metric, average similarity, whether the underlying framework ran at all) — never asked of the model as a number.** This gets you the same visual language as the mock without crossing the line the rest of the report has held.

If you'd rather have the LLM's own confidence-in-its-answer as the number (still not a fabricated business score, just self-reported grounding confidence), that's a defensible middle ground — flag which you want before implementation starts, because it changes the schema below.

### Data model

None of the 5 cards map 1:1 onto a single framework — they're a synthesis across whichever frameworks were actually requested (`frameworks_allowed` in `AnalysisResponse`, `backend/routers/*.py` L31–32). A new synthesis step is required after the existing `asyncio.gather(*(run_pipeline(...) for framework in allowed))` call (L59) completes:

```python
# agents/synthesis.py (new file)
async def synthesize_business_metrics(idea: str, results: dict, allowed: list[str]) -> dict:
    """
    One additional grounded LLM call, fed the already-generated framework
    texts + their citations (no new retrieval — reuse what run_pipeline()
    already grounded, don't re-search). Returns a JSON-schema-constrained
    object, same reliability approach as Phase 1.
    """
```

Response addition to `AnalysisResponse`:

```python
business_metrics: dict[str, BusinessMetric | None]
# keys: market_size, competitive_pressure, customer_segment, business_model_fit, risk_flags

class BusinessMetric(BaseModel):
    label: str                 # e.g. "Moderate", "Eco-conscious Millennials"
    rationale: str              # 1-sentence grounded justification
    citation_index: int | None  # which numbered source backs it, if any
    source_framework: str       # which framework's results this was drawn from — surfaced in the UI so a claim never looks framework-agnostic when it isn't
    # score is NOT here if you take recommendation (a) above — compute it
    # frontend-side from citation_index/source_framework + that framework's
    # existing verification data, same pattern as stats.avgSimilarity.
```

**Missing-data rule (must implement, don't skip):** if a card's `source_framework` wasn't in `frameworks_allowed` for this request (e.g. user only ran TAM+SWOT, so there's no BMC data for "Business Model Fit"), that card must render a clear "Not enough data — run the BMC framework" state, never a guess. This is the same discipline as the existing `is_empty`/"Insufficient grounded data" path in `run_pipeline()` (L124–126) — reuse that pattern, don't invent a new one.

Suggested mapping (confirm/adjust against what each framework's prompt actually tends to produce):

| Card | Primary source framework | Fallback if unavailable |
|---|---|---|
| Market Size | `tam` (`market_sizing.tam` from Phase 1) | none — this card requires TAM |
| Competitive Pressure | `pestel` or a Porter's-style framework if later added | `swot` (Threats) |
| Best Customer Segment | `bmc` (Customer Segments block) | `swot` (Opportunities) |
| Business Model Fit | `bmc` | none |
| Risk Flags | `swot` (Weaknesses/Threats) | `pestel` |

### Frontend

New `BusinessMetricRow` component, 5-wide grid, sibling to (not necessarily replacing) the existing `MetricRow`. Reuse the existing `MetricCard` shape (`ReportView.jsx` L200-ish) for visual consistency — same card chrome, sparkline slot optional per card since a single synthesis value doesn't have a time series the way citation/similarity trends do (`useMetricTrends`, L96–121); either omit the sparkline for these 5 or repurpose it to show per-framework verification status as a small trend if you want visual parity with the mock — this is a UI-only decision, not a data one.

---

## Phase 3 — Structured/visual treatment for SWOT, PESTEL, BMC

Once Phase 1's structured-output pattern is proven on TAM, repeat it per framework instead of inline bracket-tag regex parsing (which is the same fragile pattern as the old TAM approach and shouldn't be extended, just replaced everywhere it appears). One `response_format` JSON schema per framework, added the same way `market_sizing` was added to `generate_with_citations()`'s return:

- **SWOT** → `{ strengths: [{text, citation_index}], weaknesses: [...], opportunities: [...], threats: [...] }`, frontend renders as a 2×2 quadrant grid instead of one paragraph.
- **PESTEL** → `{ political: [...], economic: [...], social: [...], technological: [...], environmental: [...], legal: [...] }`, frontend renders as 6 labeled blocks (this is the natural place to reuse `renderBoldText`'s existing "**Political:**" handling — the model already tends to emit that pattern per the code comment at L272–275, which is a sign PESTEL is the easiest of the three to migrate).
- **BMC** → the 9 canonical blocks (`customer_segments`, `value_propositions`, `channels`, `customer_relationships`, `revenue_streams`, `key_resources`, `key_activities`, `key_partners`, `cost_structure`), frontend renders as the standard Business Model Canvas 3×3-ish grid layout.

Each framework keeps its own `FrameworkStrip` (Key Takeaway + Top Citations, `ReportView.jsx` L293–318) unchanged — that part already works per-framework and doesn't need touching.

**Recommend doing these one framework at a time, in this order: PESTEL → SWOT → BMC** (easiest structured-output migration first, based on existing prompt behavior noted above; BMC last because its 9-block layout is the most frontend work).

---

## Decisions needed before implementation starts

1. **Score semantics for Phase 2** — computed evidence-strength (recommended) vs. LLM self-reported confidence vs. LLM business-quality judgment (not recommended, breaks the no-fabrication discipline). Pick one; it changes the schema.
2. **Scope for this round** — all 3 phases, or just Phase 1 (unblocks something already built) + Phase 2 (the actual visible ask)? Phase 3 is the largest chunk of net-new work.
3. **Missing-data behavior for Phase 2 cards** — confirm "Not enough data, run X framework" is acceptable UX rather than blocking the whole row until all 4 frameworks are requested.
4. **TAM parser cutover (Phase 1)** — OK to delete the existing bracket-tag regex parser once structured output is verified reliable, or keep it as a fallback for one release?
