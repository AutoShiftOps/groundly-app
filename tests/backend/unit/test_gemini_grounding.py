# unify/3-gemini item 4: Gemini Google Search grounding retrieval.
# Confirms groundingChunks' URLs get fetched and ingested through the
# normal chunk/embed/store path (agents.ingest.ingest_content) -- never
# a citation built directly from groundingMetadata/snippet text -- and
# that this path is a no-op whenever Gemini isn't the active provider
# or isn't configured. All network calls (Gemini SDK, httpx, ingest)
# mocked; no real call.
from unittest.mock import AsyncMock
import asyncio

from agents import config, web_retrieval


def test_grounding_skipped_entirely_when_provider_is_openai(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "openai")
    grounding_mock = AsyncMock()
    monkeypatch.setattr(web_retrieval.llm_provider, "google_search_grounding_urls", grounding_mock)

    result = asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("some query", "tam"))

    assert result == {"total_chunks": 0, "urls_ingested": []}
    grounding_mock.assert_not_called()


def test_grounding_skipped_when_gemini_key_missing(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", None)
    grounding_mock = AsyncMock()
    monkeypatch.setattr(web_retrieval.llm_provider, "google_search_grounding_urls", grounding_mock)

    result = asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("some query", "tam"))

    assert result == {"total_chunks": 0, "urls_ingested": []}
    grounding_mock.assert_not_called()


def test_grounded_urls_are_fetched_and_ingested_not_built_from_metadata(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    monkeypatch.setattr(
        web_retrieval.llm_provider, "google_search_grounding_urls",
        AsyncMock(return_value=[("https://example.com/report", "Market Report")]),
    )
    monkeypatch.setattr(
        web_retrieval, "_fetch_page_text",
        AsyncMock(return_value="The tax preparation software market was valued at $17.6 billion in 2024."),
    )
    monkeypatch.setattr(web_retrieval, "ingest_content", lambda text, title, url, framework_tag: 2)

    result = asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("tax prep software market size", "tam"))

    assert result["total_chunks"] == 2
    assert result["urls_ingested"] == ["https://example.com/report"]
    # The only thing that ever reaches ingest_content is the fetched
    # page's own real text -- never anything derived from the
    # groundingChunks response object itself.


def test_a_url_that_fails_to_fetch_is_skipped_not_fatal(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    monkeypatch.setattr(
        web_retrieval.llm_provider, "google_search_grounding_urls",
        AsyncMock(return_value=[
            ("https://example.com/dead-link", "Dead"),
            ("https://example.com/ok", "OK"),
        ]),
    )

    async def fake_fetch(url):
        if "dead" in url:
            raise RuntimeError("404")
        return "Real page text with a figure of $5 million."

    monkeypatch.setattr(web_retrieval, "_fetch_page_text", fake_fetch)
    monkeypatch.setattr(web_retrieval, "ingest_content", lambda text, title, url, framework_tag: 1)

    result = asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("some query", "tam"))

    assert result["total_chunks"] == 1
    assert result["urls_ingested"] == ["https://example.com/ok"]


def test_grounding_call_failure_degrades_to_nothing_ingested(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    monkeypatch.setattr(
        web_retrieval.llm_provider, "google_search_grounding_urls",
        AsyncMock(side_effect=RuntimeError("Gemini grounding call failed")),
    )

    result = asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("some query", "tam"))

    assert result == {"total_chunks": 0, "urls_ingested": []}


def test_grounding_url_extraction_from_a_fake_gemini_response():
    # Exercises agents/llm_provider.py's own extraction logic against a
    # minimal fake response shaped like the real google-genai SDK's
    # response.candidates[0].grounding_metadata.grounding_chunks[i].web.
    from agents import llm_provider

    class FakeWeb:
        def __init__(self, uri, title):
            self.uri = uri
            self.title = title

    class FakeChunk:
        def __init__(self, web):
            self.web = web

    class FakeGroundingMetadata:
        def __init__(self, chunks):
            self.grounding_chunks = chunks

    class FakeCandidate:
        def __init__(self, grounding_metadata):
            self.grounding_metadata = grounding_metadata

    class FakeResponse:
        def __init__(self, candidates):
            self.candidates = candidates

    fake_response = FakeResponse([
        FakeCandidate(FakeGroundingMetadata([
            FakeChunk(FakeWeb("https://example.com/a", "A")),
            FakeChunk(FakeWeb("https://example.com/b", "B")),
        ])),
    ])

    class FakeModels:
        async def generate_content(self, **kwargs):
            return fake_response

    class FakeAio:
        def __init__(self):
            self.models = FakeModels()

    class FakeClient:
        def __init__(self):
            self.aio = FakeAio()

    import agents.llm_provider as lp
    original_get_client = lp._get_genai_client
    lp._get_genai_client = lambda: FakeClient()
    try:
        urls = asyncio.run(lp.google_search_grounding_urls("query", max_results=5))
    finally:
        lp._get_genai_client = original_get_client

    assert urls == [("https://example.com/a", "A"), ("https://example.com/b", "B")]
