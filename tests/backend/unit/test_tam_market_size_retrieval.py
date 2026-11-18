# TAM market-size retrieval improvement: TAM gets dedicated
# "<category> market size <country> USD" / "<category> market size
# North America" Tavily queries instead of the generic analysis query
# (which almost never surfaces real market-size figures -- confirmed
# live for a Mississauga catering-subscription idea: 3 generic-query
# results, best similarity 0.486, below the 0.54 floor). Covers:
# - TAM uses the market-size queries (not the generic query string)
# - the call cap holds (at most 2 Tavily calls, mocked via
#   web_retrieval.search_and_ingest_market_size itself -- see that
#   function's own cap logic for the "stop after first success" test)
# - a narrowed/estimated SAM or SOM never carries a citation_index
from unittest.mock import AsyncMock
import asyncio

from agents import rag_pipeline
from agents import web_retrieval


def _fake_verify_claims(text, citations, extra_value=None):
    return {"verified": False, "unsupported_claims": []}


def test_market_size_query_embedding_used_for_reranking_not_the_original_query(monkeypatch):
    # The actual bug: re-searching with the ORIGINAL generic query's
    # embedding ranks newly-ingested market-size chunks against a
    # different question than the one that found them, so they never
    # win against whatever generic content already scored decently --
    # confirmed live twice (best similarity identical before/after
    # ingestion both times). Each market-size query that ran must get
    # its OWN embedding and its OWN database search.
    GENERIC_EMBEDDING = [1.0, 0.0, 0.0]
    MARKET_SIZE_EMBEDDING = [0.0, 1.0, 0.0]

    GENERIC_CHUNK = {
        "id": 1, "chunk_text": "What is TAM SAM SOM? A generic explainer of the three terms.",
        "source_url": "https://example.com/generic-explainer", "source_title": "Generic Explainer",
        "similarity": 0.4861, "confidence_score": 0.8,
    }
    MARKET_SIZE_CHUNK = {
        "id": 99, "chunk_text": "Canada's catering services market is valued at $4.8B in 2025.",
        "source_url": "https://example.com/market-size-article", "source_title": "Market Size Report",
        "similarity": 0.81, "confidence_score": 0.8,
    }

    async def fake_embed_query(text):
        return MARKET_SIZE_EMBEDDING if "market size" in text else GENERIC_EMBEDDING

    search_calls = []

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        search_calls.append(embedding)
        if embedding == MARKET_SIZE_EMBEDDING:
            return [MARKET_SIZE_CHUNK]
        return [GENERIC_CHUNK]

    async def fake_search_and_ingest_market_size(category, country, framework_tag="tam", max_results=5):
        q = f"{category} market size {country} USD"
        return {"total_chunks": 1, "queries_run": [q], "url_to_query": {MARKET_SIZE_CHUNK["source_url"]: q}}

    captured = {}

    async def fake_generate_with_citations(query, context_chunks, framework_tag=None, extra_context_chunks=None):
        captured["context_chunks"] = context_chunks
        return {"text": "x", "citations": [], "assumptions": [], "actions": []}

    monkeypatch.setattr(rag_pipeline, "embed_query", fake_embed_query)
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest_market_size", fake_search_and_ingest_market_size)
    monkeypatch.setattr(rag_pipeline, "generate_with_citations", fake_generate_with_citations)
    monkeypatch.setattr(rag_pipeline, "verify_claims", _fake_verify_claims)

    asyncio.run(rag_pipeline.run_pipeline(
        "A subscription service for home caterers — TAM/SAM/SOM analysis | geography: Mississauga, ON, Canada",
        framework_tag="tam",
        idea="A subscription service that delivers pre-portioned food kits for home caterers",
        geography="Mississauga, ON, Canada",
    ))

    # The buggy version only ever calls _search_similar_chunks with
    # GENERIC_EMBEDDING (the market-size query's own embedding is never
    # computed/searched) -- so the fix must show the market-size
    # embedding was actually used for a real database search.
    assert MARKET_SIZE_EMBEDDING in search_calls, (
        "the market-size query's own embedding was never used to search the database -- "
        "newly-ingested market-size chunks can only be found by ranking them against the "
        "question that actually found them, not the original generic analysis query."
    )

    final_urls = [c.get("source_url") for c in captured["context_chunks"]]
    assert MARKET_SIZE_CHUNK["source_url"] in final_urls, (
        "the high-similarity market-size chunk (0.81) should have won the merge and reached "
        "generation -- it was lost because it was only ever ranked against the wrong query."
    )


def test_tam_uses_dedicated_market_size_queries_not_the_generic_query(monkeypatch):
    captured = {}

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        return []  # empty local grounding -- forces the web-retrieval path

    async def fake_search_and_ingest_market_size(category, country, framework_tag="tam", max_results=5):
        captured["category"] = category
        captured["country"] = country
        captured["max_results"] = max_results
        return {"total_chunks": 0, "queries_run": [f"{category} market size {country} USD"], "url_to_query": {}}

    search_and_ingest_calls = []

    async def fake_search_and_ingest(query, framework_tag, max_results=3):
        # The OLD generic path -- must never be called for tam.
        search_and_ingest_calls.append(query)
        return 0

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest_market_size", fake_search_and_ingest_market_size)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", fake_search_and_ingest)
    monkeypatch.setattr(
        rag_pipeline, "generate_with_citations",
        AsyncMock(return_value={"text": "x", "citations": [], "assumptions": [], "actions": []}),
    )
    monkeypatch.setattr(rag_pipeline, "verify_claims", _fake_verify_claims)

    asyncio.run(rag_pipeline.run_pipeline(
        "A subscription service for home caterers — TAM/SAM/SOM analysis | geography: Mississauga, ON, Canada",
        framework_tag="tam",
        idea="A subscription service that delivers pre-portioned food kits for home caterers",
        industry=None,
        business_name=None,
        geography="Mississauga, ON, Canada",
    ))

    assert not search_and_ingest_calls, "TAM must never fall back to the generic search_and_ingest query path"
    assert captured["category"] == "catering services"
    assert captured["country"] == "Canada"
    assert captured["max_results"] == 5


def test_non_tam_framework_still_uses_the_generic_query_path(monkeypatch):
    # Confirms the branch is TAM-specific, not a blanket change to every
    # framework's web-retrieval behavior.
    market_size_calls = []
    generic_calls = []

    async def fake_search_similar_chunks(embedding, framework_tag=None):
        return []

    async def fake_search_and_ingest_market_size(category, country, framework_tag="tam", max_results=5):
        market_size_calls.append((category, country))
        return {"total_chunks": 0, "queries_run": [], "url_to_query": {}}

    async def fake_search_and_ingest(query, framework_tag, max_results=3):
        generic_calls.append(query)
        return 0

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "_search_similar_chunks", fake_search_similar_chunks)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest_market_size", fake_search_and_ingest_market_size)
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", fake_search_and_ingest)
    monkeypatch.setattr(
        rag_pipeline, "generate_with_citations",
        AsyncMock(return_value={"text": "x", "citations": [], "assumptions": [], "actions": []}),
    )
    monkeypatch.setattr(rag_pipeline, "verify_claims", _fake_verify_claims)

    asyncio.run(rag_pipeline.run_pipeline(
        "A subscription service for home caterers — PESTEL analysis",
        framework_tag="pestel",
        idea="A subscription service for home caterers", geography="Mississauga, ON, Canada",
    ))

    assert not market_size_calls, "only tam should use the dedicated market-size query path"
    assert generic_calls == ["A subscription service for home caterers — PESTEL analysis"]


def test_market_size_search_stops_after_first_successful_query():
    # web_retrieval.search_and_ingest_market_size's own cap: at most 2
    # Tavily calls, but it should stop after the FIRST one if that
    # already found something to ingest (saves the second call).
    call_log = []

    async def fake_run_single_search(query, framework_tag, max_results):
        call_log.append(query)
        if "North America" not in query:
            return 3, 2, ["https://example.com/a", "https://example.com/b"]
        return 0, 0, []

    import agents.config as config_module
    old_key = config_module.TAVILY_API_KEY
    config_module.TAVILY_API_KEY = "fake-key-for-test"
    try:
        import agents.web_retrieval as wr_module
        orig = wr_module._run_single_search
        wr_module._run_single_search = fake_run_single_search
        try:
            result = asyncio.run(web_retrieval.search_and_ingest_market_size("catering services", "Canada", "tam"))
        finally:
            wr_module._run_single_search = orig
    finally:
        config_module.TAVILY_API_KEY = old_key

    assert len(call_log) == 1, f"expected exactly 1 Tavily call (stopped after success), got {call_log}"
    assert call_log[0] == "catering services market size Canada USD"
    assert result["total_chunks"] == 2


def test_market_size_search_tries_second_query_only_if_first_finds_nothing():
    call_log = []

    async def fake_run_single_search(query, framework_tag, max_results):
        call_log.append(query)
        return 0, 0, []

    import agents.config as config_module
    old_key = config_module.TAVILY_API_KEY
    config_module.TAVILY_API_KEY = "fake-key-for-test"
    try:
        import agents.web_retrieval as wr_module
        orig = wr_module._run_single_search
        wr_module._run_single_search = fake_run_single_search
        try:
            result = asyncio.run(web_retrieval.search_and_ingest_market_size("catering services", "Canada", "tam"))
        finally:
            wr_module._run_single_search = orig
    finally:
        config_module.TAVILY_API_KEY = old_key

    assert call_log == [
        "catering services market size Canada USD",
        "catering services market size North America",
    ]
    assert len(call_log) <= web_retrieval.MARKET_SIZE_MAX_CALLS
    assert result["total_chunks"] == 0


def test_narrowed_sam_estimate_never_carries_a_citation_index():
    # The deterministic backstop: a tier the model labeled as an
    # "estimate" (per TAM_STRUCTURED_SUFFIX's narrowing rule) must never
    # also keep a citation_index, regardless of what the model actually
    # returned -- never attribute a derived/scaled number to the broader
    # source it was scaled from.
    market_sizing = {
        "tam": {"value_usd": 4_800_000_000, "label": "$4.8B", "citation_index": 1,
                "cagr_pct": 5.2, "tier_description": "Canada catering services market, 2025"},
        "sam": {"value_usd": 48_000_000, "label": "$48M", "citation_index": 1,
                "cagr_pct": None, "tier_description": "Mississauga SAM estimate, scaled from national figure"},
        "som": None,
    }
    context_chunks = [{"chunk_text": "Canada's catering services market is valued at $4.8B in 2025, growing at 5.2% CAGR."}]

    result = rag_pipeline._null_out_unsupported_tam_tiers(market_sizing, context_chunks)

    assert result["tam"]["citation_index"] == 1, "TAM itself (the real, directly sourced figure) keeps its citation"
    assert result["sam"]["value_usd"] == 48_000_000, "the estimate's dollar value is preserved"
    assert result["sam"]["citation_index"] is None, (
        "a SAM tier labeled as an 'estimate' must never carry a citation_index, even if the "
        "model returned one -- it would misattribute a derived/scaled number to the broader "
        "source it was scaled from"
    )
    assert result["som"] == rag_pipeline._TIER_NOT_FOUND


def test_unlabeled_sam_with_real_numeric_citation_keeps_its_citation_index():
    # Contrast case: a SAM tier that is NOT labeled as an estimate, and
    # whose citation really does contain a numeric market figure, must
    # keep its citation_index -- the backstop only strips it for
    # estimate-labeled tiers, never as a blanket rule.
    market_sizing = {
        "tam": {"value_usd": 4_800_000_000, "label": "$4.8B", "citation_index": 1,
                "cagr_pct": None, "tier_description": "Canada catering services market, 2025"},
        "sam": {"value_usd": 640_000_000, "label": "$640M", "citation_index": 2,
                "cagr_pct": None, "tier_description": "GTA corporate foodservice market, 2025"},
        "som": None,
    }
    context_chunks = [
        {"chunk_text": "Canada's catering services market is valued at $4.8B in 2025."},
        {"chunk_text": "The GTA corporate foodservice market is valued at $640M in 2025."},
    ]

    result = rag_pipeline._null_out_unsupported_tam_tiers(market_sizing, context_chunks)

    assert result["sam"]["citation_index"] == 2
