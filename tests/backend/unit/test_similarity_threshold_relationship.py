# docs/TEST_COVERAGE_SPEC.md #1 (fast/offline half): the relationship
# between LIVE_RETRIEVAL_TRIGGER_THRESHOLD and MIN_CONTEXT_SIMILARITY is
# exactly the kind of value that "looks safe to round or simplify" in a
# future refactor without realizing it reopens a real bug -- a previous
# round left LIVE_RETRIEVAL_TRIGGER_THRESHOLD (0.5) below
# MIN_CONTEXT_SIMILARITY (0.54), opening a dead zone: content in
# [0.50, 0.54) cleared the trigger bar (so web retrieval was never
# attempted) but still failed the usability floor (so it got discarded
# anyway) -- confirmed live on the original solar-village case (0.53
# similarity). Fixed by raising the trigger threshold to match the floor.
#
# This file locks in the STRUCTURAL invariant with fast, deterministic,
# offline tests (no API calls) -- the actual real-call verification that
# the calibrated *values* still correctly separate good/bad real cases
# lives in tests/backend/real_api/test_min_context_similarity_calibration.py,
# per the spec's "don't mock away the real calls" guidance for that part.
from unittest.mock import AsyncMock
import asyncio

from agents import rag_pipeline
from agents.rag_pipeline import LIVE_RETRIEVAL_TRIGGER_THRESHOLD, MIN_CONTEXT_SIMILARITY


def test_trigger_threshold_never_sits_below_the_usability_floor():
    # The actual dead-zone-closed invariant, expressed directly: if this
    # regresses back to trigger < floor, the gap reopens even if both
    # individual values still look individually "reasonable" in isolation.
    assert LIVE_RETRIEVAL_TRIGGER_THRESHOLD >= MIN_CONTEXT_SIMILARITY, (
        f"LIVE_RETRIEVAL_TRIGGER_THRESHOLD ({LIVE_RETRIEVAL_TRIGGER_THRESHOLD}) is below "
        f"MIN_CONTEXT_SIMILARITY ({MIN_CONTEXT_SIMILARITY}) -- this reopens the dead zone "
        f"where content in between clears the trigger bar (skips web retrieval) but still "
        f"fails the usability floor (gets discarded anyway), so the system bails without "
        f"ever trying the internet."
    )


def test_the_historical_bad_value_no_longer_falls_in_a_dead_zone():
    # Anchors the abstract relationship above to the actual real number
    # that exposed the bug (0.53, the solar-village/EV-charging leak) --
    # if this stops being true, it's not hypothetical anymore.
    historical_bad_value = 0.53
    in_dead_zone = historical_bad_value < LIVE_RETRIEVAL_TRIGGER_THRESHOLD and historical_bad_value < MIN_CONTEXT_SIMILARITY
    triggers_web_retrieval = historical_bad_value < LIVE_RETRIEVAL_TRIGGER_THRESHOLD
    assert triggers_web_retrieval, (
        "0.53 (the historical solar-village bad case) no longer clears "
        "LIVE_RETRIEVAL_TRIGGER_THRESHOLD -- web retrieval should be attempted for it."
    )


def test_local_similarity_at_historical_bad_value_triggers_web_retrieval_attempt(monkeypatch):
    # Exercises run_pipeline()'s actual control flow (not just the raw
    # constants) with a deterministic, mocked local-search result pinned
    # to the historical 0.53 case -- proves the *decision logic* reacts
    # correctly to that value, without hitting any real network. The
    # real-call suite separately proves the real system reproduces this
    # value organically; this proves what happens once it does.
    fake_chunk = {
        "chunk_text": "irrelevant EV-charging content",
        "source_title": "PESTEL: EV Charging Market",
        "source_url": "https://example.com/pestel-source",
        "similarity": 0.53,
        "confidence_score": 0.8,
    }

    search_calls = []

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        search_calls.append(framework_tag)
        # First call (initial local retrieval) returns the weak chunk;
        # any refresh call after a (mocked) web-retrieval attempt returns
        # nothing new, so run_pipeline falls through to its hard-floor
        # discard using the original weak chunk -- same as the real
        # "Tavily found nothing better" path.
        return [fake_chunk] if len(search_calls) == 1 else []

    web_retrieval_calls = []

    async def fake_search_and_ingest(query, framework_tag, max_results=3):
        web_retrieval_calls.append((query, framework_tag))
        return 0  # nothing ingested -- forces the hard-floor discard path below

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", fake_search_and_ingest)
    monkeypatch.setattr(
        rag_pipeline,
        "generate_with_citations",
        AsyncMock(return_value={"text": "Insufficient grounded data available for this section.", "citations": []}),
    )
    monkeypatch.setattr(rag_pipeline, "verify_claims", lambda text, citations: {"verified": False, "unsupported_claims": []})

    asyncio.run(rag_pipeline.run_pipeline("Solar panel based electric grid for villages", framework_tag="pestel"))

    assert web_retrieval_calls, (
        "web_retrieval.search_and_ingest was never called for a local best-similarity of "
        "0.53 -- the dead zone has reopened (this exact value used to clear the trigger "
        "bar outright and skip web retrieval entirely)."
    )


def test_local_similarity_comfortably_above_floor_does_not_need_web_retrieval(monkeypatch):
    # Mirror case: a genuinely strong local match (e.g. the synth-rental
    # case's 0.5468, or higher) should NOT trigger web retrieval -- the
    # trigger threshold moving up must not make the system over-eager
    # about calling out to Tavily when local grounding was already fine.
    fake_chunk = {
        "chunk_text": "genuinely relevant content",
        "source_title": "PESTEL: Synth Rental Market",
        "source_url": "https://example.com/synth-source",
        "similarity": 0.70,
        "confidence_score": 0.8,
    }

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        return [fake_chunk]

    web_retrieval_calls = []

    async def fake_search_and_ingest(query, framework_tag, max_results=3):
        web_retrieval_calls.append((query, framework_tag))
        return 0

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", fake_search_and_ingest)
    monkeypatch.setattr(
        rag_pipeline,
        "generate_with_citations",
        AsyncMock(return_value={"text": "Some grounded analysis [1].", "citations": [{"index": 1}]}),
    )
    monkeypatch.setattr(rag_pipeline, "verify_claims", lambda text, citations: {"verified": True, "unsupported_claims": []})

    asyncio.run(rag_pipeline.run_pipeline("a peer-to-peer synthesizer rental marketplace", framework_tag="pestel"))

    assert not web_retrieval_calls, (
        "web_retrieval.search_and_ingest was called even though local similarity (0.70) "
        "was already comfortably above both thresholds -- the system should not be "
        "over-eager about live web retrieval when local grounding is already good."
    )
