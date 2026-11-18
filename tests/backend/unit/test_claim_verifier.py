# The real claim verifier (unify/2b-verification). Replaces the old
# "verified = at least one citation marker exists" heuristic in
# agents/rag_pipeline.py's verify_claims with an actual LLM judgment,
# per claim, of whether the cited chunk(s) really support it --
# extracted from narrative [N]-marker sentences and from every
# structured point/tier carrying a citation_index. All LLM calls are
# mocked: these tests check the extraction, the deterministic
# overrides (directory citations, TAM scope mismatch), and the final
# verified/unsupported_claims/claims assembly, never a real network call.
from unittest.mock import AsyncMock
import asyncio

from agents import claim_verifier


def _chunk(text, is_directory=False):
    return {"chunk_text": text, "is_directory": is_directory}


def _run(monkeypatch, llm_claims, text, citations, extra_value=None, context_chunks=None):
    monkeypatch.setattr(
        claim_verifier.llm_provider, "structured_completion",
        AsyncMock(return_value={"claims": llm_claims}),
    )
    return asyncio.run(claim_verifier.verify_claims(text, citations, extra_value, context_chunks=context_chunks))


def test_all_claims_supported_is_verified(monkeypatch):
    text = "The market is worth $14.9B [1]."
    citations = [{"index": 1}]
    chunks = [_chunk("The global meal kit market is worth $14.9B in 2024.")]
    llm_claims = [{"claim_index": 0, "verdict": "supported", "reason": "figure matches"}]

    result = _run(monkeypatch, llm_claims, text, citations, context_chunks=chunks)

    assert result["verified"] is True
    assert result["unsupported_claims"] == []
    assert len(result["claims"]) == 1
    assert result["claims"][0]["verdict"] == "supported"


def test_one_unsupported_claim_fails_verification_and_is_listed(monkeypatch):
    text = "The market is worth $14.9B [1]. It is growing fast [1]."
    citations = [{"index": 1}]
    chunks = [_chunk("The global meal kit market is worth $14.9B in 2024.")]
    llm_claims = [
        {"claim_index": 0, "verdict": "supported", "reason": "figure matches"},
        {"claim_index": 1, "verdict": "unsupported", "reason": "chunk never says growth rate"},
    ]

    result = _run(monkeypatch, llm_claims, text, citations, context_chunks=chunks)

    assert result["verified"] is False
    assert len(result["unsupported_claims"]) == 1
    assert "It is growing fast" in result["unsupported_claims"][0]
    assert "chunk never says growth rate" in result["unsupported_claims"][0]


def test_uncited_numeric_sentence_fails_verification(monkeypatch):
    # "$73.2 billion" has no [N] marker -- an uncited factual claim,
    # flagged directly without ever going to the LLM.
    text = "The market is worth $14.9B [1]. Revenue reached $73.2 billion last year."
    citations = [{"index": 1}]
    chunks = [_chunk("The global meal kit market is worth $14.9B in 2024.")]
    llm_claims = [{"claim_index": 0, "verdict": "supported", "reason": "figure matches"}]

    result = _run(monkeypatch, llm_claims, text, citations, context_chunks=chunks)

    assert result["verified"] is False
    assert any("uncited factual claim" in c for c in result["unsupported_claims"])
    assert any("$73.2 billion" in c for c in result["unsupported_claims"])


def test_verifier_exception_never_defaults_to_verified_true(monkeypatch):
    text = "The market is worth $14.9B [1]."
    citations = [{"index": 1}]
    chunks = [_chunk("The global meal kit market is worth $14.9B in 2024.")]

    monkeypatch.setattr(
        claim_verifier.llm_provider, "structured_completion",
        AsyncMock(side_effect=RuntimeError("timeout")),
    )

    result = asyncio.run(claim_verifier.verify_claims(text, citations, None, context_chunks=chunks))

    assert result["verified"] is False
    assert result["unsupported_claims"] == [claim_verifier.VERIFICATION_UNAVAILABLE_REASON]
    assert result["claims"] == []


def test_directory_citation_backing_a_market_size_claim_is_unsupported(monkeypatch):
    # A directory citation (agents/mississauga_data.py) never contains a
    # dollar figure -- it can back a peer-count/business-name/NAICS fact,
    # never a market-size claim, regardless of what the LLM itself says.
    text = "The catering market here is worth $50M [1]."
    citations = [{"index": 1}]
    chunks = [_chunk("Food Mamba Catering is a registered NAICS 722320 caterer.", is_directory=True)]
    # Even if the LLM is lenient here, the deterministic override must win.
    llm_claims = [{"claim_index": 0, "verdict": "supported", "reason": "looks plausible"}]

    result = _run(monkeypatch, llm_claims, text, citations, context_chunks=chunks)

    assert result["verified"] is False
    assert result["claims"][0]["verdict"] == "unsupported"
    assert "directory" in result["claims"][0]["reason"].lower()


def test_directory_citation_backing_a_peer_count_claim_is_unaffected(monkeypatch):
    # The allowed case: a directory citation backing a business-name/
    # peer-count fact, not a dollar figure -- no override should fire.
    text = "There are 34 registered caterers in the area [1]."
    citations = [{"index": 1}]
    chunks = [_chunk("34 businesses are registered under NAICS 722320 in this area.", is_directory=True)]
    llm_claims = [{"claim_index": 0, "verdict": "supported", "reason": "matches peer count"}]

    result = _run(monkeypatch, llm_claims, text, citations, context_chunks=chunks)

    assert result["verified"] is True
    assert result["claims"][0]["verdict"] == "supported"


def test_figure_cited_to_a_chunk_that_does_not_contain_it_is_unsupported(monkeypatch):
    text = "The market is worth $921.14B [1]."
    citations = [{"index": 1}]
    chunks = [_chunk("The meal kit delivery market in Canada is a growing niche.")]
    llm_claims = [{"claim_index": 0, "verdict": "unsupported", "reason": "chunk contains no $921.14B figure"}]

    result = _run(monkeypatch, llm_claims, text, citations, context_chunks=chunks)

    assert result["verified"] is False
    assert result["claims"][0]["verdict"] == "unsupported"


def test_tam_tier_structured_claim_extracted_and_scope_checked(monkeypatch):
    # A tam/sam/som tier with a citation_index becomes its own claim,
    # tagged so the cheap scope-mismatch pre-filter applies to it --
    # here the chunk is a completely different market, so the
    # deterministic override fires without even trusting the LLM's verdict.
    text = "See market_sizing for figures."
    citations = [{"index": 1}]
    chunks = [_chunk("The entire U.S. software market was valued at $921.14B in 2026.")]
    extra_value = {
        "tam": {
            "value_usd": 921140000000, "label": "$921.14B", "citation_index": 1,
            "cagr_pct": 11.8, "tier_description": "Tax preparation software for freelancers market, 2026",
        },
        "sam": None,
        "som": None,
    }
    llm_claims = [{"claim_index": 0, "verdict": "supported", "reason": "looks plausible"}]

    result = _run(monkeypatch, llm_claims, text, citations, extra_value=extra_value, context_chunks=chunks)

    assert result["verified"] is False
    assert result["claims"][0]["verdict"] == "unsupported"
    assert "scope mismatch" in result["claims"][0]["reason"]


def test_no_citations_at_all_is_unverified_without_calling_the_llm(monkeypatch):
    llm = AsyncMock(return_value={"claims": []})
    monkeypatch.setattr(claim_verifier.llm_provider, "structured_completion", llm)

    result = asyncio.run(claim_verifier.verify_claims(
        "Insufficient grounded data available for this section.", [], None, context_chunks=[],
    ))

    assert result["verified"] is False
    assert result["unsupported_claims"] == ["No grounded sources retrieved for this section"]
    llm.assert_not_called()
