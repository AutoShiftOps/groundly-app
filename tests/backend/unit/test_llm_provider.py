# unify/3-gemini: the provider-neutral LLM call layer. Every chat/
# structured call in the codebase goes through structured_completion()
# or text_completion() here. These tests mock both SDKs (never a real
# network call) and check: provider selection, the retry-once-then-
# OpenAI fallback, and that converting this codebase's JSON schemas
# into Gemini's response_schema shape is accepted and preserves the
# same keys/types a parsed OpenAI response would have.
from unittest.mock import AsyncMock
import asyncio
import logging
import time

from google.genai import errors as genai_errors

from agents import config, llm_provider, rag_pipeline


def _api_error(code, status, message, reason=None):
    body = {"error": {"code": code, "message": message, "status": status}}
    if reason:
        body["error"]["details"] = [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": reason}]
    cls = genai_errors.ServerError if code >= 500 else genai_errors.ClientError
    return cls(code, body)


def _invalid_key_error():
    # The exact shape Gemini returns for a bad key (checked against the real API).
    return _api_error(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", "API_KEY_INVALID")


def _structured():
    return llm_provider.structured_completion(
        model="gpt-4o-mini", system_prompt="sys", user_content="hi",
        schema_name="s", schema={"type": "object", "properties": {}}, temperature=0,
    )


def _use_gemini(monkeypatch, gemini_side_effect=None, gemini_return=None, openai_return=None):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    gemini_mock = AsyncMock(side_effect=gemini_side_effect, return_value=gemini_return)
    openai_mock = AsyncMock(return_value=openai_return if openai_return is not None else {"fallback": True})
    monkeypatch.setattr(llm_provider, "_gemini_structured_call", gemini_mock)
    monkeypatch.setattr(llm_provider, "_openai_structured_call", openai_mock)
    return gemini_mock, openai_mock


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


def test_429_retries_once_then_falls_back_to_openai(monkeypatch):
    gemini_mock, openai_mock = _use_gemini(
        monkeypatch, gemini_side_effect=_api_error(429, "RESOURCE_EXHAUSTED", "Quota exceeded"),
    )

    parsed, provider = asyncio.run(_structured())

    assert provider == "openai"
    assert parsed == {"fallback": True}
    assert gemini_mock.call_count == 2  # one retry before giving up on Gemini
    openai_mock.assert_called_once()


def test_invalid_key_goes_straight_to_openai_and_next_5_calls_skip_gemini(monkeypatch, caplog):
    gemini_mock, openai_mock = _use_gemini(monkeypatch, gemini_side_effect=_invalid_key_error())

    with caplog.at_level(logging.WARNING, logger="agents.llm_provider"):
        _, provider = asyncio.run(_structured())
        assert provider == "openai"
        assert gemini_mock.call_count == 1  # no retry on a permanent error

        for _ in range(5):
            _, provider = asyncio.run(_structured())
            assert provider == "openai"

    assert gemini_mock.call_count == 1  # breaker open: Gemini never touched again
    assert openai_mock.call_count == 6
    opened = [r for r in caplog.records if "circuit breaker OPEN" in r.getMessage()]
    assert len(opened) == 1


def test_breaker_logs_open_once_when_concurrent_calls_all_fail(monkeypatch, caplog):
    _use_gemini(monkeypatch, gemini_side_effect=_invalid_key_error())

    async def ten_at_once():
        return await asyncio.gather(*[_structured() for _ in range(10)])

    with caplog.at_level(logging.WARNING, logger="agents.llm_provider"):
        results = asyncio.run(ten_at_once())

    assert all(provider == "openai" for _, provider in results)
    warnings = [r.getMessage() for r in caplog.records if r.levelno >= logging.WARNING]
    assert len(warnings) == 1 and "circuit breaker OPEN" in warnings[0]


def test_missing_key_goes_straight_to_openai_without_a_network_call(monkeypatch):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", None)
    monkeypatch.setattr(llm_provider, "_genai_client", None)
    monkeypatch.setattr(llm_provider, "_openai_structured_call", AsyncMock(return_value={"ok": True}))

    _, provider = asyncio.run(_structured())

    assert provider == "openai"
    assert llm_provider.provider_status()["gemini_breaker_open"] is True


def test_409_goes_straight_to_openai_without_retry(monkeypatch):
    gemini_mock, openai_mock = _use_gemini(
        monkeypatch, gemini_side_effect=_api_error(409, "ABORTED", "Conflict"),
    )

    _, provider = asyncio.run(_structured())

    assert provider == "openai"
    assert gemini_mock.call_count == 1
    openai_mock.assert_called_once()
    # A one-off 409 isn't a reason to disable Gemini for everyone.
    assert llm_provider.provider_status()["gemini_breaker_open"] is False


def test_hanging_gemini_call_times_out_then_falls_back_to_openai(monkeypatch):
    async def hang(*_args, **_kwargs):
        await asyncio.sleep(30)

    gemini_mock, openai_mock = _use_gemini(monkeypatch, gemini_side_effect=hang)
    monkeypatch.setattr(config, "GEMINI_TIMEOUT_SECONDS", 0.05)

    started = time.monotonic()
    _, provider = asyncio.run(_structured())

    assert provider == "openai"
    assert gemini_mock.call_count == 2  # a timeout is transient: one retry
    assert time.monotonic() - started < 2
    openai_mock.assert_called_once()


def test_three_consecutive_transient_failures_open_the_breaker(monkeypatch):
    gemini_mock, _ = _use_gemini(
        monkeypatch, gemini_side_effect=_api_error(503, "UNAVAILABLE", "Overloaded"),
    )

    asyncio.run(_structured())  # 2 failures (attempt + retry)
    assert llm_provider.provider_status()["gemini_breaker_open"] is False
    asyncio.run(_structured())  # 3rd failure opens it; no retry once open
    assert gemini_mock.call_count == 3
    assert llm_provider.provider_status()["gemini_breaker_open"] is True

    asyncio.run(_structured())
    assert gemini_mock.call_count == 3


def test_breaker_closes_after_cooldown_and_gemini_is_used_again(monkeypatch, caplog):
    clock = [1000.0]
    monkeypatch.setattr(llm_provider, "_now", lambda: clock[0])
    monkeypatch.setattr(config, "GEMINI_COOLDOWN_SECONDS", 600)
    gemini_mock, _ = _use_gemini(monkeypatch, gemini_side_effect=_invalid_key_error())

    asyncio.run(_structured())
    status = llm_provider.provider_status()
    assert status["gemini_breaker_open"] is True
    assert status["gemini_breaker_seconds_remaining"] == 600
    assert status["llm_provider_active"] == "openai"

    clock[0] += 599
    asyncio.run(_structured())
    assert gemini_mock.call_count == 1  # still cooling down

    clock[0] += 2
    gemini_mock.side_effect = None
    gemini_mock.return_value = {"from": "gemini"}
    with caplog.at_level(logging.WARNING, logger="agents.llm_provider"):
        parsed, provider = asyncio.run(_structured())

    assert provider == "gemini"
    assert parsed == {"from": "gemini"}
    assert llm_provider.provider_status()["llm_provider_active"] == "gemini"
    assert len([r for r in caplog.records if "circuit breaker closed" in r.getMessage()]) == 1


def test_both_providers_failing_with_breaker_open_still_raises(monkeypatch):
    _use_gemini(monkeypatch, gemini_side_effect=_invalid_key_error())
    monkeypatch.setattr(llm_provider, "_openai_structured_call", AsyncMock(side_effect=RuntimeError("openai down")))

    for _ in range(2):  # first call opens the breaker; second skips Gemini
        try:
            asyncio.run(_structured())
            assert False, "expected an exception, not a fabricated success"
        except RuntimeError as exc:
            assert "openai down" in str(exc)


def test_health_reports_provider_and_breaker_state(monkeypatch, api_client):
    monkeypatch.setattr(config, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")

    body = api_client.get("/health").json()
    assert body["llm_provider_configured"] == "gemini"
    assert body["llm_provider_active"] == "gemini"
    assert body["gemini_breaker_open"] is False

    llm_provider._open_breaker("test")
    body = api_client.get("/health").json()
    assert body["llm_provider_active"] == "openai"
    assert body["gemini_breaker_open"] is True
    assert body["gemini_breaker_seconds_remaining"] > 0


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
