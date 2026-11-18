"""
Live web-retrieval fallback for agents/rag_pipeline.py.

When local grounding (agents.db.search_similar) comes back empty for a
query, this searches the web via Tavily and ingests whatever comes back
through the same chunk -> embed -> store path the CLI uses
(agents.ingest.ingest_content), so run_pipeline() can re-run
search_similar() once against the freshly ingested content.

Never raises. A missing TAVILY_API_KEY, a network error, an API error, or a
failure ingesting an individual result are all logged and treated as "found
nothing" (return 0) -- this must degrade to the existing "insufficient
grounded data" behavior, never to a 500.
"""

import logging
import re

import httpx

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from agents import llm_provider
from agents.ingest import ingest_content
from tavily import AsyncTavilyClient

logger = logging.getLogger(__name__)

SEARCH_DEPTH = "basic"

_PAGE_FETCH_TIMEOUT = 10.0
_HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
_WHITESPACE_PATTERN = re.compile(r"\s+")


async def _run_single_search(query: str, framework_tag: str, max_results: int) -> tuple[int, int, list[str]]:
    """Runs one Tavily search + ingests whatever comes back. Returns
    (result_count, chunks_ingested, urls_ingested) -- never raises."""
    try:
        client = AsyncTavilyClient(api_key=config.TAVILY_API_KEY)
        response = await client.search(query, max_results=max_results, search_depth=SEARCH_DEPTH)
    except Exception:
        logger.exception(
            "web_retrieval: Tavily search failed framework=%r query=%r -- degrading to no results.",
            framework_tag, query,
        )
        return 0, 0, []

    results = response.get("results") or []
    total_chunks = 0
    urls_ingested = []
    for r in results:
        content = (r.get("content") or "").strip()
        if not content:
            continue
        url = r.get("url")
        title = r.get("title") or url or "Web result"
        try:
            chunks = ingest_content(content, title=title, url=url, framework_tag=framework_tag)
        except Exception:
            logger.exception(
                "web_retrieval: failed to ingest result url=%r framework=%r query=%r -- skipping it.",
                url, framework_tag, query,
            )
            continue
        total_chunks += chunks
        if chunks and url:
            urls_ingested.append(url)

    return len(results), total_chunks, urls_ingested


async def search_and_ingest(query: str, framework_tag: str, max_results: int = 3) -> int:
    if not config.TAVILY_API_KEY:
        logger.warning(
            "web_retrieval: local grounding empty for framework=%r query=%r, but TAVILY_API_KEY "
            "is not configured -- skipping web search.",
            framework_tag, query,
        )
        return 0

    logger.info(
        "web_retrieval: local grounding empty, searching web framework=%r query=%r",
        framework_tag, query,
    )

    result_count, total_chunks, _urls = await _run_single_search(query, framework_tag, max_results)

    logger.info(
        "web_retrieval: framework=%r query=%r found %d web result(s), ingested %d chunk(s) total.",
        framework_tag, query, result_count, total_chunks,
    )
    return total_chunks


# GitHub "TAM retrieval improvement" follow-up: the generic analysis query
# ("<idea> -- TAM/SAM/SOM analysis | geography: X") almost never surfaces
# real market-size figures via Tavily, since market-size data is reported
# at the category/country level, not tied to a specific local business
# idea's own wording -- confirmed live (Mississauga catering-subscription
# idea: 3 results, best similarity 0.486, below the 0.54 floor). Market
# size is a distinct, well-known search-content type ("<category> market
# size <country> USD"), so TAM gets its own dedicated query(ies) instead
# of reusing the generic one. Capped at 2 Tavily calls total.
MARKET_SIZE_MAX_CALLS = 2


async def search_and_ingest_market_size(
    categories: list[str], country: str, framework_tag: str = "tam", max_results: int = 5,
) -> dict:
    """Runs up to MARKET_SIZE_MAX_CALLS dedicated market-size Tavily
    searches, one per category in `categories` (most specific first --
    see agents.rag_pipeline._classify_tam_market_category, which returns
    [specific_category, parent_category]), instead of the generic
    analysis query. Stops after the first query that actually ingests
    something, so a successful specific-category search never spends the
    second call on the broader parent category. Returns {"total_chunks":
    int, "queries_run": [str, ...], "url_to_query": {url: query}} so
    callers can log exactly which query's results ended up ingested (and,
    after re-searching the vector store, which one the chunks actually
    used came from)."""
    queries = [f"{category} market size {country} USD" for category in categories if category]

    if not queries:
        logger.info("web_retrieval: TAM market-size search skipped -- no category to search for.")
        return {"total_chunks": 0, "queries_run": [], "url_to_query": {}}

    if not config.TAVILY_API_KEY:
        logger.warning(
            "web_retrieval: TAM market-size search skipped for categories=%r country=%r -- "
            "TAVILY_API_KEY is not configured.",
            categories, country,
        )
        return {"total_chunks": 0, "queries_run": [], "url_to_query": {}}

    total_chunks = 0
    queries_run = []
    url_to_query: dict[str, str] = {}

    for query in queries[:MARKET_SIZE_MAX_CALLS]:
        queries_run.append(query)
        result_count, chunks, urls = await _run_single_search(query, framework_tag, max_results)
        logger.info(
            "web_retrieval: TAM market-size query=%r found %d result(s), ingested %d chunk(s).",
            query, result_count, chunks,
        )
        for url in urls:
            url_to_query[url] = query
        total_chunks += chunks
        if chunks > 0:
            # Found something real -- don't spend the second Tavily call.
            break

    return {"total_chunks": total_chunks, "queries_run": queries_run, "url_to_query": url_to_query}


async def _fetch_page_text(url: str) -> str:
    """Fetches a URL and strips it down to plain visible text. Not a
    real HTML parser (no script/style-block removal beyond a crude tag
    strip) -- good enough for ingest_content()'s own chunker, which
    only needs readable prose, not a faithful DOM reconstruction. Any
    failure (network, non-200, non-text content) raises; the caller
    treats that as "nothing to ingest from this URL", same as a failed
    Tavily result."""
    async with httpx.AsyncClient(timeout=_PAGE_FETCH_TIMEOUT, follow_redirects=True) as client:
        response = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; GroundlyBot/1.0)"})
        response.raise_for_status()
    html = response.text
    html = re.sub(r"(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", html)
    text = _HTML_TAG_PATTERN.sub(" ", html)
    return _WHITESPACE_PATTERN.sub(" ", text).strip()


async def search_and_ingest_gemini_grounding(query: str, framework_tag: str, max_results: int = 5) -> dict:
    """unify/3-gemini item 4: when the active provider is Gemini, this
    runs ONE Gemini call with the Google Search grounding tool for
    `query`, then fetches and ingests each of its groundingChunks'
    REAL pages through the exact same chunk/embed/store path Tavily
    results use (agents.ingest.ingest_content) -- so every resulting
    citation has real, stored page text the claim verifier can check
    against, same as any other source. NEVER builds a citation (or any
    chunk) directly from Gemini's groundingMetadata/snippet text --
    that's not a stored, re-searchable chunk. Counts as one extra
    retrieval call on top of the existing Tavily call for this
    framework; callers are responsible for keeping that within the
    "at most 1 web-retrieval attempt per framework per request"
    invariant documented in agents/rag_pipeline.py's run_pipeline().
    Never raises -- degrades to {"total_chunks": 0, "urls_ingested": []}
    on any failure, same philosophy as the Tavily path."""
    if config.LLM_PROVIDER != "gemini" or not config.GEMINI_API_KEY:
        return {"total_chunks": 0, "urls_ingested": []}

    try:
        urls = await llm_provider.google_search_grounding_urls(query, max_results)
    except Exception:
        logger.exception(
            "web_retrieval: Gemini Google Search grounding call failed framework=%r query=%r.",
            framework_tag, query,
        )
        return {"total_chunks": 0, "urls_ingested": []}

    total_chunks = 0
    urls_ingested: list[str] = []
    for url, title in urls:
        try:
            text = await _fetch_page_text(url)
        except Exception:
            logger.exception("web_retrieval: failed to fetch Gemini-grounded url=%r -- skipping it.", url)
            continue
        if not text:
            continue
        try:
            chunks = ingest_content(text, title=title or url, url=url, framework_tag=framework_tag)
        except Exception:
            logger.exception("web_retrieval: failed to ingest Gemini-grounded url=%r -- skipping it.", url)
            continue
        total_chunks += chunks
        if chunks:
            urls_ingested.append(url)

    logger.info(
        "web_retrieval: Gemini grounding framework=%r query=%r found %d url(s), ingested %d chunk(s) total.",
        framework_tag, query, len(urls), total_chunks,
    )
    return {"total_chunks": total_chunks, "urls_ingested": urls_ingested}
