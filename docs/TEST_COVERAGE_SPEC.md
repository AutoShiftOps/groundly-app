# Follow-up: lock in what's been hand-verified as real, repeatable tests

Standalone from the sidebar work, per your instruction to send this separately. The goal here isn't introducing a new testing philosophy — it's making the verification discipline this whole project has already been run on (real API calls, real similarity numbers, real SSR renders, checked round after round rather than assumed) into something that runs automatically, so a future change can't silently regress any of it without a human catching it by hand again.

## What to cover, in priority order

### 1. `MIN_CONTEXT_SIMILARITY` calibration boundary (highest priority — this one has the most room to silently drift)

The 0.54 threshold in `agents/rag_pipeline.py` was calibrated against real retrieval data, not picked arbitrarily — it sits between the highest confirmed-bad case (0.53, the solar-village EV-charging leak) and the lowest confirmed-good case (0.5468, synth-rental PESTEL). This is exactly the kind of value that looks safe to "round" or "simplify" in a future refactor without realizing it reopens the original bug. Lock it in:

- A test asserting the solar-village-style off-topic case still correctly falls through to "Insufficient grounded data" (0 citations) against the real EV-charging seed corpus.
- A test asserting the EV-charging idea itself, across all 4 frameworks, still generates real content with real citations (similarity in the 0.70–0.81 range confirmed earlier) — this is the regression check that matters most, since it's easy to fix the bug and accidentally break the thing that was already working.
- If there's a stable way to test the synth-rental case without live Tavily calls in CI (e.g. a fixture capturing that retrieval), include it too — if not, at minimum document why it's excluded so it doesn't quietly disappear from the verification story.

### 2. Schema `null`-when-ungrounded discipline

This is the single rule this whole project has held most consistently: `cagr_pct`, `tier_description`, and the market-sizing tiers themselves must be `null` when the CONTEXT doesn't support them — never estimated, never a fallback default. Tests should assert the schema *shape* allows null (already true) and, more importantly, that the frontend never converts a `null` into a fabricated-looking display value anywhere it's consumed (`MarketSizingPanel`/`TamSizingCard`'s "No data found" states, the `% of Parent`/CAGR table cells showing "—"). A snapshot/fixture test feeding a partially-null `market_sizing` object through `TamSizingCard` and asserting the exact null-handling output would catch a future regression here immediately.

### 3. Overview tab gating logic

`isOverview` correctly suppresses `VerdictBanner`/`MetricRow`/`BusinessMetricRow` on every framework tab and shows them exactly once. Given how many rounds of frontend restructuring have already touched this file, this is a plausible place for a future change to accidentally reintroduce the duplicate-header bug it just took a whole round to fix. A render test asserting: (a) Overview shows the verdict/metrics block and `OverviewFrameworkLinks`, (b) each framework tab shows its own content and does NOT render the verdict/metrics block, (c) switching tabs correctly toggles both.

### 4. Locked/unlocked framework set

`FREE_FRAMEWORKS` (backend) and the sidebar's locked-placeholder list (frontend) both encode "PESTEL/SWOT/TAM/BMC are real, everything else is a placeholder." This just became an explicit product decision this round (deliberately not matching the mock's different lock pattern) — worth a test that asserts the two lists agree with each other (backend's actual gating vs. frontend's visual lock icons), since a mismatch there would mean either a real framework rendering as locked or a fake one rendering as available.

### 5. Data-hygiene guard (`REPLACE-WITH` marker)

`ingest_content()`'s refusal to ingest anything with the placeholder marker in title/url — this is cheap to test (call it with a title containing "REPLACE-WITH" and assert it raises) and it's exactly the kind of one-line guard that's easy to accidentally delete in an unrelated refactor without anyone noticing until pollution reappears in production months later.

## What NOT to over-invest in here

- Don't try to write deterministic tests around LLM output *content* (exact wording, exact tier descriptions) — that's inherently non-deterministic and tests should assert structure/discipline (citations present, nulls where expected, schema shape), not exact prose.
- Don't mock away the real API calls for the similarity-calibration tests in #1 if it can be avoided — a mocked embedding response can't actually catch a regression in the real threshold's correctness the way a real call can. If cost/speed makes a full real-API test suite impractical for every CI run, at minimum keep a smaller real-call suite that runs before anything gets merged to `main`, even if it's not on every commit.

## Verification expectation

Same standing discipline as every round before this one: report what was actually run (test suite passes/fails, not "should pass"), and if a test needed real API calls, say so explicitly rather than presenting a mocked pass as equivalent confidence.
