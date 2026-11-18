# PR #33 fix: a real directory hit (agents/mississauga_data.py) must
# never suppress the web-retrieval fallback. A directory citation (e.g.
# "this business is a registered food-service NAICS peer") says nothing
# about whether THIS framework's own topic is actually covered by local
# grounding -- TAM's dollar-figure question in particular is never
# answered by a business-directory listing. run_pipeline()'s empty/weak
# decision must stay local-similarity-only, exactly as on main; the
# directory context is purely additive to the generation context, never
# a reason to skip web_retrieval.search_and_ingest().
from unittest.mock import AsyncMock
import asyncio

from agents import rag_pipeline


def _directory_context_with_one_citation():
    return {
        "status": "found",
        "matched_count": 1,
        "total_sector_count": None,
        "exact_match": True,
        "context_snippet": "Matched 1 exact record.",
        "citations": [{
            "source_title": "2025 Mississauga Business Directory",
            "source_url": "https://services6.arcgis.com/x/FeatureServer/0/query",
            "snippet": "Food Mamba Catering is a registered NAICS 722320 caterer.",
            "similarity": None,
        }],
    }


def test_directory_hit_with_weak_local_chunks_still_triggers_web_retrieval(monkeypatch):
    weak_chunk = {
        "chunk_text": "irrelevant content",
        "source_title": "Unrelated",
        "source_url": "https://example.com/unrelated",
        "similarity": 0.4,  # below LIVE_RETRIEVAL_TRIGGER_THRESHOLD
        "confidence_score": 0.8,
    }

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        return [weak_chunk]

    web_retrieval_calls = []

    async def fake_search_and_ingest(query, framework_tag, max_results=3):
        web_retrieval_calls.append((query, framework_tag))
        return 0

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", fake_search_and_ingest)
    monkeypatch.setattr(
        rag_pipeline, "generate_with_citations",
        AsyncMock(return_value={"text": "x", "citations": [], "assumptions": [], "actions": []}),
    )
    monkeypatch.setattr(rag_pipeline, "verify_claims", lambda text, citations, extra_value=None: {"verified": False, "unsupported_claims": []})

    asyncio.run(rag_pipeline.run_pipeline(
        "Food Mamba Catering — TAM/SAM/SOM analysis",
        framework_tag="tam",
        directory_context=_directory_context_with_one_citation(),
    ))

    assert web_retrieval_calls, (
        "web_retrieval.search_and_ingest was never called even though local grounding was "
        "weak -- a directory hit must not suppress the web-retrieval fallback; it's additive "
        "context, not a substitute for actually checking whether THIS framework's topic "
        "(e.g. TAM's dollar figures) is covered."
    )


def test_directory_hit_with_empty_local_chunks_still_triggers_web_retrieval(monkeypatch):
    async def fake_search_similar_chunks(embedding, framework_tag=None):
        return []

    web_retrieval_calls = []

    async def fake_search_and_ingest(query, framework_tag, max_results=3):
        web_retrieval_calls.append((query, framework_tag))
        return 0

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", fake_search_and_ingest)
    monkeypatch.setattr(
        rag_pipeline, "generate_with_citations",
        AsyncMock(return_value={"text": "x", "citations": [], "assumptions": [], "actions": []}),
    )
    monkeypatch.setattr(rag_pipeline, "verify_claims", lambda text, citations, extra_value=None: {"verified": False, "unsupported_claims": []})

    asyncio.run(rag_pipeline.run_pipeline(
        "Food Mamba Catering — TAM/SAM/SOM analysis",
        framework_tag="tam",
        directory_context=_directory_context_with_one_citation(),
    ))

    assert web_retrieval_calls, (
        "web_retrieval.search_and_ingest was never called even though local grounding was "
        "completely empty -- a directory hit must not suppress the web-retrieval fallback."
    )


def test_directory_chunks_still_reach_generation_context(monkeypatch):
    # The additive half of the fix: even while web retrieval now always
    # runs when local grounding is empty/weak, the directory chunks must
    # still be passed through to generate_with_citations as real context
    # -- not discarded just because they no longer gate the decision.
    captured = {}

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        return []

    async def fake_generate_with_citations(query, context_chunks, framework_tag=None, extra_context_chunks=None):
        captured["extra_context_chunks"] = extra_context_chunks
        return {"text": "x", "citations": [], "assumptions": [], "actions": []}

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", AsyncMock(return_value=0))
    monkeypatch.setattr(rag_pipeline, "generate_with_citations", fake_generate_with_citations)
    monkeypatch.setattr(rag_pipeline, "verify_claims", lambda text, citations, extra_value=None: {"verified": False, "unsupported_claims": []})

    asyncio.run(rag_pipeline.run_pipeline(
        "Food Mamba Catering — TAM/SAM/SOM analysis",
        framework_tag="tam",
        directory_context=_directory_context_with_one_citation(),
    ))

    assert len(captured["extra_context_chunks"]) == 1
    assert "Food Mamba Catering" in captured["extra_context_chunks"][0]["chunk_text"]
