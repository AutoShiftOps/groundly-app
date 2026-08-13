"""
RAG grounding pipeline: retrieve -> generate with citations -> verify claims -> confidence score.
"""

import asyncio
import logging

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from openai import AsyncOpenAI
from agents.db import search_similar
from agents import web_retrieval

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o-mini"

# Separate from agents.db.MIN_SIMILARITY (0.35), which is a SQL-side floor
# that decides whether a row is returned from the corpus AT ALL. This is a
# Python-side threshold on the BEST similarity among rows that already
# cleared that floor: a couple of chunks scraping past 0.35 from an
# unrelated seed topic (e.g. EV-charging content matching a synth-rental
# query) should not silently prevent the live web-retrieval safety net from
# running just because *something* technically came back. Local retrieval
# only counts as "good enough" here if its best match clears this bar.
LIVE_RETRIEVAL_TRIGGER_THRESHOLD = 0.5

GROUNDING_SYSTEM_PROMPT = """You are a grounded business-analysis assistant.
Rules you must follow strictly:
1. Only use facts present in the provided CONTEXT below. Never use outside knowledge for market data, statistics, or claims.
2. Every factual sentence must end with a citation marker like [1], [2] referring to the numbered context chunk it came from.
3. If the CONTEXT does not contain enough information to answer, explicitly say "Insufficient grounded data available for this section" instead of guessing.
4. Do not fabricate numbers, company names, or sources under any circumstance.
"""

TAM_TAGGING_INSTRUCTION = """
Additionally, since this is a market-sizing (TAM/SAM/SOM) analysis:
whenever you state a Total Addressable Market figure, prefix it with
[TAM]. Whenever you state a Serviceable Available Market figure, prefix
it with [SAM]. Whenever you state a Serviceable Obtainable Market
figure, prefix it with [SOM]. Example: "[TAM] The global market is
$68.3B [1]." Only tag a figure if the CONTEXT explicitly supports that
specific tier — do not invent SAM or SOM if the context only supports
TAM. Always write the figure in abbreviated form ($68.3B, $1.9M, $2.1T)
— never spell out "billion"/"million"/"trillion" as words.
"""


async def embed_query(query: str):
    response = await client.embeddings.create(model=EMBEDDING_MODEL, input=query)
    return response.data[0].embedding


async def _search_similar_chunks(embedding, top_k: int = 8, framework_tag: str | None = None):
    # search_similar() is a blocking psycopg2 call; run it off the event
    # loop so concurrent run_pipeline() calls (one per framework) don't
    # serialize behind it.
    return await asyncio.to_thread(search_similar, embedding, top_k=top_k, framework_tag=framework_tag)


async def retrieve(query: str, top_k: int = 8, framework_tag: str | None = None):
    embedding = await embed_query(query)
    return await _search_similar_chunks(embedding, top_k=top_k, framework_tag=framework_tag)


async def generate_with_citations(query: str, context_chunks: list, framework_tag: str | None = None):
    if not context_chunks:
        return {
            "text": "Insufficient grounded data available for this section.",
            "citations": [],
        }

    context_block = "\n\n".join(
        f"[{i+1}] {c['chunk_text']} (source: {c.get('source_title') or c.get('source_url', 'unknown')})"
        for i, c in enumerate(context_chunks)
    )

    system_prompt = GROUNDING_SYSTEM_PROMPT
    if framework_tag == "tam":
        system_prompt += TAM_TAGGING_INSTRUCTION

    completion = await client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"CONTEXT:\n{context_block}\n\nQUESTION:\n{query}"},
        ],
        temperature=0.2,
    )

    text = completion.choices[0].message.content
    citations = [
        {
            "index": i + 1,
            "source_url": c.get("source_url"),
            "source_title": c.get("source_title"),
            "confidence_score": c.get("confidence_score"),
            "similarity": c.get("similarity"),
        }
        for i, c in enumerate(context_chunks)
    ]
    return {"text": text, "citations": citations}


def verify_claims(generated_text: str, citations: list):
    has_markers = any(f"[{c['index']}]" in generated_text for c in citations)
    if not citations:
        unsupported = ["No grounded sources retrieved for this section"]
    elif not has_markers:
        unsupported = ["No inline citation markers found in output"]
    else:
        unsupported = []
    return {
        "verified": len(unsupported) == 0,
        "unsupported_claims": unsupported,
    }


async def run_pipeline(query: str, framework_tag: str | None = None):
    embedding = await embed_query(query)
    chunks = await _search_similar_chunks(embedding, framework_tag=framework_tag)

    best_local_similarity = max((c["similarity"] for c in chunks), default=0.0)
    is_empty = not chunks
    is_weak = bool(chunks) and best_local_similarity < LIVE_RETRIEVAL_TRIGGER_THRESHOLD

    if (is_empty or is_weak) and framework_tag:
        # Local grounding is either empty, or non-empty but weak (best match
        # below LIVE_RETRIEVAL_TRIGGER_THRESHOLD -- see constant above). Try
        # live web retrieval before falling through to "insufficient
        # grounded data". Logged here (not just inside web_retrieval.py,
        # whose own log line always says "empty" regardless of which of the
        # two conditions actually triggered it) so the trigger reason is
        # visible in logs.
        logger.info(
            "run_pipeline: local grounding %s for framework=%r (best_similarity=%.4f, %d row(s)) -- "
            "invoking live web-retrieval fallback.",
            "empty" if is_empty else "weak", framework_tag, best_local_similarity, len(chunks),
        )
        #
        # Cost/safety cap: this call site is reached at most once per
        # run_pipeline() invocation (no loop, no retry), and analyze() calls
        # run_pipeline() exactly once per framework per request -- so this
        # single, unconditional call already enforces "at most 1
        # search_and_ingest per framework per analyze() request" without
        # needing separate request-scoped bookkeeping. Don't wrap this in a
        # retry loop without revisiting that invariant.
        ingested = await web_retrieval.search_and_ingest(query, framework_tag)
        if ingested > 0:
            refreshed = await _search_similar_chunks(embedding, framework_tag=framework_tag)
            # Only replace what we have if the fresh search actually found
            # something. In the "weak" case especially, don't discard
            # marginal-but-real local matches just because the re-search
            # came back empty (e.g. a transient DB hiccup).
            if refreshed:
                chunks = refreshed
        # Otherwise chunks keeps whatever it already had -- empty (falls
        # through to insufficient-data below) or the original weak matches
        # (falls through to generation with those, same as before this
        # threshold existed) -- exactly as before this feature in both cases.

    result = await generate_with_citations(query, chunks, framework_tag=framework_tag)
    verification = verify_claims(result["text"], result["citations"])
    return {**result, "verification": verification}
