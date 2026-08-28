"""
RAG grounding pipeline: retrieve -> generate with citations -> verify claims -> confidence score.
"""

import asyncio
import json
import logging
import re

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
#
# Matches MIN_CONTEXT_SIMILARITY (0.54) below, not 0.5 -- previously left at
# 0.5 while MIN_CONTEXT_SIMILARITY was calibrated to 0.54, which opened a
# dead zone: a best-local-similarity in [0.50, 0.54) cleared this trigger
# bar (so web retrieval was never attempted) but still failed the
# downstream usability floor (so the content got discarded anyway) --
# confirmed live on the solar-village case itself (0.53 similarity, cited
# "PESTEL: EV Charging Market"), which the MIN_CONTEXT_SIMILARITY comment
# below already documented as "never even triggered web retrieval since
# 0.53 already clears 0.5". Raising this to 0.54 closes that gap: anything
# that would ultimately fail the usability floor now gets a real shot at
# live web retrieval first, instead of bailing without ever trying.
LIVE_RETRIEVAL_TRIGGER_THRESHOLD = 0.54

# docs/PHASE_5_SPEC.md C2. Neither MIN_SIMILARITY (0.35) nor
# LIVE_RETRIEVAL_TRIGGER_THRESHOLD stopped a chunk that technically cleared
# 0.35 from being used as real context if the web-retrieval attempt didn't
# improve things -- confirmed live: a "Solar panel based electric grid for
# villages" PESTEL report cited "PESTEL: EV Charging Market" at 0.53
# similarity. (At the time LIVE_RETRIEVAL_TRIGGER_THRESHOLD was still 0.5,
# this case didn't even trigger web retrieval, since 0.53 cleared 0.5
# outright -- that dead zone was closed separately by raising
# LIVE_RETRIEVAL_TRIGGER_THRESHOLD to match this constant, see its comment
# above. This constant's own job is unchanged either way: even content that
# DOES reach generation must still clear this bar.)
#
# The spec's own suggestion was to reuse 0.5 for this too -- verified that
# does NOT work: 0.53 (the confirmed bad case) clears 0.5 outright. Instead
# calibrated empirically against real retrieval data: genuinely off-topic
# ideas (ferret grooming, yo-yo marketplace, hot-sauce subscription) scored
# 0.35-0.46 against this corpus; the solar case scored 0.53; a genuinely
# on-topic case (synth-rental PESTEL, matched against real web-retrieved
# synth content) scored 0.5468. 0.54 sits in the gap between the highest
# confirmed-bad case (0.53) and the lowest confirmed-good case (0.5468).
#
# Applied as a hard floor on whatever run_pipeline() ends up with AFTER any
# web-retrieval attempt -- if nothing clears this bar, don't generate from
# it. LIVE_RETRIEVAL_TRIGGER_THRESHOLD now sits at the same value, so in
# practice anything failing this floor already got a web-retrieval attempt
# first; this floor is what stops it from reaching generation if that
# attempt didn't produce anything better.
MIN_CONTEXT_SIMILARITY = 0.54

# Follow-up, tam-specific: paywalled market-research aggregator pages
# (confirmed live, twice -- researchandmarkets.com and dataintelo.com)
# scrape into a table-of-contents layer, dense with exactly the right
# vocabulary ("Total Addressable Market", "Market Size", "Growth Rate")
# but containing zero actual dollar figures or percentages -- the real
# numbers stay behind the paywall. A chunk like that can score above
# MIN_CONTEXT_SIMILARITY on vocabulary alone (confirmed: 0.62 on one real
# case) while having nothing to ground an actual tam/sam/som value with.
#
# Deliberately a cheap regex check, not another LLM call -- and applied
# to tam only (see _null_out_unsupported_tam_tiers below): PESTEL/SWOT/
# BMC's payload is legitimately qualitative text, a chunk with no dollar
# figure there is normal and not a signal of anything wrong.
_DOLLAR_FIGURE_PATTERN = re.compile(
    r"\$\s?[\d,]+(?:\.\d+)?\s*(?:billion|million|trillion|bn|mn|tn|B|M|T)?\b", re.IGNORECASE
)
_PERCENTAGE_PATTERN = re.compile(r"\d+(?:\.\d+)?\s?%")


def _chunk_has_numeric_market_figure(chunk_text: str) -> bool:
    return bool(_DOLLAR_FIGURE_PATTERN.search(chunk_text) or _PERCENTAGE_PATTERN.search(chunk_text))


def _null_out_unsupported_tam_tiers(market_sizing: dict, context_chunks: list) -> dict:
    """
    Deterministic backstop, not a rewrite of the model's own reasoning:
    for each tam/sam/som tier the model populated, confirm the chunk it
    cited as citation_index actually contains a real dollar figure or
    percentage. If it doesn't, null the whole tier out -- same
    null-when-ungrounded discipline as everywhere else in this schema.

    Citations themselves and the narrative text are untouched by this: a
    numeric-free chunk can still be real, legitimate supporting context
    for the prose (e.g. explaining what a market covers), it's just not a
    valid basis for a specific tam/sam/som dollar value. A tier whose
    citation_index is null (the model legitimately couldn't attribute the
    figure to one specific chunk -- an existing, separate allowance in
    this schema, see TAM_STRUCTURED_SUFFIX) is left as-is; this check only
    concerns itself with tiers that DO point at a specific chunk.
    """
    validated = {}
    for tier in ("tam", "sam", "som"):
        tier_value = market_sizing.get(tier)
        if tier_value is None:
            validated[tier] = None
            continue
        citation_index = tier_value.get("citation_index")
        if not citation_index or not (1 <= citation_index <= len(context_chunks)):
            validated[tier] = tier_value
            continue
        chunk_text = context_chunks[citation_index - 1].get("chunk_text") or ""
        if _chunk_has_numeric_market_figure(chunk_text):
            validated[tier] = tier_value
        else:
            logger.info(
                "generate_with_citations: tam tier=%r cited chunk %d with no numeric market figure "
                "(dollar amount/percentage) -- nulling out as unsupported (was: %r).",
                tier, citation_index, tier_value,
            )
            validated[tier] = None
    return validated


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
- If the CONTEXT states MORE THAN ONE dollar figure for the SAME tier at
  different points in time (e.g. a current/present-day figure alongside a
  separate future-year projection or forecast), prefer the CURRENT,
  present-day figure for "value_usd"/"label" -- not the future
  projection. Only use a future projection when the CONTEXT gives no
  current-year figure at all for that tier; a real projection still beats
  leaving the tier null, but when you do this, make "tier_description"
  say so (e.g. "Projected 2030 home charging market", not just "Home
  charging market") so it reads as a forecast, not today's market size.
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
- "tier_description" is a short (3-8 word) phrase describing what this
  specific tier represents for THIS idea's actual market, e.g. "Global
  sustainable packaging market" for TAM, drawn from what the CONTEXT
  actually says about it -- not a generic definition of what TAM/SAM/SOM
  means in the abstract. Only fill it in if the CONTEXT supports a
  specific description for that tier; otherwise null. Note whether a
  figure is a future projection per the rule above.
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
                                "tier_description": {"type": ["string", "null"]},
                            },
                            "required": ["value_usd", "label", "citation_index", "cagr_pct", "tier_description"],
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

# GitHub issue #13. BCG Matrix classifies into one of 4 quadrants based on
# real market-growth-rate and relative-market-share figures -- unlike
# Porter's Five Forces/STP (qualitative categories), this needs the same
# numeric-grounding discipline as market_sizing: don't let the model
# guess a quadrant without real supporting figures. Closer to
# MARKET_SIZING_SCHEMA's shape than the generic category builder.
BCG_QUADRANTS = ("star", "cash_cow", "question_mark", "dog")

BCG_STRUCTURED_SUFFIX = """
Additionally, since this is a BCG Growth-Share Matrix analysis, also
populate the bcg_matrix object:
- Only assign a quadrant (star / cash_cow / question_mark / dog) if the
  CONTEXT explicitly supports BOTH a real market growth rate AND a real
  description of this business's competitive/market-share position. If
  either is missing, set bcg_matrix to null entirely -- do not guess a
  quadrant from partial or absent numeric grounding. A market growth rate
  alone, with no sense of competitive position, is not enough to place a
  quadrant, and vice versa.
- "market_growth_rate_pct" is the market's growth rate as a plain
  percentage number (e.g. 12.5 for 12.5%) ONLY if the CONTEXT explicitly
  states one, otherwise null.
- "market_share_position" is a short (5-15 word) grounded description of
  this business's relative competitive/market-share position, drawn from
  what the CONTEXT actually says (e.g. "Market leader with an estimated
  35% share" or "Fragmented market, no dominant incumbent") -- not a
  fabricated precise ratio. Null if the CONTEXT doesn't describe this
  idea's relative position at all.
- "citation_index" is the number of the CONTEXT chunk that most directly
  supports the quadrant assignment, or null if you can't attribute it to
  one specific chunk.
- "rationale" is a short (1-2 sentence) explanation of why this quadrant
  fits, referencing the real growth rate and market position above --
  never invent a justification not grounded in those two fields.
"""

BCG_MATRIX_SCHEMA = {
    "type": "object",
    "properties": {
        "narrative": {
            "type": "string",
            "description": "The full grounded analysis, same rules as ungrounded prose output: cite every factual sentence with [N] markers.",
        },
        "bcg_matrix": {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "quadrant": {"type": "string", "enum": list(BCG_QUADRANTS)},
                        "market_growth_rate_pct": {"type": ["number", "null"]},
                        "market_share_position": {"type": ["string", "null"]},
                        "citation_index": {"type": ["integer", "null"]},
                        "rationale": {"type": "string"},
                    },
                    "required": ["quadrant", "market_growth_rate_pct", "market_share_position", "citation_index", "rationale"],
                    "additionalProperties": False,
                },
                {"type": "null"},
            ]
        },
    },
    "required": ["narrative", "bcg_matrix"],
    "additionalProperties": False,
}


def _null_out_unsupported_bcg_quadrant(bcg_matrix: dict | None) -> dict | None:
    """
    Deterministic backstop, same philosophy as
    _null_out_unsupported_tam_tiers(): don't trust the model's own
    judgment alone on "is this quadrant actually grounded" -- verify it.
    A quadrant assignment is only kept if BOTH market_growth_rate_pct is
    a real number and market_share_position is a real, non-empty string;
    otherwise the whole result is nulled, per this framework's explicit
    "don't guess a quadrant without real supporting numbers" requirement.
    """
    if bcg_matrix is None:
        return None
    has_growth_rate = isinstance(bcg_matrix.get("market_growth_rate_pct"), (int, float))
    has_position = bool((bcg_matrix.get("market_share_position") or "").strip())
    if has_growth_rate and has_position:
        return bcg_matrix
    logger.info(
        "generate_with_citations: bcg_matrix quadrant=%r lacked real growth-rate/market-position "
        "grounding (growth_rate=%r, position=%r) -- nulling out as unsupported.",
        bcg_matrix.get("quadrant"), bcg_matrix.get("market_growth_rate_pct"), bcg_matrix.get("market_share_position"),
    )
    return None

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


# GitHub issue #15 (Balanced Scorecard). Same {text, citation_index}
# point shape as _CATEGORY_ITEM_SCHEMA, but each point can ALSO carry an
# optional grounded metric (a named number with an optional target) --
# the issue flagged this as "closer to market_sizing's numeric
# discipline than pure qualitative text" but, unlike BCG Matrix's single
# forced-choice quadrant, a scorecard perspective is naturally an array
# of independent points -- some purely qualitative, some with a real
# number attached -- so there's no single all-or-nothing field that
# risks the model always guessing something. Decision: metric_name/
# metric_value/target_value default to null (pure qualitative point,
# same as every other framework's items) and are populated ONLY when
# the CONTEXT gives a specific number for that specific point -- never
# invented to fill the slot. _null_out_ungrounded_scorecard_metrics()
# below is the deterministic backstop enforcing metric_name and
# metric_value can only both be non-null together (never one without
# the other -- a metric name with no value, or a bare number with no
# name, is not a usable grounded metric either way).
_METRIC_CATEGORY_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "text": {"type": "string"},
        "citation_index": {"type": ["integer", "null"]},
        "metric_name": {
            "type": ["string", "null"],
            "description": "Short label for a specific real metric this point cites, e.g. 'Customer retention rate' -- null if this point isn't tied to one specific number.",
        },
        "metric_value": {
            "type": ["string", "null"],
            "description": "The metric's real, CONTEXT-supported current value as stated, e.g. '87%' or '$4.2M ARR' -- null if metric_name is null, or if the CONTEXT doesn't state an actual value.",
        },
        "target_value": {
            "type": ["string", "null"],
            "description": "The metric's real, CONTEXT-supported target/goal value if one is explicitly stated -- null if no target is given, even when metric_value is present.",
        },
    },
    "required": ["text", "citation_index", "metric_name", "metric_value", "target_value"],
    "additionalProperties": False,
}


def _metric_category_breakdown_schema(field_name: str, categories: tuple[str, ...]) -> dict:
    return {
        "type": "object",
        "properties": {
            "narrative": {
                "type": "string",
                "description": "The full grounded analysis, same rules as ungrounded prose output: cite every factual sentence with [N] markers.",
            },
            field_name: {
                "type": "object",
                "properties": {c: {"type": "array", "items": _METRIC_CATEGORY_ITEM_SCHEMA} for c in categories},
                "required": list(categories),
                "additionalProperties": False,
            },
        },
        "required": ["narrative", field_name],
        "additionalProperties": False,
    }


def _null_out_ungrounded_scorecard_metrics(balanced_scorecard: dict | None) -> dict | None:
    # Deterministic backstop, same philosophy as
    # _null_out_unsupported_tam_tiers/_null_out_unsupported_bcg_quadrant:
    # don't trust the LLM's own null-discipline alone. A "grounded
    # metric" requires BOTH metric_name AND metric_value to be real,
    # non-empty strings -- a name with no value, or a value with no
    # name, isn't a usable metric either way and gets nulled back out
    # (target_value alone never counts -- it's only meaningful attached
    # to a real metric_value).
    if balanced_scorecard is None:
        return None
    for _perspective, items in balanced_scorecard.items():
        if not isinstance(items, list):
            continue
        for item in items:
            has_name = bool((item.get("metric_name") or "").strip())
            has_value = bool((item.get("metric_value") or "").strip())
            if not (has_name and has_value):
                item["metric_name"] = None
                item["metric_value"] = None
                item["target_value"] = None
    return balanced_scorecard


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
# GitHub issue #11. Porter's Five Forces -- same qualitative
# {text, citation_index}-per-category shape as SWOT/PESTEL/BMC, not a
# numeric framework like TAM, so it reuses the exact same generic
# builders rather than needing its own schema design.
PORTER_CATEGORIES = (
    "competitive_rivalry", "threat_of_new_entrants", "bargaining_power_of_suppliers",
    "bargaining_power_of_buyers", "threat_of_substitutes",
)
# GitHub issue #12. Segmentation/Targeting/Positioning -- same generic
# qualitative-category pattern again.
STP_CATEGORIES = ("segmentation", "targeting", "positioning")
# GitHub issue #14. Porter's Value Chain -- 9 categories (5 primary + 4
# support activities), same generic qualitative-category pattern. The
# frontend renders this as a horizontal chain, not a grid, but the
# backend schema/prompt shape is identical to PESTEL/SWOT/BMC/Porter/STP.
VALUE_CHAIN_PRIMARY_CATEGORIES = (
    "inbound_logistics", "operations", "outbound_logistics", "marketing_and_sales", "service",
)
VALUE_CHAIN_SUPPORT_CATEGORIES = (
    "firm_infrastructure", "human_resource_management", "technology_development", "procurement",
)
VALUE_CHAIN_CATEGORIES = VALUE_CHAIN_PRIMARY_CATEGORIES + VALUE_CHAIN_SUPPORT_CATEGORIES
# GitHub issue #15. Balanced Scorecard's 4 standard perspectives.
BALANCED_SCORECARD_CATEGORIES = ("financial", "customer", "internal_process", "learning_and_growth")

SWOT_SCHEMA = _category_breakdown_schema("swot_analysis", SWOT_CATEGORIES)
PESTEL_SCHEMA = _category_breakdown_schema("pestel_analysis", PESTEL_CATEGORIES)
BMC_SCHEMA = _category_breakdown_schema("bmc_canvas", BMC_CATEGORIES)
PORTER_SCHEMA = _category_breakdown_schema("porter_forces", PORTER_CATEGORIES)
STP_SCHEMA = _category_breakdown_schema("stp_analysis", STP_CATEGORIES)
VALUE_CHAIN_SCHEMA = _category_breakdown_schema("value_chain", VALUE_CHAIN_CATEGORIES)
BALANCED_SCORECARD_SCHEMA = _metric_category_breakdown_schema("balanced_scorecard", BALANCED_SCORECARD_CATEGORIES)

BALANCED_SCORECARD_STRUCTURED_SUFFIX = f"""
Additionally, since this is a Balanced Scorecard analysis, also populate
the balanced_scorecard object with one array per perspective ({", ".join(BALANCED_SCORECARD_CATEGORIES)}).
Each item is one specific point: {{ "text": "...", "citation_index": N or
null, "metric_name": "..." or null, "metric_value": "..." or null,
"target_value": "..." or null }}. Only include a point if the CONTEXT
actually supports it -- an empty array for a perspective is fine and
expected if the CONTEXT doesn't cover it. Most points are purely
qualitative (leave metric_name/metric_value/target_value all null) --
only set metric_name AND metric_value together, and only when the
CONTEXT states a real, specific number for that exact point (e.g. an
actual revenue figure, retention rate, cycle time, or training hours
number). Never invent a plausible-sounding metric or target to fill
these fields -- a point with no real number attached should have all
three metric fields null, not a fabricated one. citation_index is the
number of the CONTEXT chunk (matching the [N] citation markers you use
in narrative) that supports that specific point, or null if you can't
attribute it to one specific chunk.
"""

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
    "porter": (
        _category_instruction_suffix("Porter's Five Forces", "porter_forces", PORTER_CATEGORIES),
        "porter_forces", "grounded_porter_analysis", PORTER_SCHEMA,
    ),
    "stp": (
        _category_instruction_suffix("Segmentation/Targeting/Positioning (STP)", "stp_analysis", STP_CATEGORIES),
        "stp_analysis", "grounded_stp_analysis", STP_SCHEMA,
    ),
    "bcg": (BCG_STRUCTURED_SUFFIX, "bcg_matrix", "grounded_bcg_analysis", BCG_MATRIX_SCHEMA),
    "value_chain": (
        _category_instruction_suffix("Porter's Value Chain", "value_chain", VALUE_CHAIN_CATEGORIES),
        "value_chain", "grounded_value_chain_analysis", VALUE_CHAIN_SCHEMA,
    ),
    "balanced_scorecard": (
        BALANCED_SCORECARD_STRUCTURED_SUFFIX,
        "balanced_scorecard", "grounded_balanced_scorecard_analysis", BALANCED_SCORECARD_SCHEMA,
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

        if framework_tag == "tam" and extra_value:
            extra_value = _null_out_unsupported_tam_tiers(extra_value, context_chunks)
        elif framework_tag == "bcg" and extra_value:
            extra_value = _null_out_unsupported_bcg_quadrant(extra_value)
        elif framework_tag == "balanced_scorecard" and extra_value:
            extra_value = _null_out_ungrounded_scorecard_metrics(extra_value)

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
        # through to insufficient-data below) or the original weak matches,
        # subject to the hard floor check right below.

    # docs/PHASE_5_SPEC.md C2 hard floor: whatever we ended up with above
    # (untouched local matches, web-retrieval-refreshed matches, or a
    # failed-refresh fallback to the original weak matches) must clear
    # MIN_CONTEXT_SIMILARITY or it's not usable as context, regardless of
    # whether it cleared the lower LIVE_RETRIEVAL_TRIGGER_THRESHOLD bar
    # earlier. This is what actually stops a technically-above-0.35 but
    # topically-wrong chunk (e.g. EV-charging content in a solar report)
    # from reaching generation.
    if chunks:
        best_similarity = max(c["similarity"] for c in chunks)
        if best_similarity < MIN_CONTEXT_SIMILARITY:
            logger.info(
                "run_pipeline: best available similarity for framework=%r still below "
                "MIN_CONTEXT_SIMILARITY (%.4f < %.2f) after retrieval -- discarding as unusable context.",
                framework_tag, best_similarity, MIN_CONTEXT_SIMILARITY,
            )
            chunks = []
        else:
            # Follow-up fix: the floor above only ever checked the BEST
            # similarity in the batch -- once that cleared, every chunk in
            # the list was kept as-is and passed to the LLM together,
            # including individual chunks well below the floor. A report
            # could end up with one genuinely relevant citation plus
            # several weak/off-topic ones reaching generation alongside
            # it. Filter at the individual-chunk level now: the "is this
            # topic covered at all" gate above stays list-level (at least
            # one real match), but only chunks that themselves clear the
            # floor actually reach the LLM as context.
            below_floor = [c for c in chunks if c["similarity"] < MIN_CONTEXT_SIMILARITY]
            if below_floor:
                logger.info(
                    "run_pipeline: dropping %d/%d chunk(s) below MIN_CONTEXT_SIMILARITY for "
                    "framework=%r (best=%.4f clears the floor; dropped similarities=%s).",
                    len(below_floor), len(chunks), framework_tag, best_similarity,
                    [round(c["similarity"], 4) for c in below_floor],
                )
            chunks = [c for c in chunks if c["similarity"] >= MIN_CONTEXT_SIMILARITY]

    result = await generate_with_citations(query, chunks, framework_tag=framework_tag)
    verification = verify_claims(result["text"], result["citations"])
    return {**result, "verification": verification}
