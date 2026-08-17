# Follow-up to docs/TEST_COVERAGE_SPEC.md #1 and the
# LIVE_RETRIEVAL_TRIGGER_THRESHOLD dead-zone fix: MIN_CONTEXT_SIMILARITY
# used to only gate at the BATCH level -- once the single best chunk
# cleared the floor, every chunk in the list (including ones well below
# it) still reached the LLM as context together. agents/rag_pipeline.py's
# run_pipeline() now filters at the individual-chunk level too: the
# "is this topic covered at all" gate stays list-level (at least one real
# match required), but only chunks that themselves clear the floor are
# actually passed to generate_with_citations().
#
# test_similarity_threshold_relationship.py's existing tests only ever
# used single-chunk fixtures, so they couldn't have caught this -- they
# still pass unchanged (this is additive, not a replacement) but they
# don't exercise per-chunk filtering at all. This file specifically
# targets the multi-chunk, mixed-similarity case.
from unittest.mock import AsyncMock
import asyncio

from agents import rag_pipeline
from agents.rag_pipeline import MIN_CONTEXT_SIMILARITY


def _chunk(similarity, title):
    return {
        "chunk_text": f"content from {title}",
        "source_title": title,
        "source_url": f"https://example.com/{title}",
        "similarity": similarity,
        "confidence_score": 0.8,
    }


def _run_with_mocked_chunks(chunks, monkeypatch):
    captured = {}

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        return chunks

    async def fake_generate_with_citations(query, context_chunks, framework_tag=None):
        captured["context_chunks"] = context_chunks
        return {"text": "Some grounded analysis [1].", "citations": [{"index": i + 1} for i in range(len(context_chunks))]}

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline, "generate_with_citations", fake_generate_with_citations)
    monkeypatch.setattr(rag_pipeline, "verify_claims", lambda text, citations: {"verified": True, "unsupported_claims": []})
    # Not exercising the web-retrieval path in this file -- these fixtures
    # always have a chunk that clears LIVE_RETRIEVAL_TRIGGER_THRESHOLD, so
    # it's never invoked, but stub it defensively so a fixture change here
    # can't accidentally make a real network call.
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", AsyncMock(return_value=0))

    asyncio.run(rag_pipeline.run_pipeline("some query", framework_tag="pestel"))
    return captured.get("context_chunks")


def test_sub_floor_chunks_dropped_once_batch_gate_passes(monkeypatch):
    above1 = _chunk(0.70, "genuinely-relevant-1")
    above2 = _chunk(0.60, "genuinely-relevant-2")
    below = _chunk(0.40, "off-topic-leak")

    passed_chunks = _run_with_mocked_chunks([above1, above2, below], monkeypatch)

    passed_titles = {c["source_title"] for c in passed_chunks}
    assert passed_titles == {"genuinely-relevant-1", "genuinely-relevant-2"}, (
        f"Expected only the two above-floor chunks to reach generation, got: {passed_titles}"
    )
    assert all(c["similarity"] >= MIN_CONTEXT_SIMILARITY for c in passed_chunks)


def test_all_chunks_above_floor_are_unaffected(monkeypatch):
    # Filtering must not change anything when every chunk already clears
    # the floor -- no accidental over-filtering of legitimately good data.
    chunks = [_chunk(0.70, "a"), _chunk(0.65, "b"), _chunk(0.60, "c")]
    passed_chunks = _run_with_mocked_chunks(chunks, monkeypatch)
    assert len(passed_chunks) == 3


def test_single_strong_chunk_with_one_sub_floor_supporting_chunk(monkeypatch):
    # The edge case flagged in the fix request: a single strong match plus
    # one weaker supporting chunk. Confirms the current, simple policy
    # (hard filter at MIN_CONTEXT_SIMILARITY, no partial-credit "close
    # enough" band) -- if a real case surfaces where a sub-floor chunk was
    # adding genuine supporting value rather than noise, that's a product
    # question to revisit, not something this test should quietly paper
    # over by asserting a different behavior than what's actually shipped.
    strong = _chunk(0.75, "strong-primary-source")
    weak_support = _chunk(0.50, "weaker-supporting-detail")
    passed_chunks = _run_with_mocked_chunks([strong, weak_support], monkeypatch)
    assert [c["source_title"] for c in passed_chunks] == ["strong-primary-source"]


def test_boundary_chunk_exactly_at_floor_is_kept(monkeypatch):
    # >= not >: a chunk sitting exactly at MIN_CONTEXT_SIMILARITY is real,
    # usable context, not noise -- must not be dropped by an off-by-one on
    # the comparison operator.
    at_floor = _chunk(MIN_CONTEXT_SIMILARITY, "exactly-at-floor")
    passed_chunks = _run_with_mocked_chunks([at_floor], monkeypatch)
    assert [c["source_title"] for c in passed_chunks] == ["exactly-at-floor"]
