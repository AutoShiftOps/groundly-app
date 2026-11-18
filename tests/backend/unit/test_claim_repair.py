# unify/2c-claim-quality: the repair pass. After the real verifier
# (agents/claim_verifier.py) marks one or more fact claims unsupported/
# partially_supported, agents/claim_repair.py makes ONE LLM call that
# rewrites, converts, or drops each failing claim -- then the full
# verifier re-runs on the result, and THAT re-verification is what
# actually gets returned. All LLM calls mocked; no real network call.
from unittest.mock import AsyncMock
import asyncio

from agents import claim_repair, claim_verifier


def _chunk(text):
    return {"chunk_text": text, "is_directory": False}


def _mock_repair_llm(monkeypatch, repairs):
    # claim_repair.llm_provider and claim_verifier.llm_provider are the
    # SAME module object (both just `from agents import llm_provider`)
    # -- patching either name patches the one shared
    # structured_completion both call through.
    monkeypatch.setattr(claim_repair.llm_provider, "structured_completion", AsyncMock(return_value={"repairs": repairs}))


def _mock_verifier_llm(monkeypatch, claims):
    monkeypatch.setattr(claim_verifier.llm_provider, "structured_completion", AsyncMock(return_value={"claims": claims}))


def _mock_llm_sequence(monkeypatch, *responses):
    """For a test that exercises BOTH the repair call and the
    re-verification call inside repair_and_reverify -- they go through
    the same patched function, so the mock must return each response
    in call order via side_effect, not two separate overwriting
    monkeypatch.setattr calls (the second would just replace the
    first)."""
    monkeypatch.setattr(claim_repair.llm_provider, "structured_completion", AsyncMock(side_effect=list(responses)))


def test_unsupported_fact_is_repaired_not_kept_as_is(monkeypatch):
    # A SWOT "opportunities" point citing a chunk that doesn't actually
    # say what it claims. The repair call rewrites it to match the
    # chunk; re-verification must then find it supported.
    text = "x"
    citations = [{"index": 1}]
    chunks = [_chunk("Freelancers in Austin often miss quarterly tax deadlines.")]
    extra_value = {"opportunities": [
        {"text": "40% of freelancers underpay quarterly taxes.", "citation_index": 1, "claim_type": "fact"},
    ]}

    _mock_verifier_llm(monkeypatch, [
        {"claim_index": 0, "verdict": "unsupported", "reason": "chunk never states 40%"},
    ])
    verification = asyncio.run(claim_verifier.verify_claims(text, citations, extra_value, context_chunks=chunks))
    assert verification["verified"] is False

    _mock_llm_sequence(
        monkeypatch,
        {"repairs": [{"claim_index": 0, "action": "rewrite", "new_text": "Freelancers in Austin often miss quarterly tax deadlines."}]},
        {"claims": [{"claim_index": 0, "verdict": "supported", "reason": "matches chunk"}]},
    )

    repaired = asyncio.run(claim_repair.repair_and_reverify(text, citations, extra_value, verification, chunks))

    assert repaired["verification"]["verified"] is True
    item = repaired["extra_value"]["opportunities"][0]
    assert item["text"] == "Freelancers in Austin often miss quarterly tax deadlines."
    assert repaired["repair_log"]["rewritten"] == 1
    assert repaired["repair_log"]["dropped"] == 0


def test_repair_cannot_introduce_a_new_figure(monkeypatch):
    # The repair LLM proposes a rewrite that invents a figure
    # ("$12,000") never present in the cited chunk -- the deterministic
    # guard must reject this and fall back to dropping the claim.
    text = "x"
    citations = [{"index": 1}]
    chunks = [_chunk("Freelancers often underpay their quarterly estimated taxes.")]
    extra_value = {"opportunities": [
        {"text": "Freelancers underpay by $12,000 on average.", "citation_index": 1, "claim_type": "fact"},
    ]}

    _mock_verifier_llm(monkeypatch, [{"claim_index": 0, "verdict": "unsupported", "reason": "no figure in chunk"}])
    verification = asyncio.run(claim_verifier.verify_claims(text, citations, extra_value, context_chunks=chunks))

    # The claim gets dropped by _sanitize_action's figure guard, so
    # extra_value["opportunities"] ends up empty and re-verification
    # never has a fact claim to send to the LLM at all -- no second
    # mocked response needed.
    _mock_repair_llm(monkeypatch, [
        {"claim_index": 0, "action": "rewrite", "new_text": "Freelancers underpay by $12,000 on average, per the source."},
    ])

    repaired = asyncio.run(claim_repair.repair_and_reverify(text, citations, extra_value, verification, chunks))

    assert repaired["repair_log"]["dropped"] == 1
    assert repaired["repair_log"]["rewritten"] == 0
    assert repaired["extra_value"]["opportunities"] == []

    # Direct check of the guard itself, independent of the mocking
    # above -- the proposed new_text's figure ("$12,000") never appears
    # in the cited chunk, so the action must be forced to "drop".
    claim = {
        "text": "x", "citation_indices": [1], "is_tam_tier": False, "claim_type": "fact",
        "locator": {"kind": "category_list", "category": "opportunities", "index": 0},
    }
    action, new_text = claim_repair._sanitize_action(
        claim, "rewrite", "Freelancers underpay by $12,000 on average.", chunks,
    )
    assert action == "drop"
    assert new_text is None


def test_repair_cannot_introduce_a_new_citation():
    # _sanitize_action never reads a citation_index from the repair
    # LLM's response at all -- apply_action only ever sets it to the
    # claim's own original value (rewrite) or None (convert/drop), so
    # there is no code path for a new citation to be introduced.
    claim = {
        "text": "x", "citation_indices": [1], "is_tam_tier": False, "claim_type": "fact",
        "locator": {"kind": "category_list", "category": "opportunities", "index": 0},
    }
    action, new_text = claim_repair._sanitize_action(
        claim, "rewrite", "A rewritten point with no figures at all.", [_chunk("some source text")],
    )
    assert action == "rewrite"
    # Applying it must not add a citation_index key the LLM could have smuggled in.
    extra_value = {"opportunities": [{"text": "x", "citation_index": 1, "claim_type": "fact"}]}
    _, extra_value = claim_repair._apply_action("x", extra_value, claim, action, new_text)
    assert extra_value["opportunities"][0]["citation_index"] == 1


def test_analysis_point_with_a_figure_is_flagged(monkeypatch):
    # claim_type="analysis" but the text smuggles a dollar figure --
    # must be flagged as a hidden fact, not silently accepted.
    text = "See the breakdown above."
    citations = [{"index": 1}]
    chunks = [_chunk("Freelancers often underpay their quarterly estimated taxes.")]
    extra_value = {"opportunities": [
        {"text": "This could unlock $500K in new revenue.", "citation_index": None, "claim_type": "analysis"},
    ]}

    verification = asyncio.run(claim_verifier.verify_claims(text, citations, extra_value, context_chunks=chunks))

    assert verification["verified"] is False
    assert any("hidden fact" in reason.lower() or "analysis point contains" in reason.lower()
               for reason in verification["unsupported_claims"])


def test_analysis_point_without_hidden_facts_is_not_itself_flagged(monkeypatch):
    # A clean analysis point (no figure/percentage/named company) must
    # not be flagged on its own -- but the section as a whole still
    # needs at least one grounded fact to verify (unchanged from PR
    # #35's "at least one claim was cited" rule; a report with zero
    # citations and only inference should not pass just because the
    # inference itself happens to be hidden-fact-free).
    text = "See the breakdown above."
    citations = [{"index": 1}]
    chunks = [_chunk("Freelancers often underpay their quarterly estimated taxes.")]
    extra_value = {"opportunities": [
        {"text": "This gap suggests meaningful room for a better tax-prep product.", "citation_index": None, "claim_type": "analysis"},
    ]}

    verification = asyncio.run(claim_verifier.verify_claims(text, citations, extra_value, context_chunks=chunks))

    assert verification["claims"][0]["claim_type"] == "analysis"
    assert verification["claims"][0]["verdict"] == "supported"
    assert not any("hidden fact" in c for c in verification["unsupported_claims"])


def test_repair_llm_failure_leaves_original_verification_unchanged(monkeypatch):
    text = "x"
    citations = [{"index": 1}]
    chunks = [_chunk("Freelancers often underpay their quarterly estimated taxes.")]
    extra_value = {"opportunities": [
        {"text": "40% of freelancers underpay quarterly taxes.", "citation_index": 1, "claim_type": "fact"},
    ]}

    _mock_verifier_llm(monkeypatch, [{"claim_index": 0, "verdict": "unsupported", "reason": "no 40% in chunk"}])
    verification = asyncio.run(claim_verifier.verify_claims(text, citations, extra_value, context_chunks=chunks))
    assert verification["verified"] is False

    monkeypatch.setattr(claim_repair.llm_provider, "structured_completion", AsyncMock(side_effect=RuntimeError("timeout")))

    repaired = asyncio.run(claim_repair.repair_and_reverify(text, citations, extra_value, verification, chunks))

    assert repaired["verification"]["verified"] is False
    assert repaired["verification"] == verification
    assert repaired["extra_value"] == extra_value
    assert repaired["text"] == text
