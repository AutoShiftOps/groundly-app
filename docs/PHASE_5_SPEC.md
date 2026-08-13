# Phase 5: report structure, per-framework visual depth, citation relevance, loading-screen value

Written against `origin/main` @ `8f140da`. Four independent workstreams from live-testing feedback; can be built/reviewed in any order, but C is the highest-priority correctness issue (it produces visibly wrong-looking reports) and should go first regardless of the order below.

## A. Stop repeating the same global header on every framework tab

**Current structure** (`ReportView.jsx` `export default function ReportView`, ~L723–820): `activeFramework` defaults to the first framework and the sidebar switches between PESTEL/SWOT/TAM/BMC. But `VerdictBanner`, `MetricRow`, and `BusinessMetricRow` (~L812–814) render unconditionally above the framework panel regardless of which tab is active — so every single framework tab shows the identical verdict/4-metrics/5-cards block, and only the panel below it changes. Confirmed decision: **move this to a dedicated Overview tab instead of showing it on every framework page.**

- Add `"overview"` as a new nav entry in `SIDE_NAV` (~L44), positioned first/above the framework list — visually distinct from the framework tabs (e.g. a home/grid icon), not styled as just another framework.
- `activeFramework` state (~L725) defaults to `"overview"` on report load instead of `stats.frameworks[0]`.
- When `activeFramework === "overview"`: render `VerdictBanner`, `MetricRow`, `BusinessMetricRow` — this is now the *only* place these render. Overview is also a reasonable place to add short summary links into each framework tab (optional, nice-to-have, not required for this phase).
- When `activeFramework` is an actual framework key: render only that framework's own content — `MarketSizingPanel` (tam only) / `FrameworkBody`'s structured view, `FrameworkStrip` (Key Takeaway + Top Citations), sources panel. No verdict banner, no metric rows.
- Sidebar's active-state highlighting needs to handle `"overview"` as a selectable state alongside the framework keys (it already generically loops framework entries — extend the same active/click handling to the new overview entry rather than writing a parallel code path).

This directly fixes "each page has the same top middle section" — that block now renders exactly once per report, not once per tab.

## B. Per-framework visual enrichment: icons + layout, not photography

Confirmed direction: **icons per category + improved layout, not photos/illustrations** — this is a grounded-data report, stock imagery wouldn't represent real content and would undercut the "every number is real" discipline this whole project has held. Concretely, per component in `ReportView.jsx`:

- **`PestelBlocks`** (~L523): each of the 6 blocks (Political/Economic/Social/Technological/Environmental/Legal) currently has only a color-coded text label. Add a distinct `lucide-react` icon per category next to the label — e.g. `Landmark` (Political), `TrendingUp` (Economic), `Users` (Social), `Cpu` (Technological), `Leaf` (Environmental), `Scale` (Legal). Icon color matches the existing per-block color already assigned in `PESTEL_BLOCKS`.
- **`SwotGrid`** (~L543): 4 quadrants currently color-coded only. Add an icon per quadrant — e.g. `TrendingUp`/`Zap` (Strengths), `AlertTriangle` (Weaknesses), `Sparkles`/`Target` (Opportunities), `ShieldAlert` (Threats).
- **`BmcCanvas`** (~L575): 9 blocks currently plain text headers, no color or icon differentiation at all (unlike PESTEL/SWOT). Give each block both an icon and a distinguishing accent, not just the two-tier "operational vs financial" split that exists today — e.g. `Users` (Customer Segments), `Gift` (Value Propositions), `Truck` (Channels), `Heart` (Customer Relationships), `DollarSign` (Revenue Streams), `Boxes` (Key Resources), `Zap` (Key Activities), `Handshake` (Key Partners), `Receipt` (Cost Structure).
- Also improve empty-category visual weight: right now `StructuredItemList`'s "No grounded points for this category" (confirmed correct behavior, don't change the logic) renders identically muted regardless of category — fine to leave as-is, but consider slightly de-emphasizing the icon too (lower opacity) when a category is empty, so a report with many gaps doesn't look visually "full" of icons that don't actually have content behind them.

Icons only — no chart/graph additions in this phase (that was the alternative option, not the one chosen). Keep this scoped to iconography + layout polish.

## C. Fix citation relevance — EV-charging sources appearing in unrelated reports (highest priority)

This is the same root cause flagged after the render-redeploy round and never actually implemented — confirmed still present in `backend/routers/analysis.py`'s `build_query()` (~L49): `f"{framework.upper()} analysis for: {req.idea}"`, unchanged. Live-tested symptom: a "Solar panel based electric grid for villages" report cites `"[1] PESTEL: EV Charging Market"` and uses an EV-pricing citation to support a solar-market claim ("The decline in EV purchase prices... suggests that as solar technology becomes more affordable...") — a citation from a completely unrelated market being stretched via analogy to nominally satisfy the grounding rule. Technically each sentence has a `[N]` marker, so `verify_claims()` doesn't flag it, but a report about solar villages visibly citing EV-charging sources reads as broken regardless of the citation-count technicality.

Two changes needed together — neither alone fully fixes this:

1. **Fix the query itself** (was already speced, do it now): `build_query()`'s phrasing front-loads the framework name (`"PESTEL analysis for: ..."`), which biases both local embedding retrieval and the Tavily call toward generic framework-methodology content. Lead with the idea, treat the framework as context: e.g. `f"{req.idea} — {framework.upper()} analysis"` or pass the idea and framework as separate concerns to `search_and_ingest()` rather than one concatenated string, so Tavily's query is dominated by the actual topic. Verify with real calls (the standing discipline in this codebase) that this measurably improves result relevance for an off-corpus idea like the solar example — not just a plausible-sounding change, confirm it.

2. **Add a topic-relevance floor, separate from the existing similarity thresholds.** Today, `MIN_SIMILARITY` (0.35, SQL floor) and `LIVE_RETRIEVAL_TRIGGER_THRESHOLD` (0.5, triggers the Tavily fallback) both exist, but neither one stops a chunk that's *technically* above 0.35 similarity from being used as real context if Tavily's fallback also fails to find something better (`run_pipeline()`'s existing logic: if the live-retrieval refresh comes back empty, it falls through to using the original weak local matches — see the comment at `agents/rag_pipeline.py`'s `run_pipeline()`, "Otherwise chunks keeps whatever it already had"). That's exactly the path that put EV-charging content into a solar report's context. Recommend: when *none* of the retrieved chunks (local or freshly web-retrieved) clear a higher bar — e.g. reuse `LIVE_RETRIEVAL_TRIGGER_THRESHOLD`'s 0.5 as a hard floor for "usable as context" too, not just as a trigger for the web-retrieval attempt — fall through to "Insufficient grounded data available for this section" instead of generating with weak matches. This means a genuinely uncovered topic more often gets an honest "insufficient data" response instead of a technically-cited-but-visibly-wrong one. Verify this doesn't regress the bailout-rate work (the whole point of the rule-3 rewrite was fewer false "insufficient data" bailouts on topics that *do* have decent partial coverage) — test both the solar example (should now correctly bail) and the original EV-charging example (should NOT regress to bailing, since that one has genuinely relevant grounded data). This is a real tension between two prior fixes; don't ship without checking both directions.

## D. Loading screen: make the wait itself valuable, not just honest

Context: Phase 4's A1(b) fix correctly removed the fake "0 sources scanned" counter (it could never be real without backend streaming), but a blank animated-dots indicator alone doesn't serve the actual goal here — keeping someone engaged through a wait rather than dropping off. The existing "PRO TIP" card (`LoadingScreen.tsx`, bottom-right carousel, currently one static tip: *"TAM measures your total addressable market."*) is the right instinct but underbuilt — it's a single generic definition, not a reason to keep watching.

Recommend expanding this into the primary content strategy for the wait, since real-time progress streaming isn't in scope (would require the backend architecture change already discussed and declined for now):

- Expand the tip carousel from 1 static card to a real rotating set — framework explainers (what PESTEL/SWOT/TAM/BMC each actually tell you and why), what a strong vs. weak result looks like, what "grounded" means and why citations matter for trusting the output. This is copywriting/content work, not a data-wiring task — no backend dependency.
- Consider previewing report *structure* before the data arrives — e.g. a skeleton/ghost preview of the report layout (framework tabs, the shape of the Overview cards) so the user has a concrete sense of what they're waiting for, distinct from the abstract stage timeline (Ideating → Researching → Prototyping → Testing → Finalizing) that's already there and should stay.
- Keep this entirely honest per the Phase 4 A1 discipline — rotating educational content and a structural preview don't claim to be counting anything real, so they don't reintroduce the "looks patched" problem A1(b) fixed. Don't add any other numeric-looking claim to this screen without a real backend source for it.

This is lower technical risk than A/B/C (no schema or retrieval changes) but is genuinely a content-design task — if there's a specific set of tips/copy you want used, that shortens this significantly; otherwise a reasonable default set can be drafted and sent for review before wiring it in.

---

## Suggested order

1. **C** first — it's a correctness/trust problem visible in every off-corpus report, not a polish item.
2. **A** — structural, moderate effort, directly resolves the most concrete complaint ("duplicate").
3. **B** — icon/layout polish, no data dependencies, can happen in parallel with A if convenient.
4. **D** — content-design work, lowest technical risk, do last or in parallel; flag if you want to review/write the tip copy yourself before it's wired in rather than have it drafted.
