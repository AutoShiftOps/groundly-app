"""
The repair pass (unify/2c-claim-quality, item 2): for a framework whose
verifier run left one or more fact claims unsupported or partially
supported, make ONE LLM call that, for each failing claim, either
rewrites it to state only what the cited chunk says, converts it to an
uncited analysis point (dropping any figure/percentage/company name),
or drops it outright. Never introduces a new figure or citation that
wasn't already in the cited chunk text -- enforced deterministically
below, not just asked for in the prompt. Runs at most once per
framework per request; the verifier then re-runs in full on the
repaired output, and THAT is the verification actually returned.
"""

import logging
import re

from agents import claim_verifier
from agents import llm_provider

logger = logging.getLogger(__name__)

REPAIR_MODEL = "gpt-4o-mini"

# Locator kinds whose underlying value is a single numeric/categorical
# judgment (a tam/sam/som tier's dollar figure, or a bcg/ansoff
# quadrant's whole object) rather than free qualitative text. Neither
# has a claim_type field or an "analysis" variant (see
# agents/claim_verifier.py's extract_structured_claims docstring), and
# there's no safe way to partially rewrite a wrong NUMBER or QUADRANT
# without either inventing a new figure or leaving the old, unverified
# one in place -- so these are always dropped outright, never rewritten
# or converted, regardless of what the repair LLM suggests.
_NUMERIC_ONLY_LOCATOR_KINDS = {"tam_tier", "single_object"}

_TIER_NOT_FOUND = {
    "value_usd": None, "label": "Not found in sources", "citation_index": None,
    "cagr_pct": None, "tier_description": None,
}

_REPAIR_SYSTEM_PROMPT = """You repair failing claims in a grounded business-analysis report.

Each FAILING CLAIM below was marked unsupported or partially supported
by a fact-checker, with its reason and the exact text of the chunk(s)
it cited. For each one, choose exactly one action:

- "rewrite": restate the claim so it says ONLY what the cited chunk
  text actually states -- same topic, corrected to match the source.
  Never add a number, percentage, date, or company name that isn't
  already in the cited chunk text given.
- "convert_to_analysis": turn it into a general, qualitative judgment
  with NO figures, percentages, or named companies at all -- useful
  when the claim's specific number/fact isn't really in the source but
  the general point is still reasonable as the analyst's own inference.
- "drop": remove the claim entirely (set new_text to null) -- use this
  when neither of the above is honestly possible from the cited text.

Never invent a new figure, percentage, date, or citation under any
circumstance. Return one action per claim, in the same order given,
using each claim's claim_index exactly as given.
"""

_REPAIR_SCHEMA = {
    "type": "object",
    "properties": {
        "repairs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim_index": {"type": "integer"},
                    "action": {"type": "string", "enum": ["rewrite", "convert_to_analysis", "drop"]},
                    "new_text": {"type": ["string", "null"]},
                },
                "required": ["claim_index", "action", "new_text"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["repairs"],
    "additionalProperties": False,
}


def _render_failing_claim(claim_index: int, claim: dict, context_chunks: list) -> str:
    resolved_chunks = claim_verifier._chunks_for_claim(claim, context_chunks)
    chunk_text = "\n---\n".join((c.get("chunk_text") or "") for c in resolved_chunks) or "(cited chunk not found)"
    return (
        f"CLAIM {claim_index}: {claim['text']}\n"
        f"REASON IT FAILED: {claim['reason']}\n"
        f"CITED SOURCE TEXT:\n{chunk_text}"
    )


async def _call_repair_llm(failing_claims: list[dict], context_chunks: list) -> dict[int, dict]:
    user_content = "\n\n".join(
        _render_failing_claim(i, claim, context_chunks) for i, claim in enumerate(failing_claims)
    )
    parsed = await llm_provider.structured_completion(
        model=REPAIR_MODEL,
        system_prompt=_REPAIR_SYSTEM_PROMPT,
        user_content=user_content,
        schema_name="claim_repair",
        schema=_REPAIR_SCHEMA,
        temperature=0,
    )
    results: dict[int, dict] = {}
    for item in parsed.get("repairs", []):
        claim_index = item.get("claim_index")
        if isinstance(claim_index, int):
            results[claim_index] = {"action": item.get("action"), "new_text": item.get("new_text")}
    return results


def _sanitize_action(claim: dict, action, new_text, context_chunks: list) -> tuple[str, str | None]:
    """Never trust the repair LLM's own compliance -- same philosophy
    as every other deterministic backstop in this codebase. Forces a
    safe fallback ("drop") whenever the suggested action/text would
    violate "never introduce a new figure, percentage, or citation"."""
    locator_kind = claim["locator"]["kind"]
    if locator_kind in _NUMERIC_ONLY_LOCATOR_KINDS:
        return "drop", None
    if action not in ("rewrite", "convert_to_analysis", "drop"):
        return "drop", None
    if action == "drop":
        return "drop", None
    if not isinstance(new_text, str) or not new_text.strip():
        return "drop", None

    cited_text = " ".join((c.get("chunk_text") or "") for c in claim_verifier._chunks_for_claim(claim, context_chunks)).lower()
    new_figures = claim_verifier.DOLLAR_PATTERN.findall(new_text) + claim_verifier.PERCENTAGE_PATTERN.findall(new_text)
    if action == "convert_to_analysis":
        # An analysis point may never carry a figure at all, not even
        # one that's genuinely in the cited chunk -- if it still needs
        # a number, it's a fact and needs a real citation, not this.
        if new_figures or claim_verifier.NAMED_ENTITY_PATTERN.search(new_text):
            return "drop", None
        return "convert_to_analysis", new_text.strip()

    # action == "rewrite": every figure/percentage in the proposed text
    # must already appear verbatim in the cited chunk -- otherwise this
    # would be introducing an unverified number, which is never allowed.
    for figure in new_figures:
        if figure.lower() not in cited_text:
            return "drop", None
    return "rewrite", new_text.strip()


def _strip_citation_markers(text: str) -> str:
    return re.sub(r"\s*\[\d+\]", "", text).strip()


def _apply_action(generated_text: str, extra_value, claim: dict, action: str, new_text: str | None):
    locator = claim["locator"]
    kind = locator["kind"]

    if kind == "narrative":
        sentence = locator["sentence"]
        if action == "drop":
            return generated_text.replace(sentence, "", 1).strip(), extra_value
        replacement = new_text if action == "rewrite" else _strip_citation_markers(new_text)
        return generated_text.replace(sentence, replacement, 1), extra_value

    if kind == "tam_tier":
        extra_value[locator["tier_name"]] = dict(_TIER_NOT_FOUND)
        return generated_text, extra_value

    if kind == "single_object":
        return generated_text, None

    if kind == "category_list":
        category, index = locator["category"], locator["index"]
        items = extra_value.get(category)
        if not isinstance(items, list) or index >= len(items):
            return generated_text, extra_value
        if action == "drop":
            items.pop(index)
        elif action == "convert_to_analysis":
            item = items[index]
            item["text"] = _strip_citation_markers(new_text)
            item["citation_index"] = None
            item["claim_type"] = "analysis"
            for metric_key in ("metric_name", "metric_value", "target_value"):
                if metric_key in item:
                    item[metric_key] = None
        else:  # rewrite
            items[index]["text"] = new_text
        return generated_text, extra_value

    return generated_text, extra_value


async def repair_and_reverify(generated_text: str, citations: list, extra_value, verification: dict,
                               context_chunks: list) -> dict:
    """If `verification` already has no failing fact claims, returns it
    (and the original text/extra_value) unchanged -- no LLM call spent.
    Otherwise runs one repair call, applies the sanitized actions, then
    re-runs the full verifier on the result. That re-verification is
    what's actually returned, in `result["verification"]` -- never the
    pre-repair one. Always returns a dict with keys text, extra_value,
    verification, repair_log."""
    failing = [c for c in verification.get("_fact_claims", []) if c["verdict"] != "supported"]
    claims_before = len(verification.get("_fact_claims", []))
    supported_before = claims_before - len(failing)

    if not failing:
        return {
            "text": generated_text, "extra_value": extra_value, "verification": verification,
            "repair_log": {
                "claims_before": claims_before, "supported_before": supported_before,
                "supported_after": supported_before, "dropped": 0, "converted": 0, "rewritten": 0,
            },
        }

    try:
        repair_results = await _call_repair_llm(failing, context_chunks)
    except Exception:
        logger.exception("repair_and_reverify: repair LLM call failed -- leaving original verification unchanged.")
        return {
            "text": generated_text, "extra_value": extra_value, "verification": verification,
            "repair_log": {
                "claims_before": claims_before, "supported_before": supported_before,
                "supported_after": supported_before, "dropped": 0, "converted": 0, "rewritten": 0,
            },
        }

    dropped = converted = rewritten = 0
    text = generated_text
    for i, claim in enumerate(failing):
        raw = repair_results.get(i, {"action": "drop", "new_text": None})
        action, new_text = _sanitize_action(claim, raw.get("action"), raw.get("new_text"), context_chunks)
        text, extra_value = _apply_action(text, extra_value, claim, action, new_text)
        if action == "drop":
            dropped += 1
        elif action == "convert_to_analysis":
            converted += 1
        else:
            rewritten += 1

    new_verification = await claim_verifier.verify_claims(text, citations, extra_value, context_chunks=context_chunks)
    supported_after = sum(1 for c in new_verification.get("_fact_claims", []) if c["verdict"] == "supported")

    return {
        "text": text, "extra_value": extra_value, "verification": new_verification,
        "repair_log": {
            "claims_before": claims_before, "supported_before": supported_before,
            "supported_after": supported_after, "dropped": dropped, "converted": converted, "rewritten": rewritten,
        },
    }
