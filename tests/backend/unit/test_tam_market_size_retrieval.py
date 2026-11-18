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
