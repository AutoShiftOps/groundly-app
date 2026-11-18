# unify/3-gemini: the provider-neutral LLM call layer. Every chat/
# structured call in the codebase goes through structured_completion()
# or text_completion() here. These tests mock both SDKs (never a real
# network call) and check: provider selection, the retry-once-then-
# OpenAI fallback, and that converting this codebase's JSON schemas
# into Gemini's response_schema shape is accepted and preserves the
# same keys/types a parsed OpenAI response would have.
from unittest.mock import AsyncMock
import asyncio

from agents import config, llm_provider, rag_pipeline


def test_gemini_is_tried_first_when_configured(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    gemini_mock = AsyncMock(return_value={"specific_category": "x"})
    monkeypatch.setattr(llm_provider, "_gemini_structured_call", gemini_mock)
    openai_mock = AsyncMock()
    monkeypatch.setattr(llm_provider, "_openai_structured_call", openai_mock)

    parsed, provider = asyncio.run(llm_provider.structured_completion(
        model="gpt-4o-mini", system_prompt="sys", user_content="hi",
        schema_name="s", schema={"type": "object", "properties": {}}, temperature=0,
    ))

    assert provider == "gemini"
    assert parsed == {"specific_category": "x"}
    gemini_mock.assert_called_once()
    openai_mock.assert_not_called()


def test_openai_only_configured_never_tries_gemini(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "openai")
    gemini_mock = AsyncMock()
    monkeypatch.setattr(llm_provider, "_gemini_structured_call", gemini_mock)
    openai_mock = AsyncMock(return_value={"ok": True})
    monkeypatch.setattr(llm_provider, "_openai_structured_call", openai_mock)

    parsed, provider = asyncio.run(llm_provider.structured_completion(
        model="gpt-4o-mini", system_prompt="sys", user_content="hi",
        schema_name="s", schema={"type": "object", "properties": {}}, temperature=0,
    ))

    assert provider == "openai"
    assert parsed == {"ok": True}
    gemini_mock.assert_not_called()


def test_gemini_failure_retries_once_then_falls_back_to_openai(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    gemini_mock = AsyncMock(side_effect=RuntimeError("429 quota exceeded"))
    monkeypatch.setattr(llm_provider, "_gemini_structured_call", gemini_mock)
    openai_mock = AsyncMock(return_value={"fallback": True})
    monkeypatch.setattr(llm_provider, "_openai_structured_call", openai_mock)

    parsed, provider = asyncio.run(llm_provider.structured_completion(
        model="gpt-4o-mini", system_prompt="sys", user_content="hi",
        schema_name="s", schema={"type": "object", "properties": {}}, temperature=0,
    ))

    assert provider == "openai"
    assert parsed == {"fallback": True}
    assert gemini_mock.call_count == 2  # one retry before giving up on Gemini
    openai_mock.assert_called_once()


def test_both_providers_failing_raises_never_fakes_a_success(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(llm_provider, "_gemini_structured_call", AsyncMock(side_effect=RuntimeError("down")))
    monkeypatch.setattr(llm_provider, "_openai_structured_call", AsyncMock(side_effect=RuntimeError("also down")))

    try:
        asyncio.run(llm_provider.structured_completion(
            model="gpt-4o-mini", system_prompt="sys", user_content="hi",
            schema_name="s", schema={"type": "object", "properties": {}}, temperature=0,
        ))
        assert False, "expected an exception, not a fabricated success"
    except RuntimeError:
        pass


def test_text_completion_falls_back_the_same_way(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(llm_provider, "_gemini_text_call", AsyncMock(side_effect=TimeoutError()))
    monkeypatch.setattr(llm_provider, "_openai_text_call", AsyncMock(return_value="plain text answer"))

    text, provider = asyncio.run(llm_provider.text_completion(
        model="gpt-4o-mini", system_prompt="sys", user_content="hi", temperature=0.2,
    ))

    assert provider == "openai"
    assert text == "plain text answer"


def test_overall_provider_reduces_correctly():
    assert llm_provider.overall_provider(["gemini", "gemini"]) == "gemini"
    assert llm_provider.overall_provider(["openai"]) == "openai"
    assert llm_provider.overall_provider(["gemini", "openai"]) == "mixed"
    assert llm_provider.overall_provider([]) == "openai"


def test_schema_conversion_handles_nullable_string_and_integer():
    schema = {
        "type": "object",
        "properties": {
            "label": {"type": "string"},
            "citation_index": {"type": ["integer", "null"]},
            "value_usd": {"anyOf": [{"type": "number"}, {"type": "null"}]},
        },
        "required": ["label", "citation_index", "value_usd"],
        "additionalProperties": False,
    }
    converted = llm_provider.json_schema_to_gemini(schema)

    assert converted["type"] == "OBJECT"
    assert converted["properties"]["label"]["type"] == "STRING"
    assert converted["properties"]["citation_index"]["type"] == "INTEGER"
    assert converted["properties"]["citation_index"]["nullable"] is True
    assert converted["properties"]["value_usd"]["type"] == "NUMBER"
    assert converted["properties"]["value_usd"]["nullable"] is True
    assert "additionalProperties" not in converted


def test_schema_conversion_handles_nested_array_of_objects_with_enum():
    schema = {
        "type": "object",
        "properties": {
            "swot_analysis": {
                "type": "object",
                "properties": {
                    "strengths": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "text": {"type": "string"},
                                "claim_type": {"type": "string", "enum": ["fact", "analysis"]},
                            },
                            "required": ["text", "claim_type"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["strengths"],
                "additionalProperties": False,
            },
        },
        "required": ["swot_analysis"],
        "additionalProperties": False,
    }
    converted = llm_provider.json_schema_to_gemini(schema)

    item_schema = converted["properties"]["swot_analysis"]["properties"]["strengths"]["items"]
    assert converted["properties"]["swot_analysis"]["properties"]["strengths"]["type"] == "ARRAY"
    assert item_schema["type"] == "OBJECT"
    assert item_schema["properties"]["claim_type"]["enum"] == ["fact", "analysis"]
    assert item_schema["required"] == ["text", "claim_type"]


def test_schema_conversion_accepted_for_every_real_framework_schema():
    # Every one of the 10 framework schemas, plus the verifier and
    # repair schemas, must convert without raising and keep their
    # top-level required fields intact.
    from agents import claim_verifier, claim_repair

    schemas_to_check = [schema for (_suffix, _field, _name, schema) in rag_pipeline.STRUCTURED_FRAMEWORKS.values()]
    schemas_to_check.append(claim_verifier._VERIFIER_SCHEMA)
    schemas_to_check.append(claim_repair._REPAIR_SCHEMA)
    schemas_to_check.append(rag_pipeline._MARKET_CATEGORY_SCHEMA)

    for schema in schemas_to_check:
        converted = llm_provider.json_schema_to_gemini(schema)
        assert converted["type"] == "OBJECT"
        assert set(converted.get("required", [])) == set(schema.get("required", []))
        assert set(converted["properties"].keys()) == set(schema["properties"].keys())
