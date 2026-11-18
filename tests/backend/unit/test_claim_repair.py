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
    # structured_completion both call through. It now returns
    # (parsed_dict, provider_used) -- "openai" here since these tests
    # never touch the real provider-selection logic.
    monkeypatch.setattr(
        claim_repair.llm_provider, "structured_completion",
        AsyncMock(return_value=({"repairs": repairs}, "openai")),
    )


def _mock_verifier_llm(monkeypatch, claims):
    monkeypatch.setattr(
        claim_verifier.llm_provider, "structured_completion",
        AsyncMock(return_value=({"claims": claims}, "openai")),
    )


def _mock_llm_sequence(monkeypatch, *responses):
    """For a test that exercises BOTH the repair call and the
    re-verification call inside repair_and_reverify -- they go through
    the same patched function, so the mock must return each response
    in call order via side_effect, not two separate overwriting
    monkeypatch.setattr calls (the second would just replace the
    first). Each response is the raw parsed dict; wrapped here with
    "openai" as its provider_used."""
    monkeypatch.setattr(
        claim_repair.llm_provider, "structured_completion",
        AsyncMock(side_effect=[(r, "openai") for r in responses]),
    )


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
    action, new_text, citation_index = claim_repair._sanitize_action(
        claim, "rewrite", "Freelancers underpay by $12,000 on average.", None, chunks,
    )
    assert action == "drop"
    assert new_text is None
    assert citation_index is None


def test_repair_cannot_introduce_a_new_citation():
    # For an already-cited fact claim, _sanitize_action never reads a
    # citation_index from the repair LLM's response at all -- rewrite
    # keeps the claim's own original citation_index unchanged, so
    # there is no code path for a new one to be introduced.
    claim = {
        "text": "x", "citation_indices": [1], "is_tam_tier": False, "claim_type": "fact",
        "locator": {"kind": "category_list", "category": "opportunities", "index": 0},
    }
    action, new_text, citation_index = claim_repair._sanitize_action(
        claim, "rewrite", "A rewritten point with no figures at all.", None, [_chunk("some source text")],
    )
    assert action == "rewrite"
    assert citation_index is None
    # Applying it must not add a citation_index key the LLM could have smuggled in.
    extra_value = {"opportunities": [{"text": "x", "citation_index": 1, "claim_type": "fact"}]}
    _, extra_value, _ = claim_repair._apply_action("x", extra_value, claim, action, new_text)
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


def test_gap_sentence_is_moved_to_assumptions_not_left_in_narrative(monkeypatch):
    # A "gap sentence" the generator wasn't supposed to write (banned by
    # GROUNDING_SYSTEM_PROMPT rule 6) but that slipped through anyway --
    # the repair pass moves it into assumptions instead of leaving it in
    # the narrative, where it would otherwise just keep failing as an
    # uncited factual claim forever.
    text = (
        "The app addresses a real need for freelancers [1]. "
        "However, the context does not provide specific data for the Balanced Scorecard analysis."
    )
    citations = [{"index": 1}]
    chunks = [_chunk("Freelancers often struggle with quarterly tax payments.")]

    _mock_verifier_llm(monkeypatch, [{"claim_index": 0, "verdict": "supported", "reason": "matches chunk"}])
    verification = asyncio.run(claim_verifier.verify_claims(text, citations, None, context_chunks=chunks))
    assert verification["verified"] is False
    assert any("uncited factual claim" in c for c in verification["unsupported_claims"])

    _mock_repair_llm(monkeypatch, [{
        "claim_index": 0, "action": "move_to_assumption",
        "new_text": "Validate customer satisfaction with Austin freelancers directly.",
    }])

    repaired = asyncio.run(claim_repair.repair_and_reverify(text, citations, None, verification, chunks, []))

    assert "does not provide" not in repaired["text"]
    assert "Validate customer satisfaction with Austin freelancers directly." in repaired["assumptions"]
    assert repaired["repair_log"]["moved_to_assumptions"] == 1


def test_gap_sentence_repair_cannot_introduce_a_figure_into_assumptions():
    claim = {
        "text": "The context does not provide revenue figures for this segment.",
        "citation_indices": [], "is_tam_tier": False,
        "locator": {"kind": "gap_sentence", "sentence": "The context does not provide revenue figures for this segment."},
    }
    action, new_text, citation_index = claim_repair._sanitize_action(
        claim, "move_to_assumption", "Validate this segment's revenue -- early estimates suggest $2M.", None, [],
    )
    assert action == "drop"
    assert new_text is None
    assert citation_index is None


def test_non_gap_uncited_sentence_is_tagged_uncited_sentence_not_gap(monkeypatch):
    # unify/3-gemini addendum A: a non-gap uncited factual sentence is
    # now ALSO eligible for repair (add_citation/convert_to_analysis/
    # drop), unlike a "gap sentence" which only ever moves to
    # assumptions -- the two get different locator kinds so repair can
    # treat them differently.
    text = "The app addresses a real need for freelancers [1]. Competitors charge users over $40 monthly for similar tools."
    citations = [{"index": 1}]
    chunks = [_chunk("Freelancers often struggle with quarterly tax payments.")]

    _mock_verifier_llm(monkeypatch, [{"claim_index": 0, "verdict": "supported", "reason": "matches chunk"}])
    verification = asyncio.run(claim_verifier.verify_claims(text, citations, None, context_chunks=chunks))
    assert verification["verified"] is False
    assert any("uncited factual claim" in c for c in verification["unsupported_claims"])

    uncited_claims = claim_repair._uncited_sentence_claims(verification)
    assert len(uncited_claims) == 1
    assert uncited_claims[0]["locator"]["kind"] == "uncited_sentence"


def test_uncited_sentence_gets_a_real_citation_added_when_a_chunk_states_it(monkeypatch):
    # Addendum A: an uncited sentence that a provided chunk genuinely
    # states gets a real [N] citation added by repair, rather than
    # being dropped or left permanently uncited.
    text = "The app addresses a real need for freelancers [1]. 73% of freelancers forget quarterly tax deadlines."
    citations = [{"index": 1}]
    chunks = [_chunk("73% of freelancers in Austin forget their quarterly tax deadlines every year.")]

    _mock_llm_sequence(
        monkeypatch,
        {"claims": [{"claim_index": 0, "verdict": "supported", "reason": "matches chunk"}]},
        {"repairs": [{
            "claim_index": 0, "action": "add_citation",
            "new_text": "73% of freelancers forget quarterly tax deadlines.", "citation_index": 1,
        }]},
        {"claims": [{"claim_index": 0, "verdict": "supported", "reason": "chunk confirms this"}]},
    )
    verification = asyncio.run(claim_verifier.verify_claims(text, citations, None, context_chunks=chunks))
    assert verification["verified"] is False

    repaired = asyncio.run(claim_repair.repair_and_reverify(text, citations, None, verification, chunks, []))

    assert "[1]" in repaired["text"]
    assert repaired["repair_log"]["added_citation"] == 1
    assert repaired["verification"]["verified"] is True


def test_uncited_sentence_add_citation_rejects_an_out_of_range_index():
    claim = {
        "text": "Many freelancers forget quarterly tax deadlines.", "citation_indices": [], "is_tam_tier": False,
        "locator": {"kind": "uncited_sentence", "sentence": "Many freelancers forget quarterly tax deadlines."},
    }
    action, new_text, citation_index = claim_repair._sanitize_action(
        claim, "add_citation", "Many freelancers forget quarterly tax deadlines.", 7, [_chunk("one real chunk")],
    )
    assert action == "drop"
    assert new_text is None
    assert citation_index is None


def test_dropping_multiple_failing_claims_in_the_same_category_does_not_shift_indices(monkeypatch):
    # unify/3-gemini addendum B: BMC's repair dropped 21 failing claims
    # live and 5 originally-targeted ones still survived afterward.
    # Root cause: each failing claim's locator index was computed from
    # the category list's ORIGINAL length; popping by index as each
    # one was processed shifted every later index, so a second drop in
    # the same category removed the wrong item. Five points in one
    # category, three failing (indices 0, 2, 4) -- dropping all three
    # must leave exactly the two untouched ones (1, 3), never one of
    # the three that should have been removed.
    text = "x"
    citations = [{"index": 1}]
    chunks = [_chunk("Some source text.")]
    extra_value = {"cost_structure": [
        {"text": "bad-0", "citation_index": 1, "claim_type": "fact"},
        {"text": "good-1", "citation_index": 1, "claim_type": "fact"},
        {"text": "bad-2", "citation_index": 1, "claim_type": "fact"},
        {"text": "good-3", "citation_index": 1, "claim_type": "fact"},
        {"text": "bad-4", "citation_index": 1, "claim_type": "fact"},
    ]}

    _mock_verifier_llm(monkeypatch, [
        {"claim_index": 0, "verdict": "unsupported", "reason": "r0"},
        {"claim_index": 1, "verdict": "supported", "reason": "r1"},
        {"claim_index": 2, "verdict": "unsupported", "reason": "r2"},
        {"claim_index": 3, "verdict": "supported", "reason": "r3"},
        {"claim_index": 4, "verdict": "unsupported", "reason": "r4"},
    ])
    verification = asyncio.run(claim_verifier.verify_claims(text, citations, extra_value, context_chunks=chunks))
    assert verification["verified"] is False

    _mock_repair_llm(monkeypatch, [
        {"claim_index": 0, "action": "drop", "new_text": None, "citation_index": None},
        {"claim_index": 1, "action": "drop", "new_text": None, "citation_index": None},
        {"claim_index": 2, "action": "drop", "new_text": None, "citation_index": None},
    ])

    repaired = asyncio.run(claim_repair.repair_and_reverify(text, citations, extra_value, verification, chunks, []))

    remaining_texts = {item["text"] for item in repaired["extra_value"]["cost_structure"]}
    assert remaining_texts == {"good-1", "good-3"}
    assert repaired["repair_log"]["dropped"] == 3
