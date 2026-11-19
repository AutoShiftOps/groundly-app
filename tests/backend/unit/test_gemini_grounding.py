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
        web_retrieval, "_fetch_page",
        AsyncMock(return_value=web_retrieval.FetchedPage(
            "https://example.com/report", "Market Report",
            "The tax preparation software market was valued at $17.6 billion in 2024.",
        )),
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
        return web_retrieval.FetchedPage(url, "OK", "Real page text with a figure of $5 million.")

    monkeypatch.setattr(web_retrieval, "_fetch_page", fake_fetch)
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


# --- Grounding redirects: cite the final page, never Google's redirector ---

_REDIRECT = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123"


def _mock_http(monkeypatch, handler):
    import httpx

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(web_retrieval.httpx, "AsyncClient", lambda **kw: real_client(transport=transport, **kw))


def _ingest_spy(monkeypatch):
    calls = []

    def fake_ingest(text, title, url, framework_tag):
        calls.append({"text": text, "title": title, "url": url})
        return 1

    monkeypatch.setattr(web_retrieval, "ingest_content", fake_ingest)
    return calls


def test_grounded_redirect_is_followed_and_the_final_url_and_page_title_are_stored(monkeypatch):
    import httpx

    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    # Gemini's web.title is just the domain here.
    monkeypatch.setattr(
        web_retrieval.llm_provider, "google_search_grounding_urls",
        AsyncMock(return_value=[(_REDIRECT, "austintexas.gov")]),
    )

    def handler(request):
        if request.url.host == "vertexaisearch.cloud.google.com":
            return httpx.Response(302, headers={"Location": "https://www.austintexas.gov/economic/freelance-report"})
        return httpx.Response(200, html="<html><head><title>Austin Freelance Economy Report &amp; Data</title></head>"
                                        "<body><p>Austin had 182,000 self-employed workers in 2024.</p></body></html>")

    _mock_http(monkeypatch, handler)
    calls = _ingest_spy(monkeypatch)

    result = asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("austin freelancers", "tam"))

    assert result["urls_ingested"] == ["https://www.austintexas.gov/economic/freelance-report"]
    assert calls[0]["url"] == "https://www.austintexas.gov/economic/freelance-report"
    assert "vertexaisearch" not in calls[0]["url"]
    assert calls[0]["title"] == "Austin Freelance Economy Report & Data"
    assert "182,000 self-employed" in calls[0]["text"]


def test_a_real_grounding_title_is_kept_over_the_page_title(monkeypatch):
    import httpx

    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    monkeypatch.setattr(
        web_retrieval.llm_provider, "google_search_grounding_urls",
        AsyncMock(return_value=[(_REDIRECT, "Self-Employment in Texas, 2024 Annual Review")]),
    )
    _mock_http(monkeypatch, lambda request: (
        httpx.Response(302, headers={"Location": "https://example.org/review"})
        if request.url.host == "vertexaisearch.cloud.google.com"
        else httpx.Response(200, html="<title>Home | Example</title><p>Real text.</p>")
    ))
    calls = _ingest_spy(monkeypatch)

    asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("q", "tam"))

    assert calls[0]["title"] == "Self-Employment in Texas, 2024 Annual Review"
    assert calls[0]["url"] == "https://example.org/review"


def test_a_page_that_never_leaves_googles_redirect_is_skipped(monkeypatch):
    import httpx

    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    monkeypatch.setattr(
        web_retrieval.llm_provider, "google_search_grounding_urls",
        AsyncMock(return_value=[(_REDIRECT, "example.org")]),
    )
    # The redirector answers 200 itself (e.g. an interstitial) -- no real page.
    _mock_http(monkeypatch, lambda request: httpx.Response(200, html="<title>Redirecting</title><p>Please wait</p>"))
    calls = _ingest_spy(monkeypatch)

    result = asyncio.run(web_retrieval.search_and_ingest_gemini_grounding("q", "tam"))

    assert result == {"total_chunks": 0, "urls_ingested": []}
    assert calls == []
