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

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from agents.ingest import ingest_content
from tavily import AsyncTavilyClient

logger = logging.getLogger(__name__)

SEARCH_DEPTH = "basic"


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

    try:
        client = AsyncTavilyClient(api_key=config.TAVILY_API_KEY)
        response = await client.search(query, max_results=max_results, search_depth=SEARCH_DEPTH)
    except Exception:
        logger.exception(
            "web_retrieval: Tavily search failed framework=%r query=%r -- degrading to no results.",
            framework_tag, query,
        )
        return 0

    results = response.get("results") or []
    total_chunks = 0
    for r in results:
        content = (r.get("content") or "").strip()
        if not content:
            continue
        url = r.get("url")
        title = r.get("title") or url or "Web result"
        try:
            total_chunks += ingest_content(content, title=title, url=url, framework_tag=framework_tag)
        except Exception:
            logger.exception(
                "web_retrieval: failed to ingest result url=%r framework=%r query=%r -- skipping it.",
                url, framework_tag, query,
            )

    logger.info(
        "web_retrieval: framework=%r query=%r found %d web result(s), ingested %d chunk(s) total.",
        framework_tag, query, len(results), total_chunks,
    )
    return total_chunks
