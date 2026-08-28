"""
Phase 2 of docs/BUSINESS_METRICS_SPEC.md: synthesizes the 5 business-judgment
cards (Market Size, Competitive Pressure, Best Customer Segment, Business
Model Fit, Risk Flags) shown as a row above the framework panels.

Per the confirmed decisions in that spec:
- Score semantics: no numeric score is asked of (or fabricated by) the LLM.
  Cards carry a qualitative label + one-sentence grounded rationale +
  citation; any /10-style meter is computed frontend-side from real
  citation/verification signals, same pattern as stats.avgSimilarity.
- Missing-data: a card whose source framework wasn't requested (or wasn't
  usably grounded) resolves to None here -- the frontend renders a "Not
  enough data" state for it, never a guess.

No new retrieval happens here. This reuses the already-generated,
already-cited prose each framework's run_pipeline() call produced -- one
additional grounded LLM call for the 4 synthesis cards, fed those finished
texts (each with its own [N] citation markers already in it). Market Size
is derived deterministically from Phase 1's market_sizing.tam instead of
re-asking the LLM for a number we already have as real structured data.
"""

import json
import logging

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

CHAT_MODEL = "gpt-4o-mini"

# card -> ordered tuple of candidate frameworks, tried in priority order
# until one is usable. market_size is deliberately absent here -- it's
# handled separately below, not synthesized by the LLM.
#
# GitHub issue #11: competitive_pressure's original (pestel, swot) pair
# predates Porter's Five Forces existing at all -- now that it's a real
# framework, it's the more direct source for competitive pressure
# specifically (that's the entire framework's subject), so it leads;
# pestel/swot stay as fallbacks for reports that didn't request porter.
CARD_FRAMEWORK_MAP = {
    "competitive_pressure": ("porter", "pestel", "swot"),
    # GitHub issue #12: same reasoning as competitive_pressure above --
    # STP's segmentation/targeting categories are literally about
    # customer segments, more direct than BMC's own customer_segments
    # block. Leads now that it's real; bmc/swot stay as fallbacks.
    "customer_segment": ("stp", "bmc", "swot"),
    # GitHub issue #14: Value Chain's operations/procurement/etc.
    # categories are a reasonable fallback for business model fit when
    # BMC itself didn't come back usable -- added as fallback only, BMC
    # still leads since it's the more direct fit.
    "business_model_fit": ("bmc", "value_chain"),
    "risk_flags": ("swot", "pestel"),
}

SYNTHESIS_SYSTEM_PROMPT = """You are a business-analysis assistant synthesizing short qualitative judgments from already-completed framework analyses. You are not retrieving new information -- only reading the section text(s) provided below.

Rules you must follow strictly:
1. Only use facts stated in the provided section text(s) below. Do not use outside knowledge.
2. For each requested card, provide: a short label (2-4 words, e.g. "Moderate", "Eco-conscious Millennials", "Strong"), a one-sentence rationale grounded in the text, and a citation_index -- the number of a [N] citation marker that ALREADY appears in that card's section text and supports your judgment, or null if you can't tie it to one specific marker.
3. Each section below is numbered independently -- its [N] markers refer only to that section's own citations, not a global numbering across sections.
4. If a card's section text doesn't contain enough information to form that specific judgment, return null for that entire card. Do not guess.
5. Do not invent a numeric score. Only label, rationale, citation_index.
"""

BUSINESS_METRIC_ITEM_SCHEMA = {
    "anyOf": [
        {
            "type": "object",
            "properties": {
                "label": {"type": "string"},
                "rationale": {"type": "string"},
                "citation_index": {"type": ["integer", "null"]},
            },
            "required": ["label", "rationale", "citation_index"],
            "additionalProperties": False,
        },
        {"type": "null"},
    ]
}

BUSINESS_METRICS_SCHEMA = {
    "type": "object",
    "properties": {card: BUSINESS_METRIC_ITEM_SCHEMA for card in CARD_FRAMEWORK_MAP},
    "required": list(CARD_FRAMEWORK_MAP),
    "additionalProperties": False,
}


def _usable(framework: str | None, results: dict, allowed: list[str]) -> bool:
    # Same has-real-grounding check used elsewhere in this pipeline
    # (run_pipeline()'s is_empty check): a framework only counts as usable
    # source material if it was actually requested AND actually retrieved
    # something to cite -- not just present in the dict.
    return bool(framework) and framework in allowed and bool((results.get(framework) or {}).get("citations"))


def _empty_result() -> dict:
    return {key: None for key in ("market_size", *CARD_FRAMEWORK_MAP)}


async def synthesize_business_metrics(idea: str, results: dict, allowed: list[str]) -> dict:
    card_framework = {}
    for card, candidates in CARD_FRAMEWORK_MAP.items():
        card_framework[card] = next(
            (fw for fw in candidates if _usable(fw, results, allowed)),
            None,  # no candidate usable -> missing-data, no LLM call for this card
        )

    business_metrics = _empty_result()
    business_metrics["market_size"] = _derive_market_size(results, allowed)

    frameworks_needed = sorted({fw for fw in card_framework.values() if fw})
    if not frameworks_needed:
        logger.info("synthesize_business_metrics: no usable framework data for any card, skipping LLM call.")
        return business_metrics

    sections = []
    for fw in frameworks_needed:
        cards_from_fw = [c for c, f in card_framework.items() if f == fw]
        sections.append(f"[{fw.upper()} TEXT -- source for: {', '.join(cards_from_fw)}]\n{results[fw]['text']}")
    user_content = f"IDEA: {idea}\n\n" + "\n\n".join(sections)

    try:
        completion = await client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "business_metrics", "strict": True, "schema": BUSINESS_METRICS_SCHEMA},
            },
            temperature=0.2,
        )
        parsed = json.loads(completion.choices[0].message.content)
    except Exception:
        # Never let a synthesis failure break the whole /analyze response --
        # degrade to "not enough data" for every synthesized card, same as
        # a card whose framework simply wasn't requested.
        logger.exception("synthesize_business_metrics: LLM call failed, degrading all synthesized cards to null.")
        return business_metrics

    for card, fw in card_framework.items():
        if not fw:
            continue  # already None in business_metrics -- no context was given for this card, nothing to trust from the model either way
        raw = parsed.get(card)
        if not raw:
            continue
        citation_index = raw.get("citation_index")
        max_index = len(results[fw]["citations"])
        if citation_index is not None and not (1 <= citation_index <= max_index):
            # Never trust the model's index blindly for downstream lookups.
            citation_index = None
        business_metrics[card] = {
            "label": raw["label"],
            "rationale": raw["rationale"],
            "citation_index": citation_index,
            "source_framework": fw,
        }

    return business_metrics


def _derive_market_size(results: dict, allowed: list[str]) -> dict | None:
    if "tam" not in allowed:
        return None
    tam_tier = ((results.get("tam") or {}).get("market_sizing") or {}).get("tam")
    if not tam_tier:
        return None
    return {
        "label": tam_tier["label"],
        "rationale": f"Total addressable market estimated at {tam_tier['label']}.",
        "citation_index": tam_tier.get("citation_index"),
        "source_framework": "tam",
    }
