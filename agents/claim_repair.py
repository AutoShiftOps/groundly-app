"""
The repair pass (unify/2c-claim-quality, extended in unify/3-gemini
addendum A): for a framework whose verifier run left one or more fact
claims unsupported/partially supported, OR left uncited factual
sentences (gap sentences, or any other uncited factual-sounding
sentence), make ONE LLM call covering all of them:
- a failing fact claim gets rewritten to match its cited chunk,
  converted to an uncited analysis point, or dropped;
- an uncited sentence gets a real citation added (only if a chunk this
  section was actually given states it), gets converted to analysis,
  or gets dropped;
- a "gap sentence" (one that just says the source doesn't cover
  something) gets moved into "assumptions" instead.
Never introduces a new figure, percentage, or citation that wasn't
already in a real, given chunk -- enforced deterministically below,
not just asked for in the prompt. Runs at most once per framework per
request; the verifier then re-runs on the repaired output (carrying
forward the verdict of every claim repair didn't touch, so an already-
"supported" claim can't flip from a second independent LLM judgment on
the same unchanged text), and THAT re-verification is what's actually
returned.
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

Each FAILING CLAIM below is one of three kinds:

1. A claim marked unsupported or partially supported by a fact-checker,
   with its reason and the exact text of the chunk(s) it cited. Choose
   exactly one action:
   - "rewrite": restate the claim so it says ONLY what the cited chunk
     text actually states -- same topic, corrected to match the
     source. Never add a number, percentage, date, or company name
     that isn't already in the cited chunk text given.
   - "convert_to_analysis": turn it into a general, qualitative
     judgment with NO figures, percentages, or named companies at all
     -- useful when the claim's specific number/fact isn't really in
     the source but the general point is still reasonable as the
     analyst's own inference.
   - "drop": remove the claim entirely (set new_text to null) -- use
     this when neither of the above is honestly possible.

2. An UNCITED SENTENCE -- a factual-sounding sentence with no citation
   marker at all, shown with the full numbered list of chunks
   available to this section. Choose:
   - "add_citation": if (and only if) one of the numbered chunks
     genuinely states this sentence, set citation_index to that
     chunk's number. Never pick a chunk that doesn't actually support
     it, and never invent a chunk number that wasn't given.
   - "convert_to_analysis": same rule as above -- no figures,
     percentages, or named companies.
   - "drop": remove it.

3. A "gap sentence" (marked as such) -- a narrative sentence that just
   points out what the source material doesn't cover, which should
   never have been written into the narrative at all. Choose:
   - "move_to_assumption": rewrite it as a short, specific assumption
     the founder should go validate (an action, e.g. "Validate local
     demand with primary research" -- not "The context doesn't say
     whether..."). Never a figure or citation in this text either.

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
                    "action": {
                        "type": "string",
                        "enum": ["rewrite", "convert_to_analysis", "drop", "move_to_assumption", "add_citation"],
                    },
                    "new_text": {"type": ["string", "null"]},
                    "citation_index": {"type": ["integer", "null"]},
                },
                "required": ["claim_index", "action", "new_text", "citation_index"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["repairs"],
    "additionalProperties": False,
}


def _render_failing_claim(claim_index: int, claim: dict, context_chunks: list) -> str:
    kind = claim["locator"]["kind"]
    if kind == "gap_sentence":
        return f"CLAIM {claim_index} (GAP SENTENCE -- move_to_assumption only): {claim['text']}"
    if kind == "uncited_sentence":
        chunk_list = "\n---\n".join(
            f"[{i + 1}] {c.get('chunk_text') or ''}" for i, c in enumerate(context_chunks)
        ) or "(no chunks available)"
        return (
            f"CLAIM {claim_index} (UNCITED SENTENCE -- add_citation only if one of these chunks "
            f"genuinely states it): {claim['text']}\nAVAILABLE CHUNKS:\n{chunk_list}"
        )
    resolved_chunks = claim_verifier._chunks_for_claim(claim, context_chunks)
    chunk_text = "\n---\n".join((c.get("chunk_text") or "") for c in resolved_chunks) or "(cited chunk not found)"
    return (
        f"CLAIM {claim_index}: {claim['text']}\n"
        f"REASON IT FAILED: {claim['reason']}\n"
        f"CITED SOURCE TEXT:\n{chunk_text}"
    )


async def _call_repair_llm(failing_claims: list[dict], context_chunks: list) -> tuple[dict[int, dict], str]:
    user_content = "\n\n".join(
        _render_failing_claim(i, claim, context_chunks) for i, claim in enumerate(failing_claims)
    )
    parsed, provider = await llm_provider.structured_completion(
        model=REPAIR_MODEL,
        system_prompt=_REPAIR_SYSTEM_PROMPT,
        user_content=user_content,
        schema_name="claim_repair",
        schema=_REPAIR_SCHEMA,
        temperature=0,
        task="checking",
    )
    results: dict[int, dict] = {}
    for item in parsed.get("repairs", []):
        claim_index = item.get("claim_index")
        if isinstance(claim_index, int):
            results[claim_index] = {
                "action": item.get("action"), "new_text": item.get("new_text"),
                "citation_index": item.get("citation_index"),
            }
    return results, provider


def _is_clean_analysis_text(new_text) -> bool:
    return (
        isinstance(new_text, str) and bool(new_text.strip())
        and not claim_verifier.DOLLAR_PATTERN.search(new_text)
        and not claim_verifier.PERCENTAGE_PATTERN.search(new_text)
        and not claim_verifier.NAMED_ENTITY_PATTERN.search(new_text)
    )


def _sanitize_action(claim: dict, action, new_text, citation_index, context_chunks: list) -> tuple[str, str | None, int | None]:
    """Never trust the repair LLM's own compliance -- same philosophy
    as every other deterministic backstop in this codebase. Forces a
    safe fallback ("drop") whenever the suggested action/text would
    violate "never introduce a new figure, percentage, or citation"."""
    locator_kind = claim["locator"]["kind"]

    if locator_kind == "gap_sentence":
        if action != "move_to_assumption" or not _is_clean_analysis_text(new_text):
            # No safe fallback for a gap sentence other than just
            # dropping it from the narrative -- never leave it in
            # place (it would still read as a gap sentence) and never
            # invent a figure-bearing assumption out of it.
            return "drop", None, None
        return "move_to_assumption", new_text.strip(), None

    if locator_kind == "uncited_sentence":
        if action == "add_citation":
            # citation_index must point at a REAL chunk this section
            # was actually given -- never an invented one. The chunk's
            # own text is never guaranteed to genuinely support the
            # sentence by this check alone; that's what the full
            # re-verification LLM call right after repair is for.
            if not isinstance(citation_index, int) or not (1 <= citation_index <= len(context_chunks)):
                return "drop", None, None
            text = new_text.strip() if isinstance(new_text, str) and new_text.strip() else claim["text"]
            cited_text = (context_chunks[citation_index - 1].get("chunk_text") or "").lower()
            new_figures = claim_verifier.DOLLAR_PATTERN.findall(text) + claim_verifier.PERCENTAGE_PATTERN.findall(text)
            for figure in new_figures:
                if figure.lower() not in cited_text:
                    return "drop", None, None
            return "add_citation", text, citation_index
        if action == "convert_to_analysis":
            if not _is_clean_analysis_text(new_text):
                return "drop", None, None
            return "convert_to_analysis", new_text.strip(), None
        return "drop", None, None

    if locator_kind in _NUMERIC_ONLY_LOCATOR_KINDS:
        return "drop", None, None
    if action not in ("rewrite", "convert_to_analysis", "drop"):
        return "drop", None, None
    if action == "drop":
        return "drop", None, None
    if not isinstance(new_text, str) or not new_text.strip():
        return "drop", None, None

    cited_text = " ".join((c.get("chunk_text") or "") for c in claim_verifier._chunks_for_claim(claim, context_chunks)).lower()
    new_figures = claim_verifier.DOLLAR_PATTERN.findall(new_text) + claim_verifier.PERCENTAGE_PATTERN.findall(new_text)
    if action == "convert_to_analysis":
        # An analysis point may never carry a figure at all, not even
        # one that's genuinely in the cited chunk -- if it still needs
        # a number, it's a fact and needs a real citation, not this.
        if not _is_clean_analysis_text(new_text):
            return "drop", None, None
        return "convert_to_analysis", new_text.strip(), None

    # action == "rewrite": every figure/percentage in the proposed text
    # must already appear verbatim in the cited chunk -- otherwise this
    # would be introducing an unverified number, which is never allowed.
    for figure in new_figures:
        if figure.lower() not in cited_text:
            return "drop", None, None
    return "rewrite", new_text.strip(), None


def _strip_citation_markers(text: str) -> str:
    return re.sub(r"\s*\[\d+\]", "", text).strip()


def _append_citation_marker(sentence: str, citation_index: int) -> str:
    """Inserts "[N]" before the sentence's own trailing punctuation
    (".", "!", "?"), not after it -- appending after would put the
    marker in its own fragment once the text is re-split into
    sentences by agents/claim_verifier.py's sentence pattern (which
    splits right after [.!?]), orphaning the marker from the claim it
    was meant to cite."""
    sentence = sentence.rstrip()
    if sentence and sentence[-1] in ".!?":
        return f"{sentence[:-1]} [{citation_index}]{sentence[-1]}"
    return f"{sentence} [{citation_index}]"


def _apply_action(generated_text: str, extra_value, claim: dict, action: str, new_text: str | None,
                   citation_index: int | None = None):
    """Returns (generated_text, extra_value, new_assumption_or_None)."""
    locator = claim["locator"]
    kind = locator["kind"]

    if kind == "gap_sentence":
        sentence = locator["sentence"]
        text = generated_text.replace(sentence, "", 1).strip()
        new_assumption = new_text if action == "move_to_assumption" else None
        return text, extra_value, new_assumption

    if kind == "uncited_sentence":
        sentence = locator["sentence"]
        if action == "drop":
            return generated_text.replace(sentence, "", 1).strip(), extra_value, None
        if action == "add_citation":
            replacement = _append_citation_marker(new_text, citation_index)
            return generated_text.replace(sentence, replacement, 1), extra_value, None
        # convert_to_analysis
        return generated_text.replace(sentence, new_text, 1), extra_value, None

    if kind == "narrative":
        sentence = locator["sentence"]
        if action == "drop":
            return generated_text.replace(sentence, "", 1).strip(), extra_value, None
        replacement = new_text if action == "rewrite" else _strip_citation_markers(new_text)
        return generated_text.replace(sentence, replacement, 1), extra_value, None

    if kind == "tam_tier":
        extra_value[locator["tier_name"]] = dict(_TIER_NOT_FOUND)
        return generated_text, extra_value, None

    if kind == "single_object":
        return generated_text, None, None

    if kind == "category_list":
        category, index = locator["category"], locator["index"]
        items = extra_value.get(category)
        if not isinstance(items, list) or index >= len(items):
            return generated_text, extra_value, None
        if action == "drop":
            # Deferred, not popped here: this loop may process several
            # failing claims from the SAME category list, each with an
            # index computed from the list's ORIGINAL (pre-repair)
            # length. Popping immediately would shift every later
            # index, making a second drop in the same category remove
            # the wrong item (confirmed live: BMC's repair dropped 21
            # claims this way and several originally-targeted items
            # survived untouched while unrelated ones vanished instead).
            # Mark it here; repair_and_reverify removes every marked
            # item per category in one pass, by index descending, after
            # every claim in `failing` has been processed.
            items[index] = None
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
        return generated_text, extra_value, None

    return generated_text, extra_value, None


def _uncited_sentence_claims(verification: dict) -> list[dict]:
    """Every uncited narrative sentence the verifier flagged as a
    factual claim -- a "gap sentence" (is_gap=True, relocated to
    assumptions only) or any other uncited factual-looking sentence
    (is_gap=False, eligible for add_citation/convert_to_analysis/drop)."""
    claims = []
    for uncited in verification.get("_uncited_factual", []):
        is_gap = claim_verifier.is_gap_sentence(uncited["text"])
        kind = "gap_sentence" if is_gap else "uncited_sentence"
        claims.append({
            "text": uncited["text"], "citation_indices": [], "is_tam_tier": False,
            "locator": {"kind": kind, "sentence": uncited["text"]},
        })
    return claims


async def repair_and_reverify(generated_text: str, citations: list, extra_value, verification: dict,
                               context_chunks: list, assumptions: list[str] | None = None) -> dict:
    """If `verification` has no failing fact claims and no uncited
    factual sentences, returns everything unchanged -- no LLM call
    spent. Otherwise runs one repair call covering both, applies the
    sanitized actions, then re-runs the full verifier on the result --
    carrying forward the original verdict for every fact claim repair
    never touched (so an already-"supported" claim can't flip to
    unsupported just from asking the LLM about it a second,
    independent time; confirmed live this really happens). That
    re-verification is what's actually returned, in
    `result["verification"]` -- never the pre-repair one. Always
    returns a dict with keys text, extra_value, assumptions,
    verification, repair_log."""
    assumptions = list(assumptions or [])
    original_facts = verification.get("_fact_claims", [])
    failing_facts = [c for c in original_facts if c["verdict"] != "supported"]
    uncited_claims = _uncited_sentence_claims(verification)
    failing = failing_facts + uncited_claims
    claims_before = len(original_facts)
    supported_before = claims_before - len(failing_facts)

    carry_forward = {
        claim_verifier.locator_key(c): {"verdict": c["verdict"], "reason": c["reason"]}
        for c in original_facts if c["verdict"] == "supported"
    }

    def _unchanged_result(supported_after):
        return {
            "text": generated_text, "extra_value": extra_value, "assumptions": assumptions,
            "verification": verification,
            "repair_log": {
                "claims_before": claims_before, "supported_before": supported_before,
                "supported_after": supported_after, "dropped": 0, "converted": 0, "rewritten": 0,
                "moved_to_assumptions": 0, "added_citation": 0, "provider_used": None,
            },
        }

    if not failing:
        return _unchanged_result(supported_before)

    try:
        repair_results, repair_provider = await _call_repair_llm(failing, context_chunks)
    except Exception:
        logger.exception("repair_and_reverify: repair LLM call failed -- leaving original verification unchanged.")
        return _unchanged_result(supported_before)

    dropped = converted = rewritten = moved_to_assumptions = added_citation = 0
    text = generated_text
    for i, claim in enumerate(failing):
        raw = repair_results.get(i, {"action": "drop", "new_text": None, "citation_index": None})
        action, new_text, citation_index = _sanitize_action(
            claim, raw.get("action"), raw.get("new_text"), raw.get("citation_index"), context_chunks,
        )
        text, extra_value, new_assumption = _apply_action(text, extra_value, claim, action, new_text, citation_index)
        if new_assumption:
            assumptions.append(new_assumption)
            moved_to_assumptions += 1
        elif action == "drop":
            dropped += 1
        elif action == "convert_to_analysis":
            converted += 1
        elif action == "rewrite":
            rewritten += 1
        elif action == "add_citation":
            added_citation += 1
    assumptions = assumptions[:3]

    # Now that every claim in `failing` has been processed, actually
    # remove the category_list items marked None above -- safe to do
    # now since nothing else still refers to these lists by index.
    if isinstance(extra_value, dict):
        for category, items in extra_value.items():
            if isinstance(items, list):
                items[:] = [item for item in items if item is not None]

    new_verification = await claim_verifier.verify_claims(
        text, citations, extra_value, context_chunks=context_chunks, carry_forward=carry_forward,
    )
    supported_after = sum(1 for c in new_verification.get("_fact_claims", []) if c["verdict"] == "supported")

    return {
        "text": text, "extra_value": extra_value, "assumptions": assumptions, "verification": new_verification,
        "repair_log": {
            "claims_before": claims_before, "supported_before": supported_before,
            "supported_after": supported_after, "dropped": dropped, "converted": converted,
            "rewritten": rewritten, "moved_to_assumptions": moved_to_assumptions, "added_citation": added_citation,
            "provider_used": repair_provider,
        },
    }
