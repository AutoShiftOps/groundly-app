# Phase 4: bug fixes + closing the remaining mock-parity gap

Written against `origin/main` @ `c977131` (2026-08-13), after live testing post-redeploy. This is an addendum to `docs/BUSINESS_METRICS_SPEC.md` — Phases 1–3 are done and verified; this covers what live testing surfaced afterward.

## Part A — Bugs found during live testing

### A1. Loading-screen stat counters are structurally dead, not just slow

`frontend/src/App.tsx`: `sourceCount` is derived from `report` (`report ? ... : 0`), and `report` is `null` for the entire time `LoadingScreen` is mounted — the `/api/analyze` call is a single blocking request with no streaming, so there is no partial data to count while it's in flight. The instant `report` becomes non-null, `App.tsx` renders `ReportView` instead, so `LoadingScreen` never sees a non-zero `sourceCount`. **The "N sources scanned" / "N data points processed" stat tiles (`LoadingScreen.tsx` `StatsGrid`, ~L162–172) can mathematically never show anything but 0.** This isn't a race condition to fix with a loading delay — the data path itself has no source of truth to draw from mid-flight.

Two honest fixes, pick one:
- **(a) Real streaming** — backend change: convert `/api/analyze` to stream progress events (SSE or chunked) as each framework's `run_pipeline()` call resolves, and have the frontend update `sourceCount` incrementally. Bigger change, but makes the counter true.
- **(b) Stop implying it's live** — smaller change: replace the sourceCount-driven copy with an honest animated progress indicator that doesn't claim to count anything real (no "0 sources scanned, waiting for sources" text that never changes). Keep the existing stage timeline (`Ideating → Researching → Prototyping → Testing → Finalizing`), drop the fake live-counter framing.

Recommend (b) unless there's appetite for the backend streaming work — it's a straightforward swap and removes the "this looks patched" impression without a backend change.

### A2. "Test Market Snippet" placeholder polluting the live corpus

`agents/ingest.py`'s module docstring shows example CLI usage with a literal placeholder title:

```
python -m agents.ingest --file data/raw/test_market.txt \
    --title "Test Market Snippet" \
    --url "https://example.com/source" \
    --framework tam
```

That exact placeholder — `"Test Market Snippet"` — is showing up as a real citation in production reports (confirmed via a live TAM report: `[4] Test Market Snippet — 37%`). Someone ran the documented example verbatim instead of substituting real values, and it got permanently written into the shared production database (Supabase, per `render.yaml`'s comment). This isn't cosmetic: with only 6 total citation slots retrieved for that run, one junk placeholder occupies real budget — confirmed by checking `data/raw/tam_source.txt` directly, which explicitly states both SAM (~$330–670M) and SOM (~$8–15M ARR) figures that did NOT make it into that run's context, while the placeholder did.

Two things needed:
1. **Data cleanup**: identify and delete the placeholder row(s) from the production `sources` table (Supabase). Search by title/URL matching the docstring's example (`"Test Market Snippet"` / `"https://example.com/source"`).
2. **Process guard**: rewrite the docstring example so it can't be copy-pasted verbatim into something that looks like real data — e.g. `--title "EXAMPLE-DO-NOT-USE-real-source-title-here"` or add a runtime check in `agents/ingest.py` that warns/refuses if `--url` is literally `example.com`.

While fixing this, worth a one-time audit: query the `sources` table for any other suspiciously generic titles/URLs from testing that may have leaked in the same way.

### A3. Narrative prose reads flat ("normal data without life")

Not a bug, a tone note on `GROUNDING_SYSTEM_PROMPT` (`agents/rag_pipeline.py`). Current rules are entirely about grounding discipline (cite everything, don't fabricate, prefer partial answers) with no guidance on voice. Recommend adding one additional rule focused on register — something like: *"Write as a confident, specific business analyst, not a generic summary generator — lead sentences with the conclusion, not the setup; use concrete numbers over vague qualifiers where the CONTEXT supports them."* Keep this rule strictly about tone, not content — it must not weaken rules 1–4's grounding/no-fabrication requirements. Verify with a real before/after comparison on the same idea (same discipline as every other prompt change in this project) before calling it done, since tone changes can have unpredictable side effects on citation compliance.

---

## Part B — Closing the remaining gap vs. the EcoPack mock

Confirming scope: the mock you originally sent only depicted the **TAM SAM SOM tab** in detail — no SWOT/PESTEL/BMC mock exists. Phase 3 (already shipped) gave those three frameworks their own structured visual treatment (2×2 SWOT quadrants, 6-block PESTEL grid, 9-block BMC canvas) as best-effort parity with the mock's *spirit* — richer than plain paragraphs — but not a literal recreation of a mock that was never drawn for those frameworks. If you have (or can describe) a specific visual target for SWOT/PESTEL/BMC beyond what Phase 3 built, send it — I'll spec that as Phase 5 the same way. Until then, here's what's still a literal, checkable gap against the **TAM mock specifically**:

### B1. Market Sizing table is missing 2 of the mock's 4 columns

Mock table: `Metric | Value (USD) | % of Parent | CAGR (2024–2030) | Source`. Current implementation (`MarketSizingPanel`'s table, `ReportView.jsx` ~L440): `Label | Value | Source` only — no `% of Parent`, no `CAGR`.

- **`% of Parent`** is a derivable, non-fabricated number: `SAM / TAM` and `SOM / SAM`, computed frontend-side from `market_sizing`'s existing `value_usd` fields — no backend or prompt change needed, this is pure arithmetic on data that's already there. TAM's own row should show `—` (no parent tier).
- **`CAGR`** is different — it is NOT currently in `market_sizing`'s schema (`MARKET_SIZING_SCHEMA`, `agents/rag_pipeline.py`) at all, and it's not something you can derive from a single point-in-time TAM/SAM/SOM figure. This needs a real schema extension: add an optional `cagr_pct` (nullable) field per tier to `MARKET_SIZING_SCHEMA`, with an instruction to only populate it if the CONTEXT explicitly states a growth rate for that tier (same "null if not grounded" discipline as every other field here — don't let the model estimate a CAGR that isn't stated). Expect this to be null often, same as SAM/SOM already are — that's correct behavior, not a bug, when the source material doesn't state one.

### B2. Business-metric cards have no sparkline; mock's do

Already flagged as an open UI decision in the original spec (Phase 2 section, "Frontend"). Mock shows a small trend squiggle under each of the 5 cards. Since a single synthesized value has no real time series to plot (this isn't a repeated measurement), the only non-fabricated way to give these a spark visual is to reuse the same computed-evidence-score input (citation similarity) as a flat/near-flat spark, purely decorative — do not invent a fake trend that implies change over time that didn't happen. Lower priority than B1 and Part A; cosmetic only.

---

## Suggested order for this round

1. A2 (data cleanup) first — it's actively degrading every report's quality right now, including ones already shipped in earlier phases, and is a 10-minute DB fix.
2. A1(b) — quick, removes a visibly "fake" element from every single analysis run.
3. B1's `% of Parent` column — pure frontend arithmetic, no backend change, ships same day.
4. B1's `CAGR` field — small schema extension, same pattern as everything in Phase 1, needs the same "verify N/N real calls" discipline before calling it done.
5. A3 (tone pass) and B2 (sparklines) — lowest priority, cosmetic/subjective, do last if time allows this round.
