# docs/TEST_COVERAGE_SPEC.md #1 (real-call half). NOT run by a bare
# `pytest` invocation (see pytest.ini's testpaths + tests/README.md) --
# invoke explicitly with:
#
#   pytest tests/backend/real_api -m real_api -v
#
# These hit real OpenAI (embeddings + chat completions), the real Postgres
# corpus, and -- for the off-corpus case -- real Tavily web search. Costs
# money and takes noticeably longer than the unit suite. Per the spec's
# explicit instruction, these are NOT mocked: a mocked embedding response
# can't actually catch a regression in the real threshold's correctness
# the way a real call can.
import logging

import pytest

pytestmark = pytest.mark.real_api


def test_ev_charging_regression_all_four_frameworks_still_ground(api_client):
    # The regression check that matters most (spec's own words): it's easy
    # to fix the dead-zone bug and accidentally break the thing that was
    # already working. The EV-charging seed corpus is real, pre-existing
    # data (BMC/PESTEL/SWOT/TAM: EV Charging Market/Startup) -- this must
    # keep producing real grounded content with real citations across all
    # four frameworks.
    resp = api_client.post(
        "/api/analyze",
        json={"idea": "an EV charging network startup", "frameworks": ["pestel", "swot", "tam", "bmc"], "tier": "free"},
    )
    assert resp.status_code == 200
    data = resp.json()

    for framework in ("pestel", "swot", "tam", "bmc"):
        result = data["results"][framework]
        assert result["text"].strip() != "Insufficient grounded data available for this section.", (
            f"{framework}: EV-charging idea unexpectedly produced no grounded content -- regression."
        )
        assert len(result["citations"]) > 0, f"{framework}: expected real citations, got none."
        # Every citation must itself be a real, attributable source, not a
        # placeholder -- same discipline as the ingest guard test.
        for citation in result["citations"]:
            assert citation["similarity"] is not None
            assert 0.0 <= citation["similarity"] <= 1.0


def test_off_corpus_idea_never_bails_without_a_real_attempt(api_client, caplog):
    # The dead-zone-closed invariant, expressed as an observable outcome
    # rather than a fixed citation count: a query landing in the old dead
    # zone must not be able to silently discard-and-bail without the
    # system having genuinely tried live web retrieval first. Either
    # outcome below is correct; the only wrong one is neither happening.
    #
    # Deliberately not asserting "exactly 0 citations" here (that was the
    # spec's original wording, written before this round's fix) -- once
    # the dead zone is closed, a case like this can legitimately end up
    # WITH real grounded content if Tavily finds genuinely relevant
    # sources, which is the fix working as intended, not a regression.
    caplog.set_level(logging.INFO, logger="agents.rag_pipeline")
    resp = api_client.post(
        "/api/analyze",
        json={"idea": "Solar panel based electric grid for villages", "frameworks": ["pestel"], "tier": "free"},
    )
    assert resp.status_code == 200
    result = resp.json()["results"]["pestel"]

    attempted_web_retrieval = any(
        "invoking live web-retrieval fallback" in record.message for record in caplog.records
    )
    bailed_to_insufficient = result["text"].strip() == "Insufficient grounded data available for this section."
    produced_real_content = len(result["citations"]) > 0

    assert attempted_web_retrieval or produced_real_content, (
        "Off-corpus idea neither triggered a web-retrieval attempt nor produced grounded "
        "content from strong-enough local matches -- this is the dead-zone bug: local "
        "retrieval was weak enough to eventually get discarded, but never actually tried "
        "the internet first."
    )
    if bailed_to_insufficient:
        assert attempted_web_retrieval, (
            "Result was 'Insufficient grounded data' but no web-retrieval attempt was "
            "logged -- it bailed without ever trying, which is exactly the dead-zone bug "
            "this fix closed."
        )


def test_synth_rental_case_documented_as_excluded_from_live_tavily_ci_run():
    # Per docs/TEST_COVERAGE_SPEC.md #1's own instruction: "If there's a
    # stable way to test the synth-rental case without live Tavily calls
    # in CI... if not, at minimum document why it's excluded so it doesn't
    # quietly disappear from the verification story."
    #
    # Excluded here because: the synth-rental case's calibration value
    # (0.5468) was itself only produced by a prior *live* Tavily fallback
    # run against real, non-reproducible-on-demand web search results --
    # there's no stable local fixture to replay it against without either
    # (a) making it a live Tavily call every run (flaky, slow, and not
    # meaningfully different from a fresh solar-village-style run), or
    # (b) hand-fabricating a "recorded" similarity number, which would
    # defeat the entire point of a real-call test. The threshold
    # RELATIONSHIP that mattered for this case (0.5468 sits comfortably
    # above both LIVE_RETRIEVAL_TRIGGER_THRESHOLD and MIN_CONTEXT_SIMILARITY,
    # so raising the trigger threshold to 0.54 cannot change its outcome
    # either way) is covered analytically and deterministically instead,
    # in tests/backend/unit/test_similarity_threshold_relationship.py's
    # test_local_similarity_comfortably_above_floor_does_not_need_web_retrieval.
    assert True
