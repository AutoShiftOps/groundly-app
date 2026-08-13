"""
RAG grounding pipeline: retrieve -> generate with citations -> verify claims -> confidence score.
"""

import asyncio
import json
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
3. If the CONTEXT is relevant to the topic but only partially covers it, write the analysis using what IS supported by the CONTEXT — cite each supported claim — and explicitly note which aspects the CONTEXT does not address. This is the PREFERRED response whenever the CONTEXT contains any usable, on-topic facts. Only respond "Insufficient grounded data available for this section" if the CONTEXT is genuinely unrelated to the topic or contains no usable facts at all — never because it merely fails to cover every angle.
4. Do not fabricate numbers, company names, or sources under any circumstance.
5. Write as a confident, specific business analyst, not a generic summary generator — lead sentences with the conclusion, not the setup; use concrete numbers over vague qualifiers where the CONTEXT supports them. This rule is about register only — it never overrides rules 1-4.
"""

# Phase 1 (TAM) + Phase 3 (PESTEL/SWOT/BMC) of docs/BUSINESS_METRICS_SPEC.md:
# replaces the old inline bracket-tagging approach (asked the model to tag
# figures inside free-form prose, then regex-recovered structure from that
# prose after the fact -- lossy and, per prior measurement, unreliable: 0/5
# real calls followed the abbreviated-unit rule for TAM). Structured output
# makes the shape guaranteed instead of best-effort-parsed, for all four.
#
# Every structured framework's schema has the same top-level shape --
# { "narrative": string, "<field>": ... } -- so FrameworkStrip's
# lastSentence(result.text) and the plain-prose fallback rendering keep
# working completely unchanged (narrative IS result.text, exactly as before
# this feature); "<field>" is purely additive, same as market_sizing was.
TAM_STRUCTURED_SUFFIX = """
Additionally, since this is a market-sizing (TAM/SAM/SOM) analysis, also
populate the market_sizing object:
- Only fill in a tier (tam/sam/som) if the CONTEXT explicitly states a
  dollar figure for that specific tier. Leave it null if the CONTEXT
  doesn't support it -- do not invent SAM or SOM if the context only
  supports TAM.
- "label" must be the abbreviated dollar form, e.g. "$68.3B", "$1.9M",
  "$2.1T" -- never spell out "billion"/"million"/"trillion" as words.
- "value_usd" must be that same figure as a plain number of dollars
  (e.g. 68300000000 for $68.3B).
- "citation_index" is the number of the CONTEXT chunk (matching the [N]
  citation markers you use in narrative) that states this specific
  figure, or null if you can't attribute it to one specific chunk.
- "cagr_pct" is the compound annual growth rate as a plain percentage
  number (e.g. 8.7 for an 8.7% CAGR) ONLY if the CONTEXT explicitly states
  one for that specific tier, otherwise null. Do not estimate or infer a
  CAGR that isn't stated -- null is the correct, expected result when the
  source material doesn't give a growth rate for that tier.
"""

MARKET_SIZING_SCHEMA = {
    "type": "object",
    "properties": {
        "narrative": {
            "type": "string",
            "description": "The full grounded analysis, same rules as ungrounded prose output: cite every factual sentence with [N] markers.",
        },
        "market_sizing": {
            "type": "object",
            "properties": {
                tier: {
                    "anyOf": [
                        {
                            "type": "object",
                            "properties": {
                                "value_usd": {"type": "number"},
                                "label": {"type": "string"},
                                "citation_index": {"type": ["integer", "null"]},
                                "cagr_pct": {"type": ["number", "null"]},
                            },
                            "required": ["value_usd", "label", "citation_index", "cagr_pct"],
                            "additionalProperties": False,
                        },
                        {"type": "null"},
                    ]
                }
                for tier in ("tam", "sam", "som")
            },
            "required": ["tam", "sam", "som"],
            "additionalProperties": False,
        },
    },
    "required": ["narrative", "market_sizing"],
    "additionalProperties": False,
}

# Phase 3: SWOT/PESTEL/BMC all reduce to the same shape -- a narrative plus
# N named categories, each an array of { text, citation_index } points.
# Built generically instead of writing the same schema 3x with different
# category names.
_CATEGORY_ITEM_SCHEMA = {
    "type": "object",
    "properties": {"text": {"type": "string"}, "citation_index": {"type": ["integer", "null"]}},
    "required": ["text", "citation_index"],
    "additionalProperties": False,
}


def _category_breakdown_schema(field_name: str, categories: tuple[str, ...]) -> dict:
    return {
        "type": "object",
        "properties": {
            "narrative": {
                "type": "string",
                "description": "The full grounded analysis, same rules as ungrounded prose output: cite every factual sentence with [N] markers.",
            },
            field_name: {
                "type": "object",
                "properties": {c: {"type": "array", "items": _CATEGORY_ITEM_SCHEMA} for c in categories},
                "required": list(categories),
                "additionalProperties": False,
            },
        },
        "required": ["narrative", field_name],
        "additionalProperties": False,
    }


def _category_instruction_suffix(kind_label: str, field_name: str, categories: tuple[str, ...]) -> str:
    return f"""
Additionally, since this is a {kind_label} analysis, also populate the
{field_name} object with one array per category ({", ".join(categories)}).
Each item is one specific point: {{ "text": "...", "citation_index": N or
null }}. Only include a point if the CONTEXT actually supports it -- an
empty array for a category is fine and expected if the CONTEXT doesn't
cover it. citation_index is the number of the CONTEXT chunk (matching the
[N] citation markers you use in narrative) that supports that specific
point, or null if you can't attribute it to one specific chunk.
"""


SWOT_CATEGORIES = ("strengths", "weaknesses", "opportunities", "threats")
PESTEL_CATEGORIES = ("political", "economic", "social", "technological", "environmental", "legal")
BMC_CATEGORIES = (
    "customer_segments", "value_propositions", "channels", "customer_relationships",
    "revenue_streams", "key_resources", "key_activities", "key_partners", "cost_structure",
)

SWOT_SCHEMA = _category_breakdown_schema("swot_analysis", SWOT_CATEGORIES)
PESTEL_SCHEMA = _category_breakdown_schema("pestel_analysis", PESTEL_CATEGORIES)
BMC_SCHEMA = _category_breakdown_schema("bmc_canvas", BMC_CATEGORIES)

# framework_tag -> (extra suffix appended to GROUNDING_SYSTEM_PROMPT, the
# extra field name in the parsed response, the json_schema name sent to
# OpenAI, the schema itself). A framework not in this dict (e.g. paid-tier
# frameworks not yet migrated) uses the plain, non-structured path below.
STRUCTURED_FRAMEWORKS = {
    "tam": (TAM_STRUCTURED_SUFFIX, "market_sizing", "grounded_market_analysis", MARKET_SIZING_SCHEMA),
    "pestel": (
        _category_instruction_suffix("PESTEL", "pestel_analysis", PESTEL_CATEGORIES),
        "pestel_analysis", "grounded_pestel_analysis", PESTEL_SCHEMA,
    ),
    "swot": (
        _category_instruction_suffix("SWOT", "swot_analysis", SWOT_CATEGORIES),
        "swot_analysis", "grounded_swot_analysis", SWOT_SCHEMA,
    ),
    "bmc": (
        _category_instruction_suffix("Business Model Canvas", "bmc_canvas", BMC_CATEGORIES),
        "bmc_canvas", "grounded_bmc_analysis", BMC_SCHEMA,
    ),
}


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

    structured = STRUCTURED_FRAMEWORKS.get(framework_tag)
    user_content = f"CONTEXT:\n{context_block}\n\nQUESTION:\n{query}"

    if structured:
        suffix, field_name, schema_name, schema = structured
        system_prompt = GROUNDING_SYSTEM_PROMPT + suffix
        completion = await client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            },
            temperature=0.2,
        )
        raw = completion.choices[0].message.content
        try:
            parsed = json.loads(raw)
            text = parsed["narrative"]
            extra_value = parsed[field_name]
        except (json.JSONDecodeError, KeyError, TypeError):
            # Should not happen under strict schema mode, but this must never
            # crash the request -- degrade to the same shape a non-structured
            # response has (no extra field) rather than raising.
            logger.exception("generate_with_citations: failed to parse structured %r response, raw=%r", framework_tag, raw)
            text = raw
            extra_value = None
        return {"text": text, "citations": citations, field_name: extra_value}

    completion = await client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": GROUNDING_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
    )
    text = completion.choices[0].message.content
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
