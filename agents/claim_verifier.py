"""
The real per-claim verifier for grounded framework output.

Replaces the old heuristics in agents/rag_pipeline.py's verify_claims()
(verified = "at least one citation marker exists somewhere in the
output") with an actual judgment of whether each CITED claim is really
supported by the chunk(s) it cites. Still keeps the cheap deterministic
checks that existed before (numeric-figure presence and category fit
live in rag_pipeline.py's _null_out_unsupported_tam_tiers, applied
before generation; the market-scope word-overlap check lives here as
_tam_tier_scope_mismatch, applied as a first-pass filter before the LLM
call) -- but none of those decide "verified" on their own anymore. One
LLM call per framework does that, given each claim plus the exact text
of the chunk(s) it cites.
"""

import logging
import re

from agents import market_scope
from agents import llm_provider

logger = logging.getLogger(__name__)

VERIFIER_MODEL = "gpt-4o-mini"

_CITATION_MARKER_PATTERN = re.compile(r"\[(\d+)\]")
_SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?])\s+")
_DOLLAR_PATTERN = re.compile(r"\$\s?[\d,]+(?:\.\d+)?")
_PERCENTAGE_PATTERN = re.compile(r"\d+(?:\.\d+)?\s?%")
_NUMBER_PATTERN = re.compile(r"\d")
# Heuristic only: two-or-more consecutive capitalized words, not at the
# very start of the sentence (where capitalization is just grammar, not
# a sign of a named entity) -- good enough to catch "...competing with
# Uber Eats and DoorDash." without flagging every sentence that merely
# starts with a capital letter.
_NAMED_ENTITY_PATTERN = re.compile(r"(?<!^)\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+\b")

# Dollar figures, percentages, or "market size"-shaped vocabulary that a
# directory citation (agents/mississauga_data.py -- business names, peer
# counts, NAICS sectors; never a dollar figure) can never legitimately
# back. Used by _directory_citation_violation() below.
_MARKET_SIZE_VOCAB_PATTERN = re.compile(
    r"\$\s?[\d,]+|%|\b(?:tam|sam|som|market size|revenue|valuation|valued at)\b", re.IGNORECASE,
)

MARKET_SCOPE_MISMATCH_REASON = "market scope mismatch -- cited chunk does not describe this market/geography"
DIRECTORY_CITATION_REASON = (
    "directory citations can only support peer counts, business names, or NAICS sector facts, "
    "never a market-size claim"
)
VERIFICATION_UNAVAILABLE_REASON = "Verification unavailable for this section"


def _dict_claim_text(d: dict) -> str:
    parts = []
    for key in ("text", "tier_description", "label", "rationale", "market_share_position"):
        value = d.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    if isinstance(d.get("value_usd"), (int, float)):
        parts.append(f"value_usd={d['value_usd']}")
    if d.get("metric_name") and d.get("metric_value"):
        parts.append(f"{d['metric_name']}={d['metric_value']}")
    return " | ".join(parts) if parts else "(structured point with no descriptive text)"


def extract_structured_claims(extra_value) -> list[dict]:
    """Every point/tier anywhere in a framework's structured field
    (market_sizing, swot_analysis, bcg_matrix, ...) that carries a real
    citation_index becomes one claim. market_sizing is special-cased so
    each tam/sam/som tier is tagged is_tam_tier/tier_name -- needed for
    the cheap scope-mismatch pre-filter below -- everything else (the
    other 9 frameworks' shapes) is walked generically since they all
    reduce to the same {..., "citation_index": N} point shape."""
    if isinstance(extra_value, dict) and {"tam", "sam", "som"} <= set(extra_value.keys()):
        claims = []
        for tier_name in ("tam", "sam", "som"):
            tier = extra_value.get(tier_name)
            if isinstance(tier, dict) and isinstance(tier.get("citation_index"), int) and tier.get("value_usd") is not None:
                claims.append({
                    "text": _dict_claim_text(tier),
                    "citation_indices": [tier["citation_index"]],
                    "is_tam_tier": True,
                    "tier_name": tier_name,
                    "tier_description": tier.get("tier_description"),
                })
        return claims

    claims: list[dict] = []

    def walk(value):
        if isinstance(value, dict):
            idx = value.get("citation_index")
            if isinstance(idx, int):
                claims.append({"text": _dict_claim_text(value), "citation_indices": [idx], "is_tam_tier": False})
            for v in value.values():
                walk(v)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(extra_value)
    return claims


def _looks_like_factual_claim(sentence: str) -> bool:
    return bool(
        _DOLLAR_PATTERN.search(sentence)
        or _PERCENTAGE_PATTERN.search(sentence)
        or _NAMED_ENTITY_PATTERN.search(sentence)
        or _NUMBER_PATTERN.search(sentence)
    )


def extract_narrative_claims(generated_text: str) -> tuple[list[dict], list[dict]]:
    """Returns (cited_claims, uncited_factual_claims). A sentence with
    one or more [N] markers becomes a cited claim citing every marker
    found in it. A sentence with none, but that still contains a
    number, percentage, or looks like it names a competitor, is an
    "uncited factual claim" -- flagged directly, never sent to the LLM
    (there's no citation to check it against)."""
    cited: list[dict] = []
    uncited_factual: list[dict] = []
    for raw_sentence in _SENTENCE_SPLIT_PATTERN.split(generated_text or ""):
        sentence = raw_sentence.strip()
        if not sentence:
            continue
        markers = [int(m) for m in _CITATION_MARKER_PATTERN.findall(sentence)]
        if markers:
            cited.append({"text": sentence, "citation_indices": sorted(set(markers)), "is_tam_tier": False})
        elif _looks_like_factual_claim(sentence):
            uncited_factual.append({"text": sentence, "reason": "uncited factual claim"})
    return cited, uncited_factual


def _chunks_for_claim(claim: dict, context_chunks: list) -> list[dict]:
    resolved = []
    for idx in claim["citation_indices"]:
        if 1 <= idx <= len(context_chunks):
            resolved.append(context_chunks[idx - 1])
    return resolved


def _directory_citation_violation(claim: dict, context_chunks: list) -> str | None:
    """Rule 5: a directory citation (agents/mississauga_data.py) never
    contains a dollar figure, so it can never legitimately back a
    market-size-shaped claim -- peer counts, business names, and NAICS
    sector facts are all it can support. Enforced deterministically,
    independent of whatever the LLM verifier itself concludes, so this
    can never accidentally pass just because the LLM was lenient."""
    resolved_chunks = _chunks_for_claim(claim, context_chunks)
    if not resolved_chunks or not all(c.get("is_directory") for c in resolved_chunks):
        return None
    if _MARKET_SIZE_VOCAB_PATTERN.search(claim["text"]):
        return DIRECTORY_CITATION_REASON
    return None


def _tam_tier_scope_mismatch(claim: dict, context_chunks: list) -> str | None:
    """Cheap first-pass filter (kept from the previous implementation):
    does tier_description share any specific (non-generic, non-sector-
    level) term with the actual text of the chunk it cites? This is a
    word-overlap heuristic, not a real judgment -- the LLM call below
    makes the real one -- but it catches an obvious mismatch for free,
    without spending a model call on it."""
    if not claim.get("is_tam_tier"):
        return None
    resolved_chunks = _chunks_for_claim(claim, context_chunks)
    if not resolved_chunks:
        return None
    specific_terms = market_scope.significant_terms(claim.get("tier_description"))
    if not specific_terms:
        return None
    chunk_text = " ".join((c.get("chunk_text") or "") for c in resolved_chunks).lower()
    if not any(term in chunk_text for term in specific_terms):
        return MARKET_SCOPE_MISMATCH_REASON
    return None


_VERIFIER_SYSTEM_PROMPT = """You are a strict fact-checker for a grounded business-analysis report.

You will be given a numbered list of CLAIMS. Each claim includes the
exact text of the source chunk(s) it cites. For each claim, decide:

- "supported": the cited chunk(s) genuinely state this claim. For a
  claim containing a specific number or percentage, that exact number
  must actually appear in the cited chunk(s) -- a similar or rounded
  number is NOT the same number. For a claim about a TAM/SAM/SOM market
  tier, the cited chunk's market AND geography must match what the
  claim's tier description says -- a chunk about a different country,
  or a much broader/narrower market, does not support it even if the
  dollar figure itself matches something else in the chunk.
- "partially_supported": the cited chunk(s) support part of the claim
  but not all of it (e.g. the general topic matches but a specific
  number, date, or geography in the claim isn't actually in the chunk).
- "unsupported": the cited chunk(s) do not state this claim at all, or
  contradict it.

A chunk whose source is a business directory listing (noted in its
text) can only ever support peer counts, business names, or NAICS
sector facts -- never a dollar figure, revenue, or market-size claim;
mark any such claim "unsupported" regardless of anything else in the
directory text.

Return a verdict and a one-line reason for every claim, in the same
order they were given, using each claim's claim_index exactly as given.
"""

_VERIFIER_SCHEMA = {
    "type": "object",
    "properties": {
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim_index": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["supported", "partially_supported", "unsupported"]},
                    "reason": {"type": "string"},
                },
                "required": ["claim_index", "verdict", "reason"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["claims"],
    "additionalProperties": False,
}


def _render_claim_for_llm(claim_index: int, claim: dict, context_chunks: list) -> str:
    resolved_chunks = _chunks_for_claim(claim, context_chunks)
    chunk_blocks = []
    for chunk in resolved_chunks:
        source_note = " (source: business directory listing)" if chunk.get("is_directory") else ""
        chunk_blocks.append(f"{chunk.get('chunk_text') or ''}{source_note}")
    chunks_text = "\n---\n".join(chunk_blocks) if chunk_blocks else "(cited chunk not found)"
    return f"CLAIM {claim_index}: {claim['text']}\nCITED SOURCE TEXT:\n{chunks_text}"


async def _call_verifier_llm(claims: list[dict], context_chunks: list) -> dict[int, dict]:
    """One structured LLM call covering every cited claim for this
    framework. Returns {claim_index: {"verdict":..., "reason":...}}.
    Raises on any failure -- the caller (verify_claims) is responsible
    for degrading to verified=False, never defaulting to True."""
    user_content = "\n\n".join(
        _render_claim_for_llm(i, claim, context_chunks) for i, claim in enumerate(claims)
    )
    parsed = await llm_provider.structured_completion(
        model=VERIFIER_MODEL,
        system_prompt=_VERIFIER_SYSTEM_PROMPT,
        user_content=user_content,
        schema_name="claim_verification",
        schema=_VERIFIER_SCHEMA,
        temperature=0,
    )
    results: dict[int, dict] = {}
    for item in parsed.get("claims", []):
        claim_index = item.get("claim_index")
        if isinstance(claim_index, int):
            results[claim_index] = {"verdict": item.get("verdict"), "reason": item.get("reason") or ""}
    return results


async def verify_claims(generated_text: str, citations: list, extra_value=None,
                         context_chunks: list | None = None) -> dict:
    """verified = True only if at least one claim was cited, every
    cited claim's LLM verdict is "supported" (after the deterministic
    directory-citation and TAM-scope overrides are applied), and there
    are no uncited factual claims. Any verifier-call failure degrades
    to verified=False with a fixed reason -- never defaults to True."""
    context_chunks = context_chunks or []
    narrative_claims, uncited_factual = extract_narrative_claims(generated_text)
    structured_claims = extract_structured_claims(extra_value)
    all_claims = narrative_claims + structured_claims

    if not citations:
        return {"verified": False, "unsupported_claims": ["No grounded sources retrieved for this section"], "claims": []}
    if not all_claims:
        return {"verified": False, "unsupported_claims": ["No inline citation markers found in output"], "claims": []}

    try:
        llm_results = await _call_verifier_llm(all_claims, context_chunks)
    except Exception:
        logger.exception("verify_claims: claim-verification LLM call failed -- degrading to unverified.")
        return {"verified": False, "unsupported_claims": [VERIFICATION_UNAVAILABLE_REASON], "claims": []}

    claims_out = []
    unsupported_claims = []
    for i, claim in enumerate(all_claims):
        llm_result = llm_results.get(i)
        if llm_result is None:
            verdict, reason = "unsupported", "claim verification response did not include this claim"
        else:
            verdict, reason = llm_result["verdict"], llm_result["reason"]

        override_reason = _directory_citation_violation(claim, context_chunks) or _tam_tier_scope_mismatch(claim, context_chunks)
        if override_reason:
            verdict, reason = "unsupported", override_reason

        claims_out.append({
            "text": claim["text"],
            "citation_indices": claim["citation_indices"],
            "verdict": verdict,
            "reason": reason,
        })
        if verdict != "supported":
            unsupported_claims.append(f"{claim['text']} -- {reason}")

    for uncited in uncited_factual:
        unsupported_claims.append(f"{uncited['text']} -- {uncited['reason']}")

    return {
        "verified": len(unsupported_claims) == 0,
        "unsupported_claims": unsupported_claims,
        "claims": claims_out,
    }
