"""
RAG grounding pipeline: retrieve -> generate with citations -> verify claims -> confidence score.
"""

import asyncio
import logging
import re
from typing import Callable

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from openai import AsyncOpenAI
from agents.db import search_similar
from agents import web_retrieval
from agents import mississauga_data
from agents import market_scope
from agents import claim_repair
from agents import llm_provider
from agents import claim_verifier
from agents.claim_verifier import verify_claims  # noqa: F401  module-level name, monkeypatchable on this module

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


# Canonical "unsupported tier" shape -- always an object, never a bare
# None, so the API response can carry an explicit, honest label instead
# of leaving the frontend to invent its own placeholder text for a
# missing tier. A directory citation (agents/mississauga_data.py) never
# contains a dollar figure, so a tam/sam/som tier can never legitimately
# attribute itself to one -- it always lands here in that case, exactly
# as intended ("never attach a figure to a citation that doesn't contain
# it").
_TIER_NOT_FOUND = {
    "value_usd": None,
    "label": "Not found in sources",
    "citation_index": None,
    "cagr_pct": None,
    "tier_description": None,
}


def _null_out_unsupported_tam_tiers(market_sizing: dict, context_chunks: list,
                                     specific_category: str | None = None,
                                     parent_category: str | None = None) -> dict:
    """
    Deterministic backstop, not a rewrite of the model's own reasoning:
    for each tam/sam/som tier the model populated, confirm the chunk it
    cited as citation_index actually contains a real dollar figure or
    percentage, AND that the tier's own description actually matches the
    idea's classified market category (specific_category/parent_category,
    from _classify_tam_market_category()) rather than a whole sector --
    confirmed live: a real, well-cited "entire U.S. software market"
    figure was accepted as TAM for a tax-prep-for-freelancers idea before
    this check existed. If either check fails, or if the model left the
    tier null outright, normalize it to _TIER_NOT_FOUND -- same null-
    when-ungrounded discipline as everywhere else in this schema, just
    always expressed as an object with an explicit label rather than a
    bare None.

    Citations themselves and the narrative text are untouched by this: a
    numeric-free chunk can still be real, legitimate supporting context
    for the prose (e.g. explaining what a market covers), it's just not a
    valid basis for a specific tam/sam/som dollar value. A tier whose
    citation_index is null (the model legitimately couldn't attribute the
    figure to one specific chunk -- an existing, separate allowance in
    this schema, see TAM_STRUCTURED_SUFFIX) is left as-is for the
    numeric-figure check (nothing to look up), but the category-fit check
    still applies to it -- an unattributed sector-level figure is exactly
    as much of a mismatch as an attributed one.
    """
    validated = {}
    for tier in ("tam", "sam", "som"):
        tier_value = market_sizing.get(tier)
        if tier_value is None:
            validated[tier] = dict(_TIER_NOT_FOUND)
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
            validated[tier] = dict(_TIER_NOT_FOUND)

    for tier in ("tam", "sam", "som"):
        tier_value = validated.get(tier)
        if not isinstance(tier_value, dict) or tier_value.get("value_usd") is None:
            continue
        if not _tier_matches_idea_category(tier_value.get("tier_description"), specific_category, parent_category):
            logger.info(
                "generate_with_citations: tam tier=%r failed market-fit check (description=%r vs "
                "specific_category=%r, parent_category=%r) -- rejecting as a sector-level/"
                "mismatched figure (was: %r).",
                tier, tier_value.get("tier_description"), specific_category, parent_category, tier_value,
            )
            validated[tier] = dict(_TIER_NOT_FOUND)

    _strip_citation_from_labeled_estimates(validated)
    return validated


def _strip_citation_from_labeled_estimates(validated_market_sizing: dict) -> None:
    """Mutates sam/som in place: a tier the model labeled as a narrowed/
    scaled estimate (TAM_STRUCTURED_SUFFIX instructs it to put the word
    "estimate" in tier_description when doing this, e.g. "Mississauga SAM
    estimate, scaled from national figure") must never also carry a
    citation_index -- that would misrepresent a derived number as
    directly sourced from whatever chunk citation_index points at. This
    is deterministic and doesn't trust the model's own compliance: it
    strips citation_index on sight whenever "estimate" appears in the
    tier's own description, regardless of what citation_index the model
    actually returned. TAM itself is never touched -- it's the base
    figure, never a narrowed one.
    """
    for tier in ("sam", "som"):
        tier_value = validated_market_sizing.get(tier)
        if not isinstance(tier_value, dict):
            continue
        description = (tier_value.get("tier_description") or "")
        if "estimate" in description.lower() and tier_value.get("citation_index") is not None:
            logger.info(
                "generate_with_citations: tam tier=%r labeled as an estimate (%r) but had a "
                "citation_index -- stripping it so it can't look directly sourced.",
                tier, description,
            )
            tier_value["citation_index"] = None


def _cap_assumptions_actions(value) -> list[str]:
    # Enforced deterministically here rather than via schema constraint
    # (OpenAI's strict structured-output mode doesn't support minItems/
    # maxItems) -- the prompt asks for 2-3 items; this only ever trims an
    # overlong list down to 3. It never pads a short list, since there's
    # no real content to pad it WITH -- 0 or 1 real items is just what the
    # model had to say, left as-is rather than fabricated up to a count.
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if isinstance(item, str) and item.strip()][:3]


GROUNDING_SYSTEM_PROMPT = """You are a grounded business-analysis assistant.

Rules you must follow strictly:
1. Only use facts present in the provided CONTEXT below. Never use outside knowledge for market data, statistics, or claims.
2. Every factual sentence must end with a citation marker like [1], [2] referring to the numbered context chunk it came from.
3. If the CONTEXT is relevant to the topic but only partially covers it, write the analysis using what IS supported by the CONTEXT — cite each supported claim. This is the PREFERRED response whenever the CONTEXT contains any usable, on-topic facts. Only respond "Insufficient grounded data available for this section" if the CONTEXT is genuinely unrelated to the topic or contains no usable facts at all — never because it merely fails to cover every angle.
4. Do not fabricate numbers, company names, or sources under any circumstance.
5. Write as a confident, specific business analyst, not a generic summary generator — lead sentences with the conclusion, not the setup; use concrete numbers over vague qualifiers where the CONTEXT supports them. This rule is about register only — it never overrides rules 1-4.
6. NEVER write a sentence in the narrative (or in any structured point) that just points out what the CONTEXT doesn't cover -- no "the context does not provide...", "no data is available on...", "specific figures for X were not found", or similar. If something relevant is genuinely missing, that's real information too, but it belongs in the "assumptions" list below as something the founder should go validate -- phrased as an action ("Validate X with primary research," not "The context doesn't say X") -- never as a sentence inside the narrative or a structured point.
"""

# Every structured framework also gets assumptions/actions -- 2-3 short
# items each, appended as a shared suffix on top of whatever framework-
# specific suffix it already has, and merged into every schema via
# _with_assumptions_actions() below. Deliberately instructed to be
# specific to THIS idea's actual analysis, not generic startup advice:
# the two fields previously shipped on the frontend (removed in the
# unify/1-frontend port) always fell back to the exact same two canned
# bullets for every single idea, since the backend never generated real
# ones -- this is what makes them real instead of reintroducing that.
ASSUMPTIONS_ACTIONS_SUFFIX = """
Additionally, populate two more fields:
- "assumptions": 2-3 short, specific assumptions a founder should
  validate before trusting this section's conclusions -- grounded in
  gaps, uncertainties, or unstated conditions the CONTEXT itself reveals
  for THIS specific idea. Never generic startup-advice boilerplate that
  could apply to any venture (e.g. not "customers will want this").
- "actions": 2-3 short, specific next steps grounded in what THIS
  framework's analysis actually found for THIS idea -- each action
  should clearly follow from a point made in the narrative above, not a
  generic recommendation that could apply to any venture.
"""

# OpenAI's strict structured-output mode doesn't support minItems/maxItems
# -- the "2-3 items" constraint lives in the prompt suffix above, not the
# schema; _null_out_assumptions_actions_count() below enforces it
# deterministically on the response instead.
_ASSUMPTIONS_ACTIONS_SCHEMA_PROPS = {
    "assumptions": {"type": "array", "items": {"type": "string"}},
    "actions": {"type": "array", "items": {"type": "string"}},
}


# unify/2c-claim-quality: every cited/structured point must now declare
# whether it's a "fact" (something the CONTEXT states -- must carry a
# real citation_index the verifier can check) or "analysis" (the
# analyst's own judgment/inference -- must carry citation_index=null
# and must never contain a figure, percentage, or named company; if it
# does, it's a fact in disguise and needs a real source instead).
# Applied once, globally, exactly like ASSUMPTIONS_ACTIONS_SUFFIX --
# every structured framework gets the same rule rather than 10 hand-
# copied explanations. agents/claim_verifier.py enforces both halves:
# fact claims go through the real LLM verifier as before; analysis
# claims are only checked for the "no hidden facts" rule.
CLAIM_TYPE_SUFFIX = """
Every point/tier you populate (including market_sizing tiers, matrix
quadrants, and every category point) must also set "claim_type" to
either "fact" or "analysis":
- "fact": this point states something the CONTEXT explicitly says. It
  MUST have a real citation_index pointing at the chunk that states it
  -- never citation_index: null for a fact.
- "analysis": this is your own judgment, inference, or synthesis, not
  something the CONTEXT directly states. It MUST have
  citation_index: null, and its text must NEVER contain a dollar
  figure, a percentage, or a named company/competitor -- if you want to
  include one of those, it's a fact and needs a real citation instead,
  not an analysis point dressed up to avoid sourcing it.
"""

_CLAIM_TYPE_SCHEMA_PROP = {"claim_type": {"type": "string", "enum": ["fact", "analysis"]}}


def _with_assumptions_actions(schema: dict) -> dict:
    """Merges the shared assumptions/actions array fields into a
    framework's top-level structured-output schema (alongside "narrative"
    and its own extra field) -- every real framework gets both, not a
    hand-copied pair of fields per schema."""
    merged = dict(schema)
    merged["properties"] = {**schema["properties"], **_ASSUMPTIONS_ACTIONS_SCHEMA_PROPS}
    merged["required"] = [*schema["required"], "assumptions", "actions"]
    return merged

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
- "tier_description" is a short (3-10 word) phrase describing what this
  specific tier represents for THIS idea's actual market, drawn from what
  the CONTEXT actually says about it -- not a generic definition of what
  TAM/SAM/SOM means in the abstract. It MUST state the figure's real
  geography/scope AND year/period exactly as the CONTEXT gives them, e.g.
  "Canada catering services market, 2025" or "Global sustainable
  packaging market, 2024" -- never a vaguer phrase than the source
  actually supports, and never a geography the source doesn't state.
  Only fill it in if the CONTEXT supports a specific description for
  that tier; otherwise null. Note whether a figure is a future
  projection per the rule above.
- CRITICAL -- never silently narrow a broader figure down to a smaller
  geography. If the CONTEXT only gives a national/regional/global dollar
  figure and you want to note what a narrower, local-geography estimate
  might be (e.g. scaling a Canada-wide figure down toward Mississauga),
  that is NOT a sourced tier value: do not put it in sam or som with a
  citation_index. Instead:
  (a) leave that tier null (this is the PREFERRED outcome -- an honest
      gap beats an unlabeled estimate), OR
  (b) if you do want to surface the estimate, put the SAM/SOM dollar
      value in the tier as usual but set "citation_index" to null (never
      attribute a derived/scaled number to the broader source it was
      scaled from) and make "tier_description" literally include the
      word "estimate" (e.g. "Mississauga SAM estimate, scaled from
      national figure"), and add the scaling assumption you used (e.g.
      the population or revenue share you scaled by) as one of the
      "assumptions" entries below.
  A tier narrowed this way must never look identical to a directly
  sourced one -- the "estimate" label and the null citation_index are
  both required together, not optional extras.
"""


def _tam_market_fit_suffix(specific_category: str | None, parent_category: str | None) -> str:
    # Dynamic, per-request addition to TAM_STRUCTURED_SUFFIX -- the
    # category names come from _classify_tam_market_category() below
    # and can't be baked into the static suffix. Confirmed live this
    # was needed: without it, a real, well-cited whole-sector figure
    # (e.g. "the entire U.S. software market") got accepted as TAM for
    # an idea that was really just one narrow slice of that sector
    # (tax-prep software for freelancers) -- real and cited, but not
    # this idea's market. Enforced again deterministically afterward
    # (_null_out_unsupported_tam_tiers' market-fit check), so this
    # instruction is a first pass, not the only guardrail.
    if not specific_category and not parent_category:
        return ""
    return f"""
This idea's addressable market has been classified as:
- Specific category: {specific_category or "not determined"!r}
- Parent category: {parent_category or "not determined"!r}
A tam/sam/som tier may ONLY use a figure whose market is this idea's
specific category or its parent category above -- never a whole
industry/sector figure (e.g. "software", "food services", "retail",
"healthcare") even if it's real, well-cited, and genuinely about this
idea's broader industry. If the CONTEXT only contains sector-level
figures that don't match either category above, leave that tier null
rather than using a mismatched one.
"""


# Generic words that can never, by themselves, count as evidence that a
# tier_description matches (or is specific enough to represent) the
# idea's own market category -- either too generic to mean anything
# ("market", "size", a bare year) or an entire industry/sector name too
# broad to be THIS idea's actual addressable market ("software", "food
# services"). Shared by both the category-fit check (does tier_description
# match the idea's category?) and the market-scope-mismatch check inside
# verify_claims (does the cited chunk actually support what
# tier_description claims?).
def _tier_matches_idea_category(tier_description: str | None, specific_category: str | None,
                                 parent_category: str | None) -> bool:
    # No category could be classified at all -- nothing to enforce
    # against, so don't block (the market-size search itself was
    # already skipped in this case; this only matters for a tier
    # sourced from local/directory context instead).
    if not specific_category and not parent_category:
        return True
    desc_terms = market_scope.significant_terms(tier_description)
    if not desc_terms:
        # A description with nothing specific left after stripping
        # sector-level/generic words IS a bare sector-level description
        # (e.g. "U.S. software market, 2026") -- reject outright, it
        # can't match anything because it doesn't say anything specific.
        return False
    category_terms = market_scope.significant_terms(specific_category) | market_scope.significant_terms(parent_category)
    return bool(desc_terms & category_terms)

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

# GitHub issue #16. Ansoff Matrix classifies growth strategy into one of
# 4 quadrants based on whether this business's product and market are
# each existing or new -- same "don't guess without real dual grounding"
# discipline as BCG Matrix above, just with two categorical dimensions
# (product/market: existing vs new) instead of two numeric ones (growth
# rate/market share). Same anyOf-null schema shape and same
# both-signals-or-nothing backstop pattern.
ANSOFF_QUADRANTS = ("market_penetration", "market_development", "product_development", "diversification")

ANSOFF_STRUCTURED_SUFFIX = """
Additionally, since this is an Ansoff Matrix analysis, also populate the
ansoff_matrix object:
- Only assign a quadrant if the CONTEXT explicitly supports classifying
  BOTH this business's market as "existing" or "new" AND its product/
  service as "existing" or "new", relative to what the business
  described in CONTEXT is actually doing. If either dimension can't be
  determined from the CONTEXT, set ansoff_matrix to null entirely --
  do not guess a quadrant from only one grounded dimension.
- "market_dimension" is "existing" if the CONTEXT describes this
  business selling into a market/customer base it (or the products
  being described) already serves, or "new" if it describes expansion
  into a market/geography/customer segment not currently served.
  Null if the CONTEXT doesn't give enough signal either way.
- "product_dimension" is "existing" if the CONTEXT describes the
  current product/service offering, or "new" if it describes a new or
  substantially different product/service being introduced. Null if
  the CONTEXT doesn't give enough signal either way.
- The four quadrants: market_penetration (existing market + existing
  product), market_development (new market + existing product),
  product_development (existing market + new product), diversification
  (new market + new product). Pick the one matching the two dimensions
  above -- don't pick a quadrant that contradicts them.
- "citation_index" is the number of the CONTEXT chunk that most directly
  supports the quadrant assignment, or null if you can't attribute it to
  one specific chunk.
- "rationale" is a short (1-2 sentence) explanation of why this quadrant
  fits, referencing the real market_dimension and product_dimension
  above -- never invent a justification not grounded in those two
  fields.
"""

ANSOFF_MATRIX_SCHEMA = {
    "type": "object",
    "properties": {
        "narrative": {
            "type": "string",
            "description": "The full grounded analysis, same rules as ungrounded prose output: cite every factual sentence with [N] markers.",
        },
        "ansoff_matrix": {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "quadrant": {"type": "string", "enum": list(ANSOFF_QUADRANTS)},
                        "market_dimension": {"type": ["string", "null"], "enum": ["existing", "new", None]},
                        "product_dimension": {"type": ["string", "null"], "enum": ["existing", "new", None]},
                        "citation_index": {"type": ["integer", "null"]},
                        "rationale": {"type": "string"},
                    },
                    "required": ["quadrant", "market_dimension", "product_dimension", "citation_index", "rationale"],
                    "additionalProperties": False,
                },
                {"type": "null"},
            ]
        },
    },
    "required": ["narrative", "ansoff_matrix"],
    "additionalProperties": False,
}


def _null_out_unsupported_ansoff_quadrant(ansoff_matrix: dict | None) -> dict | None:
    # Same philosophy as _null_out_unsupported_bcg_quadrant: a quadrant
    # assignment is only kept if BOTH market_dimension and
    # product_dimension are one of the two real, non-null values
    # ("existing"/"new") -- otherwise the whole result is nulled.
    if ansoff_matrix is None:
        return None
    has_market_dim = ansoff_matrix.get("market_dimension") in ("existing", "new")
    has_product_dim = ansoff_matrix.get("product_dimension") in ("existing", "new")
    if has_market_dim and has_product_dim:
        return ansoff_matrix
    logger.info(
        "generate_with_citations: ansoff_matrix quadrant=%r lacked real market/product dimension "
        "grounding (market_dimension=%r, product_dimension=%r) -- nulling out as unsupported.",
        ansoff_matrix.get("quadrant"), ansoff_matrix.get("market_dimension"), ansoff_matrix.get("product_dimension"),
    )
    return None

# Phase 3: SWOT/PESTEL/BMC all reduce to the same shape -- a narrative plus
# N named categories, each an array of { text, citation_index } points.
# Built generically instead of writing the same schema 3x with different
# category names.
# unify/2c-claim-quality: claim_type added here (and to
# _METRIC_CATEGORY_ITEM_SCHEMA below) -- scoped to the 7 frameworks
# built from these two generic category-point builders (SWOT, PESTEL,
# BMC, Porter, STP, Value Chain, Balanced Scorecard). TAM/BCG/Ansoff
# deliberately keep their existing, already-stricter numeric-grounding
# backstops (_null_out_unsupported_tam_tiers/_bcg_quadrant/
# _ansoff_quadrant) instead of claim_type -- TAM in particular already
# has its own, more specific fact/estimate distinction (a narrowed SAM/
# SOM estimate legitimately carries a dollar figure with
# citation_index: null, which is exactly what claim_type's "analysis"
# rule would otherwise forbid).
_CATEGORY_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "text": {"type": "string"},
        "citation_index": {"type": ["integer", "null"]},
        **_CLAIM_TYPE_SCHEMA_PROP,
    },
    "required": ["text", "citation_index", "claim_type"],
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
        **_CLAIM_TYPE_SCHEMA_PROP,
    },
    "required": ["text", "citation_index", "metric_name", "metric_value", "target_value", "claim_type"],
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
null, "claim_type": "fact" or "analysis" }}. Only include a point if the
CONTEXT actually supports it -- an empty array for a category is fine
and expected if the CONTEXT doesn't cover it. citation_index is the
number of the CONTEXT chunk (matching the [N] citation markers you use
in narrative) that supports that specific point, or null if you can't
attribute it to one specific chunk.
""" + CLAIM_TYPE_SUFFIX


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
"target_value": "..." or null, "claim_type": "fact" or "analysis" }}.
Only include a point if the CONTEXT actually supports it -- an empty
array for a perspective is fine and expected if the CONTEXT doesn't
cover it. Most points are purely qualitative (leave metric_name/
metric_value/target_value all null) -- only set metric_name AND
metric_value together, and only when the CONTEXT states a real,
specific number for that exact point (e.g. an actual revenue figure,
retention rate, cycle time, or training hours number). Never invent a
plausible-sounding metric or target to fill these fields -- a point
with no real number attached should have all three metric fields
null, not a fabricated one. citation_index is the number of the
CONTEXT chunk (matching the [N] citation markers you use in narrative)
that supports that specific point, or null if you can't attribute it
to one specific chunk.
""" + CLAIM_TYPE_SUFFIX

# framework_tag -> (extra suffix appended to GROUNDING_SYSTEM_PROMPT, the
# extra field name in the parsed response, the json_schema name sent to
# OpenAI, the schema itself). A framework not in this dict (e.g. paid-tier
# frameworks not yet migrated) uses the plain, non-structured path below.
#
# Every entry's suffix gets ASSUMPTIONS_ACTIONS_SUFFIX appended and its
# schema passed through _with_assumptions_actions() -- real per-framework
# assumptions/actions for every structured framework, from one shared
# definition rather than 10 hand-copied pairs of fields.
_RAW_STRUCTURED_FRAMEWORKS = {
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
    "ansoff": (ANSOFF_STRUCTURED_SUFFIX, "ansoff_matrix", "grounded_ansoff_analysis", ANSOFF_MATRIX_SCHEMA),
}

STRUCTURED_FRAMEWORKS = {
    framework: (suffix + ASSUMPTIONS_ACTIONS_SUFFIX, field_name, schema_name, _with_assumptions_actions(schema))
    for framework, (suffix, field_name, schema_name, schema) in _RAW_STRUCTURED_FRAMEWORKS.items()
}


# Replaces the old keyword-table category mapping (SECTOR_MAP-style
# lookup) for TAM market-size search specifically -- a keyword table
# mapped "freelancer tax app" to the bare sector "software", which is
# real but too broad to be this idea's actual market (confirmed live:
# TAM = the entire $921B U.S. software market before this existed). One
# small, cheap, temperature-0 structured call instead, asked for the
# most specific category an analyst would search for plus one broader
# parent -- never a bare whole-sector name for either.
_MARKET_CATEGORY_SYSTEM_PROMPT = """You classify a business idea into market-research category names, for a TAM (total addressable market) search.

Rules:
1. "specific_category" is the most specific market category name a market-research analyst would search for to size THIS idea's actual addressable market -- e.g. "tax preparation software for freelancers", "meal subscription / home catering", "peer-to-peer music equipment rental".
2. "parent_category" is ONE broader category immediately above specific_category -- e.g. "tax preparation software", "meal kit delivery", "music equipment rental" -- still narrower than a whole industry.
3. NEVER return a bare whole-industry/sector name alone for either field (e.g. "software", "food services", "retail", "healthcare", "technology", "logistics") -- those are too broad to represent this specific idea's actual market, even though they're real categories.
4. If you genuinely cannot name a sensible category for this idea from the description given, return null for both fields rather than guessing.
"""

_MARKET_CATEGORY_SCHEMA = {
    "type": "object",
    "properties": {
        "specific_category": {"type": ["string", "null"]},
        "parent_category": {"type": ["string", "null"]},
    },
    "required": ["specific_category", "parent_category"],
    "additionalProperties": False,
}


async def _classify_tam_market_category(idea: str | None, industry: str | None,
                                          business_name: str | None) -> dict:
    """Returns {"specific_category": str|None, "parent_category": str|None,
    "provider_used": str|None}. Never raises -- a classification
    failure degrades to no category (market-size search is skipped
    entirely in that case, not a crash)."""
    user_content = "IDEA: " + " | ".join(filter(None, [
        idea,
        f"industry: {industry}" if industry else None,
        f"business name: {business_name}" if business_name else None,
    ]))
    if not user_content.strip() or user_content.strip() == "IDEA:":
        return {"specific_category": None, "parent_category": None, "provider_used": None}
    try:
        parsed, provider = await llm_provider.structured_completion(
            model=CHAT_MODEL,
            system_prompt=_MARKET_CATEGORY_SYSTEM_PROMPT,
            user_content=user_content,
            schema_name="market_category",
            schema=_MARKET_CATEGORY_SCHEMA,
            temperature=0,
            task="writing",
        )
        return {
            "specific_category": parsed.get("specific_category") or None,
            "parent_category": parsed.get("parent_category") or None,
            "provider_used": provider,
        }
    except Exception:
        logger.exception(
            "_classify_tam_market_category: LLM call failed for idea=%r -- degrading to no category "
            "(market-size search will be skipped).",
            idea,
        )
        return {"specific_category": None, "parent_category": None, "provider_used": None}


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


def _collect_citation_indices(value) -> set[int]:
    """Recursively collects every real (non-null) citation_index found
    anywhere inside a parsed structured-output value (market_sizing,
    pestel_analysis, bcg_matrix, ...) -- used to find citations referenced
    ONLY via a structured field, not just inline [N] markers in the
    narrative text."""
    indices: set[int] = set()
    if isinstance(value, dict):
        idx = value.get("citation_index")
        if isinstance(idx, int):
            indices.add(idx)
        for v in value.values():
            indices |= _collect_citation_indices(v)
    elif isinstance(value, list):
        for item in value:
            indices |= _collect_citation_indices(item)
    return indices


def _filter_referenced_citations(citations: list, text: str, extra_value=None) -> list:
    # A framework's citations list previously included every chunk it was
    # GIVEN as context, regardless of whether the model's narrative or
    # structured output actually cited it -- a chunk the model silently
    # ignored still showed up in Sources & Citations as if it had been
    # used. Keep only citations the output actually references: an
    # inline [N] marker in the narrative, or a citation_index anywhere in
    # the structured field (TAM tiers, category points, etc.).
    referenced = {int(m) for m in re.findall(r"\[(\d+)\]", text)}
    referenced |= _collect_citation_indices(extra_value)
    return [c for c in citations if c["index"] in referenced]


async def generate_with_citations(query: str, context_chunks: list, framework_tag: str | None = None,
                                   extra_context_chunks: list | None = None,
                                   specific_category: str | None = None, parent_category: str | None = None):
    all_chunks = [*context_chunks, *(extra_context_chunks or [])]
    if not all_chunks:
        return {
            "text": "Insufficient grounded data available for this section.",
            "citations": [],
            "assumptions": [],
            "actions": [],
            "provider_used": None,
        }

    context_block = "\n\n".join(
        f"[{i+1}] {c['chunk_text']} (source: {c.get('source_title') or c.get('source_url', 'unknown')})"
        for i, c in enumerate(all_chunks)
    )

    citations = [
        {
            "index": i + 1,
            "source_url": c.get("source_url"),
            "source_title": c.get("source_title"),
            "confidence_score": c.get("confidence_score"),
            # Real pgvector cosine score for vector-retrieved chunks (local
            # corpus or web-retrieval content re-matched after ingestion);
            # explicitly None for directory citations (agents/
            # mississauga_data.py), which never go through pgvector --
            # never synthesized here either way.
            "similarity": c.get("similarity"),
        }
        for i, c in enumerate(all_chunks)
    ]

    structured = STRUCTURED_FRAMEWORKS.get(framework_tag)
    user_content = f"CONTEXT:\n{context_block}\n\nQUESTION:\n{query}"

    if structured:
        suffix, field_name, schema_name, schema = structured
        system_prompt = GROUNDING_SYSTEM_PROMPT + suffix
        if framework_tag == "tam":
            system_prompt += _tam_market_fit_suffix(specific_category, parent_category)
        try:
            parsed, provider_used = await llm_provider.structured_completion(
                model=CHAT_MODEL, system_prompt=system_prompt, user_content=user_content,
                schema_name=schema_name, schema=schema, temperature=0.2, task="writing",
            )
            text = parsed["narrative"]
            extra_value = parsed[field_name]
            assumptions = _cap_assumptions_actions(parsed.get("assumptions"))
            actions = _cap_assumptions_actions(parsed.get("actions"))
        except Exception:
            # Should not happen under strict schema mode, but this must never
            # crash the request -- degrade to the same shape a non-structured
            # response has (no extra field) rather than raising.
            logger.exception("generate_with_citations: structured %r generation call failed.", framework_tag)
            text = "Insufficient grounded data available for this section."
            extra_value = None
            assumptions = []
            actions = []
            provider_used = None

        if framework_tag == "tam" and extra_value:
            extra_value = _null_out_unsupported_tam_tiers(extra_value, all_chunks, specific_category, parent_category)
        elif framework_tag == "bcg" and extra_value:
            extra_value = _null_out_unsupported_bcg_quadrant(extra_value)
        elif framework_tag == "balanced_scorecard" and extra_value:
            extra_value = _null_out_ungrounded_scorecard_metrics(extra_value)
        elif framework_tag == "ansoff" and extra_value:
            extra_value = _null_out_unsupported_ansoff_quadrant(extra_value)

        filtered_citations = _filter_referenced_citations(citations, text, extra_value)
        return {
            "text": text, "citations": filtered_citations, "assumptions": assumptions, "actions": actions,
            field_name: extra_value, "provider_used": provider_used,
        }

    try:
        text, provider_used = await llm_provider.text_completion(
            model=CHAT_MODEL, system_prompt=GROUNDING_SYSTEM_PROMPT, user_content=user_content, temperature=0.2,
            task="writing",
        )
    except Exception:
        logger.exception("generate_with_citations: plain %r generation call failed.", framework_tag)
        text = "Insufficient grounded data available for this section."
        provider_used = None
    filtered_citations = _filter_referenced_citations(citations, text, None)
    return {"text": text, "citations": filtered_citations, "assumptions": [], "actions": [], "provider_used": provider_used}


async def classify_market_category(idea, industry, business_name) -> dict:
    """Public entry point for TAM's market-category classification, so a
    caller can start it before the framework pipelines and report it as
    its own step. Same never-raises contract as the private helper."""
    return await _classify_tam_market_category(idea, industry, business_name)


async def run_pipeline(
    query: str, framework_tag: str | None = None, directory_context: dict | None = None,
    idea: str | None = None, industry: str | None = None, business_name: str | None = None,
    geography: str | None = None, market_category: dict | None = None,
    on_progress: Callable[[str], None] | None = None,
):
    # on_progress(step) is called exactly once per step this framework
    # actually finished -- "searching" (retrieval done), "writing"
    # (generation done), "checking" (verification + repair done) -- even
    # when the step's result is a failure (e.g. insufficient data); the
    # returned result carries that real state. An exception skips every
    # later call. market_category: a classify_market_category() result
    # computed by the caller (tam only); classified here when omitted.
    def report(step: str) -> None:
        if on_progress:
            on_progress(step)

    # directory_context (agents/mississauga_data.py's query_directory()
    # result, computed once per /api/analyze request, not once per
    # framework) is purely ADDITIVE context -- appended to the generation
    # context below alongside whatever pgvector/web-retrieval chunks this
    # framework ends up with. It never participates in the similarity-
    # threshold math (it has no pgvector score at all) and it must never
    # suppress the web-retrieval fallback: a directory hit (e.g. "this
    # business is in the food-service sector") says nothing about whether
    # THIS framework's own topic (e.g. TAM dollar figures) is actually
    # covered, so the empty/weak decision below is local-similarity-only,
    # exactly as it is on main.
    # is_directory=True is a marker for agents/claim_verifier.py: a
    # directory citation never carries a dollar figure or market-size
    # data, so a claim whose only support is a directory chunk can never
    # legitimately back a market-size claim (see claim_verifier's
    # directory-citation override) -- regardless of what the LLM
    # verifier itself concludes.
    directory_chunks = [
        {**citation, "chunk_text": citation.get("snippet") or "", "is_directory": True}
        for citation in (directory_context or {}).get("citations", [])
    ]

    # Classified once per tam run (regardless of whether web retrieval
    # ends up running at all) -- it gates both the market-size search
    # queries below AND the market-fit check inside
    # _null_out_unsupported_tam_tiers()/verify_claims(), which must
    # apply to ANY tam tier, not just one sourced from a market-size
    # web search (a local-corpus or directory chunk could just as
    # easily carry a sector-level figure that doesn't fit this idea).
    specific_category: str | None = None
    parent_category: str | None = None
    providers_used: list[str] = []
    if framework_tag == "tam":
        category_result = market_category or await _classify_tam_market_category(idea, industry, business_name)
        specific_category = category_result["specific_category"]
        parent_category = category_result["parent_category"]
        if category_result.get("provider_used"):
            providers_used.append(category_result["provider_used"])
        logger.info(
            "run_pipeline: TAM market category classified as specific=%r, parent=%r for idea=%r",
            specific_category, parent_category, idea,
        )

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
        #
        # TAM gets dedicated market-size queries instead of the generic
        # analysis query -- the generic query ("<idea> -- TAM/SAM/SOM
        # analysis | geography: X") almost never surfaces real market-
        # size figures via Tavily (confirmed live: a Mississauga catering
        # idea's generic query returned nothing above the similarity
        # floor). Market size is its own well-known search-content type
        # ("<category> market size <country> USD"), one query per
        # classified category (specific first, then parent), capped at 2
        # Tavily calls by web_retrieval.search_and_ingest_market_size
        # itself. If no category could be classified at all, there's
        # nothing sensible to search for -- skip market-size search
        # entirely rather than falling back to a generic/bare-sector
        # guess (the old keyword-table fallback this replaced).
        url_to_query: dict[str, str] = {}
        market_size_result: dict = {"total_chunks": 0, "queries_run": [], "url_to_query": {}}
        if framework_tag == "tam":
            if not specific_category and not parent_category:
                logger.info(
                    "run_pipeline: TAM market-size search skipped for idea=%r -- no category could "
                    "be classified.",
                    idea,
                )
                ingested = 0
            else:
                country = mississauga_data.infer_country_from_geography(geography)
                categories = [c for c in (specific_category, parent_category) if c]
                market_size_result = await web_retrieval.search_and_ingest_market_size(categories, country, framework_tag)
                ingested = market_size_result["total_chunks"]
                url_to_query = market_size_result["url_to_query"]
                logger.info(
                    "run_pipeline: TAM market-size queries run=%r, ingested %d chunk(s) total.",
                    market_size_result["queries_run"], ingested,
                )
        else:
            ingested = await web_retrieval.search_and_ingest(query, framework_tag)

        # unify/3-gemini item 4: one additional retrieval call, on top
        # of the Tavily call(s) above, when the active provider is
        # Gemini -- a Google Search grounding call whose URLs get
        # fetched and ingested through the same path, so they end up
        # as real, checkable chunks, never a citation built straight
        # from groundingMetadata. Reuses whichever query the Tavily
        # path above already ran (the first market-size query for TAM,
        # the generic analysis query otherwise) rather than inventing
        # a third query construction.
        gemini_grounding_query = market_size_result["queries_run"][0] if framework_tag == "tam" and market_size_result["queries_run"] else (query if framework_tag != "tam" else None)
        if gemini_grounding_query and llm_provider.provider_for("writing") == "gemini":
            grounding_result = await web_retrieval.search_and_ingest_gemini_grounding(gemini_grounding_query, framework_tag)
            if grounding_result["total_chunks"] > 0:
                logger.info(
                    "run_pipeline: Gemini grounding query=%r ingested %d chunk(s) for framework=%r.",
                    gemini_grounding_query, grounding_result["total_chunks"], framework_tag,
                )
                ingested += grounding_result["total_chunks"]
                for url in grounding_result["urls_ingested"]:
                    url_to_query[url] = gemini_grounding_query

        if framework_tag == "tam" and ingested > 0:
            # Bug fix: re-searching with `embedding` (the ORIGINAL generic
            # analysis query's embedding) ranks the newly-ingested market-
            # size chunks against a different question than the one that
            # actually found them -- confirmed live twice (best similarity
            # was byte-identical before and after ingestion both times,
            # because the generic-query embedding simply doesn't favor the
            # new pages over the pre-existing generic TAM/SAM/SOM explainer
            # content already in the corpus). Each market-size query that
            # ran gets its OWN embedding and its OWN database search, so
            # its own ingested content actually gets a fair shot at ranking
            # well. Merged with the original (pre-ingestion) results,
            # keeping each physical row's highest similarity across every
            # query it was searched under, top 8 overall.
            candidates_by_id = {c["id"]: c for c in chunks}
            for market_size_query in market_size_result["queries_run"]:
                query_embedding = await embed_query(market_size_query)
                query_results = await _search_similar_chunks(query_embedding, framework_tag=framework_tag)
                top3 = sorted(query_results, key=lambda c: c["similarity"], reverse=True)[:3]
                logger.info(
                    "run_pipeline: TAM market-size query=%r top matches: %s",
                    market_size_query,
                    [(c.get("source_url"), round(c["similarity"], 4)) for c in top3],
                )
                for c in query_results:
                    existing = candidates_by_id.get(c["id"])
                    if existing is None or c["similarity"] > existing["similarity"]:
                        candidates_by_id[c["id"]] = c
            merged = sorted(candidates_by_id.values(), key=lambda c: c["similarity"], reverse=True)[:8]
            # Only replace what we have if the merge actually produced
            # something -- same "don't discard marginal-but-real local
            # matches on an empty re-search" discipline as the non-tam path.
            if merged:
                chunks = merged
                for c in chunks:
                    source = url_to_query.get(c.get("source_url"), "pre-existing corpus / not a market-size web result")
                    logger.info(
                        "run_pipeline: TAM candidate chunk source_url=%r similarity=%.4f came from query=%r",
                        c.get("source_url"), c.get("similarity"), source,
                    )
        elif ingested > 0:
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

    report("searching")

    result = await generate_with_citations(
        query, chunks, framework_tag=framework_tag, extra_context_chunks=directory_chunks,
        specific_category=specific_category, parent_category=parent_category,
    )
    report("writing")
    field_name = STRUCTURED_FRAMEWORKS[framework_tag][1] if framework_tag in STRUCTURED_FRAMEWORKS else None
    extra_value = result.get(field_name) if field_name else None
    generation_provider = result.pop("provider_used", None)
    if generation_provider:
        providers_used.append(generation_provider)
    all_chunks_for_verify = [*chunks, *directory_chunks]
    verification = await verify_claims(result["text"], result["citations"], extra_value, context_chunks=all_chunks_for_verify)
    if verification.get("provider_used"):
        providers_used.append(verification["provider_used"])

    # unify/2c-claim-quality repair pass (extended in unify/3-gemini
    # addendum A to also cover uncited factual sentences generally, not
    # just "gap sentences"): at most one LLM call, when there's either
    # a fact claim the verifier didn't mark "supported", or ANY uncited
    # narrative sentence the verifier flagged as a factual claim. A
    # rewrite/convert/drop/move-to-assumption/add-citation attempt,
    # then a full re-verification of the result (carrying forward the
    # verdict of every claim repair didn't touch). That re-verification
    # is what's actually returned; the pre-repair one never reaches
    # the caller.
    repair_log = None
    has_failing_facts = any(c["verdict"] != "supported" for c in verification.get("_fact_claims", []))
    has_uncited_sentences = bool(verification.get("_uncited_factual"))
    if has_failing_facts or has_uncited_sentences:
        repaired = await claim_repair.repair_and_reverify(
            result["text"], result["citations"], extra_value, verification, all_chunks_for_verify,
            result.get("assumptions") or [],
        )
        result = {**result, "text": repaired["text"], "assumptions": repaired["assumptions"]}
        if field_name:
            result[field_name] = repaired["extra_value"]
        extra_value = repaired["extra_value"]
        verification = repaired["verification"]
        repair_log = repaired["repair_log"]
        if repair_log.get("provider_used"):
            providers_used.append(repair_log["provider_used"])
        if verification.get("provider_used"):
            providers_used.append(verification["provider_used"])
        logger.info(
            "run_pipeline: repair pass for framework=%r -- claims_before=%d supported_before=%d "
            "supported_after=%d dropped=%d converted=%d rewritten=%d moved_to_assumptions=%d added_citation=%d",
            framework_tag, repair_log["claims_before"], repair_log["supported_before"],
            repair_log["supported_after"], repair_log["dropped"], repair_log["converted"], repair_log["rewritten"],
            repair_log["moved_to_assumptions"], repair_log["added_citation"],
        )

    fact_claims = verification.pop("_fact_claims", [])
    verification.pop("_uncited_factual", None)
    analysis_claims = [c for c in verification.get("claims", []) if c.get("claim_type") == "analysis"]
    verification["facts_total"] = len(fact_claims)
    verification["facts_supported"] = sum(1 for c in fact_claims if c["verdict"] == "supported")
    verification["analysis_count"] = len(analysis_claims)
    if repair_log:
        verification["repair_log"] = repair_log
    # unify/3-gemini: one summary per framework across every LLM call
    # run_pipeline made for it (category classification, generation,
    # verification, repair) -- "gemini"/"openai" if every call used the
    # same provider, "mixed" if a fallback happened partway through.
    verification["provider_used"] = llm_provider.overall_provider(providers_used)

    report("checking")
    return {**result, "verification": verification}
