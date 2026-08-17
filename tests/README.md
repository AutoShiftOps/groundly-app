# Test suite

Implements `docs/TEST_COVERAGE_SPEC.md`: locking in, as automated tests, the
verification discipline this project has otherwise been running by hand
each round (real API calls, real similarity numbers, real SSR renders) so
a future change can't silently regress any of it without a human catching
it manually again.

Two languages, two runners, kept deliberately separate:

```
tests/backend/unit/       pytest, fast, offline, no network         -- runs by default
tests/backend/real_api/   pytest, real OpenAI/Postgres/Tavily calls -- opt-in only
frontend/tests/           node (esbuild + react-dom/server SSR)     -- npm test
```

## Backend (pytest)

Setup (one-time, into the repo's `.venv`):

```
.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
```

`backend/requirements-dev.txt` is separate from `backend/requirements.txt`
on purpose -- pytest is a dev-only dependency, not something the running
app needs.

**Fast suite (default, runs on every `pytest` invocation):**

```
.venv/Scripts/python.exe -m pytest
```

No network calls, no API cost, ~2 seconds. Covers: the
`LIVE_RETRIEVAL_TRIGGER_THRESHOLD`/`MIN_CONTEXT_SIMILARITY` relationship
and boundary-triggering logic (mocked local search, real control flow),
`market_sizing` schema null-shape discipline, `FREE_FRAMEWORKS` vs. the
sidebar's locked-framework set, and the `ingest_content()` placeholder
guard. `pytest.ini`'s `testpaths` points only at `tests/backend/unit/` --
the real-API suite below is never picked up by a bare `pytest` run.

**Real-API suite (opt-in, run explicitly before merging to `main`):**

```
.venv/Scripts/python.exe -m pytest tests/backend/real_api -v
```

Hits real OpenAI (embeddings + chat completions), the real Postgres
corpus, and -- for the off-corpus case -- real Tavily web search. Costs
money and takes tens of seconds, not milliseconds. Per
`docs/TEST_COVERAGE_SPEC.md`'s explicit instruction, these are **not**
mocked: a mocked embedding response can't actually catch a regression in
a real similarity threshold's correctness the way a real call can.
Covers the EV-charging regression check (the one that matters most --
it's easy to fix a bug and accidentally break what was already working)
and the dead-zone-closed invariant on a live off-corpus query.

Requires `backend/.env` with a real `OPENAI_API_KEY` / `DATABASE_URL` (and
`TAVILY_API_KEY` for the off-corpus case) -- same file the app itself
uses.

## Frontend (SSR via esbuild + react-dom/server)

```
cd frontend && npm test
```

No browser or jsdom is available in this environment, so these are
SSR-only: each `frontend/tests/*.test.jsx` file renders `ReportView` with
`react-dom/server`'s `renderToStaticMarkup` against a hand-built fixture
report and asserts against the raw HTML string. `frontend/tests/run.mjs`
discovers every `*.test.jsx` file, bundles it with `esbuild` (a real
`devDependency` now, not just vite's transitive copy -- pinned in
`package.json`), runs it as a standalone Node script, and aggregates the
pass/fail results.

Because `react-dom/server` can't simulate a click, tests that need a
specific non-Overview tab active use a pre-generated copy of
`ReportView.jsx` with its `useState("overview")` default patched to the
tab under test (`frontend/tests/run.mjs` generates these into
`frontend/tests/.generated/` before bundling, and cleans them up
afterward -- never committed). If `ReportView.jsx` stops matching that
exact `useState("overview")` string, `run.mjs` fails loudly at the top of
the run rather than silently testing stale generated copies.

Covers: `TamSizingCard`'s null-when-ungrounded rendering (a partially-null
`market_sizing` fixture -- real values render as real values, `null`
fields render as `"No data found"` / `"—"`, never a fabricated `$0` or
`0%`), and the Overview tab's `isOverview` gating (verdict/metrics block
and `OverviewFrameworkLinks` show exactly once on Overview, never on a
framework tab, and vice versa).

## What's deliberately NOT tested here

Per `docs/TEST_COVERAGE_SPEC.md`'s own scope: no test asserts exact LLM
output *content* (exact wording, exact tier descriptions) -- that's
inherently non-deterministic. Tests assert structure and discipline
instead: citations present, nulls where expected, schema shape, gating
logic. The synth-rental live-Tavily case is intentionally excluded from
the real-API suite rather than silently dropped --
`tests/backend/real_api/test_min_context_similarity_calibration.py`'s
`test_synth_rental_case_documented_as_excluded_from_live_tavily_ci_run`
records why, and the one part of it that *is* deterministically
checkable (that raising `LIVE_RETRIEVAL_TRIGGER_THRESHOLD` can't affect
that case's outcome either way) is covered in the fast unit suite instead.

## Adding a test

- New backend behavior with no network dependency → `tests/backend/unit/`.
- New backend behavior that only a real call can actually verify (a
  calibrated threshold, real embedding similarity) →
  `tests/backend/real_api/`, marked `pytestmark = pytest.mark.real_api`.
- New frontend rendering/gating logic → `frontend/tests/*.test.jsx`,
  following the `check()`/`finish()` pattern in
  `frontend/tests/lib/ssr-assert.mjs`.
