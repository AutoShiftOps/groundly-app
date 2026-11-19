# feature/live-progress: POST /api/analyze/stream sends real per-step
# progress as newline-delimited JSON, then the exact report /api/analyze
# returns. Pipeline, directory lookup, category classification and
# synthesis are mocked -- no network, no LLM.
from unittest.mock import AsyncMock
import asyncio
import json

import pytest

import routers.analysis as analysis_module
from agents import rag_pipeline
from routers.progress import STAGES, StageProgress

ALL_FRAMEWORKS = ["pestel", "swot", "tam", "bmc", "porter", "stp", "bcg", "value_chain", "balanced_scorecard", "ansoff"]
BODY = {"idea": "A quarterly tax app for Austin freelancers", "geography": "Austin, TX", "frameworks": ALL_FRAMEWORKS}

# Per-framework step delays chosen so frameworks finish out of order and
# some finish writing before others finish searching.
DELAYS = {fw: ((i * 7) % 5 * 0.004, (i * 3) % 4 * 0.004, (i * 5) % 3 * 0.004) for i, fw in enumerate(ALL_FRAMEWORKS)}


def _output(framework):
    return {
        "text": f"{framework} analysis [1].",
        "citations": [{"index": 1, "source_url": f"https://example.com/{framework}", "source_title": framework, "similarity": 0.8}],
        "assumptions": [f"{framework} assumption"],
        "actions": [f"{framework} action"],
        "verification": {"verified": True, "unsupported_claims": [], "provider_used": "openai",
                         "facts_total": 2, "facts_supported": 2, "analysis_count": 0},
    }


def _install(monkeypatch, fail_after=None):
    """fail_after=(framework, step): that framework raises right after
    reporting `step` (or before any step when step is None)."""
    seen = {}

    async def fake_run_pipeline(query, framework_tag=None, directory_context=None, idea=None, industry=None,
                                business_name=None, geography=None, market_category=None, on_progress=None):
        seen[framework_tag] = market_category
        for step, delay in zip(("searching", "writing", "checking"), DELAYS[framework_tag]):
            await asyncio.sleep(delay)
            if fail_after == (framework_tag, None) and step == "searching":
                raise RuntimeError("retrieval exploded")
            if on_progress:
                on_progress(step)
            if fail_after == (framework_tag, step):
                raise RuntimeError(f"{step} then exploded")
        return _output(framework_tag)

    async def fake_classify(idea, industry, business_name):
        await asyncio.sleep(0.01)
        return {"specific_category": "tax software for freelancers", "parent_category": "tax software", "provider_used": "openai"}

    monkeypatch.setattr(analysis_module, "run_pipeline", fake_run_pipeline)
    monkeypatch.setattr(analysis_module, "classify_market_category", fake_classify)
    monkeypatch.setattr(analysis_module, "synthesize_business_metrics", AsyncMock(return_value={
        k: None for k in ("market_size", "competitive_pressure", "customer_segment", "business_model_fit", "risk_flags")
    }))
    return seen


def _stream(api_client, body=BODY):
    with api_client.stream("POST", "/api/analyze/stream", json=body) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/x-ndjson")
        return [json.loads(line) for line in resp.iter_lines() if line]


def _stage_events(events):
    return [e for e in events if "stage" in e]


# --- StageProgress (ordering) -------------------------------------------------

def test_tracker_holds_later_stages_until_earlier_ones_finish():
    out = []
    p = StageProgress(total=2, emit=out.append)
    p.step_done("writing")          # framework A wrote before anyone finished searching
    p.step_done("searching")
    assert out == []                # reading isn't done yet: nothing may be sent
    p.stage_done("reading")
    assert out == [{"stage": "reading", "status": "done"}, {"stage": "searching", "done": 1, "total": 2}]
    p.step_done("searching")
    assert out[2:] == [
        {"stage": "searching", "done": 2, "total": 2},
        {"stage": "searching", "status": "done"},
        {"stage": "writing", "done": 1, "total": 2},   # held count released, not marked done
    ]
    p.step_done("checking")
    p.step_done("checking")
    assert {"stage": "writing", "status": "done"} not in out
    assert not any(e.get("stage") == "checking" for e in out)  # writing still 1/2


def test_tracker_rejects_unknown_stages():
    p = StageProgress(total=1, emit=lambda e: None)
    with pytest.raises(ValueError):
        p.step_done("reading")
    with pytest.raises(ValueError):
        p.stage_done("checking")


# --- run_pipeline reports each step once it really finished -------------------

def _mock_pipeline_internals(monkeypatch, generated_text="Some grounded analysis [1]."):
    async def fake_search(embedding, framework_tag=None):
        return [{"id": 1, "chunk_text": "c", "source_title": "t", "source_url": "https://e.com", "similarity": 0.7,
                 "confidence_score": 0.8}]

    async def fake_generate(query, context_chunks, framework_tag=None, extra_context_chunks=None,
                            specific_category=None, parent_category=None):
        return {"text": generated_text, "citations": [{"index": 1}]}

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search)
    monkeypatch.setattr(rag_pipeline, "generate_with_citations", fake_generate)
    monkeypatch.setattr(rag_pipeline, "verify_claims", AsyncMock(return_value={"verified": True, "unsupported_claims": [], "claims": []}))
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", AsyncMock(return_value=0))


def test_run_pipeline_reports_searching_writing_checking_in_order(monkeypatch):
    _mock_pipeline_internals(monkeypatch)
    steps = []
    asyncio.run(rag_pipeline.run_pipeline("q", framework_tag="pestel", on_progress=steps.append))
    assert steps == ["searching", "writing", "checking"]


def test_a_failed_generation_still_counts_as_an_attempted_writing_step(monkeypatch):
    _mock_pipeline_internals(monkeypatch, generated_text="Insufficient grounded data available for this section.")
    steps = []
    out = asyncio.run(rag_pipeline.run_pipeline("q", framework_tag="pestel", on_progress=steps.append))
    assert steps == ["searching", "writing", "checking"]
    assert out["text"].startswith("Insufficient grounded data")  # the real failed state is in the result


def test_run_pipeline_uses_a_precomputed_tam_category_without_reclassifying(monkeypatch):
    _mock_pipeline_internals(monkeypatch)
    monkeypatch.setattr(rag_pipeline, "_classify_tam_market_category",
                        AsyncMock(side_effect=AssertionError("must not classify again")))
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest_market_size",
                        AsyncMock(return_value={"total_chunks": 0, "queries_run": [], "url_to_query": {}}))
    category = {"specific_category": "x", "parent_category": "y", "provider_used": "openai"}
    asyncio.run(rag_pipeline.run_pipeline("q", framework_tag="tam", market_category=category))


# --- The endpoint --------------------------------------------------------------

def test_events_arrive_in_pipeline_order_with_counts_reaching_10(api_client, monkeypatch):
    _install(monkeypatch)
    events = _stream(api_client)
    stages = _stage_events(events)

    # Stage order never goes backwards.
    order = [STAGES.index(e["stage"]) for e in stages]
    assert order == sorted(order)
    assert stages[0] == {"stage": "reading", "status": "done"}
    assert stages[-1] == {"stage": "building", "status": "done"}

    for stage in ("searching", "writing", "checking"):
        counted = [e for e in stages if e["stage"] == stage]
        assert [e["done"] for e in counted[:-1]] == list(range(1, 11))
        assert all(e["total"] == 10 for e in counted[:-1])
        assert counted[-1] == {"stage": stage, "status": "done"}

    assert events[-1]["type"] == "result"
    assert not any(e.get("type") == "error" for e in events)


def test_final_report_is_exactly_the_analyze_response(api_client, monkeypatch):
    _install(monkeypatch)
    streamed = _stream(api_client)[-1]["report"]
    plain = api_client.post("/api/analyze", json=BODY).json()
    assert streamed == plain


def test_tam_gets_the_category_classified_during_reading(api_client, monkeypatch):
    seen = _install(monkeypatch)
    _stream(api_client)
    assert seen["tam"]["specific_category"] == "tax software for freelancers"
    assert all(seen[fw] is None for fw in ALL_FRAMEWORKS if fw != "tam")


def test_failure_sends_an_error_event_and_no_done_for_unfinished_steps(api_client, monkeypatch):
    _install(monkeypatch, fail_after=("bmc", "writing"))  # bmc wrote, then blew up before checking
    events = _stream(api_client)

    assert events[-1] == {"type": "error", "error": "Analysis service could not complete this request."}
    assert not any(e.get("type") == "result" for e in events)
    stages = _stage_events(events)
    assert {"stage": "checking", "status": "done"} not in stages
    assert {"stage": "building", "status": "done"} not in stages
    checking_counts = [e["done"] for e in stages if e["stage"] == "checking" and "done" in e]
    assert max(checking_counts, default=0) <= 9


def test_keepalive_lines_are_sent_while_the_pipeline_is_quiet(api_client, monkeypatch):
    _install(monkeypatch)
    monkeypatch.setattr(analysis_module, "STREAM_KEEPALIVE_SECONDS", 0.005)
    real = analysis_module.synthesize_business_metrics

    async def slow_synthesis(*args, **kwargs):
        await asyncio.sleep(0.05)
        return await real(*args, **kwargs)

    monkeypatch.setattr(analysis_module, "synthesize_business_metrics", slow_synthesis)
    events = _stream(api_client)
    assert {"type": "keepalive"} in events
    assert events[-1]["type"] == "result"


def test_rejected_request_is_a_plain_400_like_analyze(api_client, monkeypatch):
    _install(monkeypatch)
    resp = api_client.post("/api/analyze/stream", json={**BODY, "dataSourceUrl": "https://evil.example.com/x"})
    assert resp.status_code == 400
    assert "evil.example.com" in resp.json()["error"]
