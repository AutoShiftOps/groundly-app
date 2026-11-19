# feature/provider-per-task: each kind of LLM call picks its own provider.
# "writing" (framework generation, category classification, synthesis,
# Ask AI) uses LLM_PROVIDER_WRITING, "checking" (claim verifier, repair)
# uses LLM_PROVIDER_CHECKING; either falls back to LLM_PROVIDER when unset.
# Both SDKs mocked -- no network.
from unittest.mock import AsyncMock
import ast
import asyncio
import itertools
import os
import pathlib
import subprocess
import sys

import pytest
from google.genai import errors as genai_errors

from agents import config, llm_provider

REPO = pathlib.Path(__file__).resolve().parents[3]


def _setup(monkeypatch, default, writing, checking):
    monkeypatch.setattr(config, "LLM_PROVIDER", default)
    monkeypatch.setattr(config, "LLM_PROVIDER_WRITING", writing)
    monkeypatch.setattr(config, "LLM_PROVIDER_CHECKING", checking)
    monkeypatch.setattr(config, "GEMINI_API_KEY", "fake-key-for-test")
    gemini = AsyncMock(return_value={"from": "gemini"})
    openai = AsyncMock(return_value={"from": "openai"})
    monkeypatch.setattr(llm_provider, "_gemini_structured_call", gemini)
    monkeypatch.setattr(llm_provider, "_openai_structured_call", openai)
    return gemini, openai


def _call(task):
    return asyncio.run(llm_provider.structured_completion(
        model="gpt-4o-mini", system_prompt="sys", user_content="hi",
        schema_name="s", schema={"type": "object", "properties": {}}, temperature=0, task=task,
    ))


COMBINATIONS = list(itertools.product(("gemini", "openai"), (None, "gemini", "openai"), (None, "gemini", "openai")))


@pytest.mark.parametrize("default,writing,checking", COMBINATIONS)
def test_each_task_uses_its_own_provider_or_the_default(monkeypatch, api_client, default, writing, checking):
    gemini, openai = _setup(monkeypatch, default, writing, checking)
    expected_writing = writing or default
    expected_checking = checking or default

    _, writing_used = _call("writing")
    _, checking_used = _call("checking")

    assert writing_used == expected_writing
    assert checking_used == expected_checking
    assert gemini.call_count == [expected_writing, expected_checking].count("gemini")
    assert openai.call_count == [expected_writing, expected_checking].count("openai")

    health = api_client.get("/health").json()
    assert health["llm_provider_configured"] == default
    assert health["llm_provider_writing"] == expected_writing
    assert health["llm_provider_checking"] == expected_checking
    assert health["llm_provider_writing_active"] == expected_writing
    assert health["llm_provider_checking_active"] == expected_checking
    assert health["llm_provider_active"] == llm_provider.overall_provider([expected_writing, expected_checking])


def test_text_completion_follows_the_writing_provider(monkeypatch):
    _setup(monkeypatch, "openai", "gemini", None)
    gemini_text = AsyncMock(return_value="gemini text")
    monkeypatch.setattr(llm_provider, "_gemini_text_call", gemini_text)
    monkeypatch.setattr(llm_provider, "_openai_text_call", AsyncMock(return_value="openai text"))

    text, provider = asyncio.run(llm_provider.text_completion(
        model="gpt-4o-mini", system_prompt="sys", user_content="hi", task="writing",
    ))

    assert (text, provider) == ("gemini text", "gemini")


def test_checking_on_gemini_uses_the_verifier_model(monkeypatch):
    gemini, _ = _setup(monkeypatch, "gemini", None, None)
    monkeypatch.setattr(config, "GEMINI_MODEL", "writing-model")
    monkeypatch.setattr(config, "GEMINI_VERIFIER_MODEL", "checking-model")

    _call("writing")
    _call("checking")

    assert [c.kwargs["model"] for c in gemini.call_args_list] == ["writing-model", "checking-model"]


def test_checking_task_gets_the_same_fallback(monkeypatch):
    gemini, openai = _setup(monkeypatch, "openai", "openai", "gemini")
    gemini.side_effect = genai_errors.ServerError(503, {"error": {"code": 503, "status": "UNAVAILABLE", "message": "busy"}})

    parsed, provider = _call("checking")

    assert (parsed, provider) == ({"from": "openai"}, "openai")
    assert gemini.call_count == 2  # one retry on a 503, then OpenAI
    openai.assert_called_once()


def test_one_breaker_covers_both_tasks(monkeypatch):
    gemini, openai = _setup(monkeypatch, "gemini", "gemini", "gemini")
    gemini.side_effect = genai_errors.ClientError(400, {"error": {
        "code": 400, "status": "INVALID_ARGUMENT", "message": "API key not valid. Please pass a valid API key.",
    }})

    _call("writing")  # invalid key opens the breaker
    _, provider = _call("checking")

    assert provider == "openai"
    assert gemini.call_count == 1  # the checking call never touched Gemini


def test_grounding_follows_the_writing_provider(monkeypatch):
    _setup(monkeypatch, "openai", "gemini", "openai")
    assert llm_provider.gemini_available("writing") is True
    assert llm_provider.gemini_available("checking") is False

    monkeypatch.setattr(config, "LLM_PROVIDER_WRITING", "openai")
    assert llm_provider.gemini_available("writing") is False


def test_task_is_required_and_must_be_known(monkeypatch):
    _setup(monkeypatch, "openai", None, None)
    with pytest.raises(TypeError):
        asyncio.run(llm_provider.structured_completion(
            model="m", system_prompt="s", user_content="u", schema_name="n", schema={}, temperature=0,
        ))
    with pytest.raises(ValueError):
        _call("summarising")


@pytest.mark.parametrize("var", ["LLM_PROVIDER_WRITING", "LLM_PROVIDER_CHECKING"])
def test_invalid_per_task_value_fails_at_startup(var):
    env = {**os.environ, var: "claude"}
    result = subprocess.run(
        [sys.executable, "-c", "import agents.config"], cwd=REPO, env=env, capture_output=True, text=True,
    )
    assert result.returncode != 0
    assert var in result.stderr


# Each module's LLM calls must name the task they belong to.
EXPECTED_TASKS = {
    "agents/rag_pipeline.py": {"writing"},      # frameworks + category classification
    "agents/synthesis.py": {"writing"},
    "agents/report_qa.py": {"writing"},         # Ask AI
    "agents/claim_verifier.py": {"checking"},
    "agents/claim_repair.py": {"checking"},
}


@pytest.mark.parametrize("path,expected", EXPECTED_TASKS.items())
def test_every_call_site_names_its_task(path, expected):
    tree = ast.parse((REPO / path).read_text(encoding="utf-8"))
    tasks = []
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in ("structured_completion", "text_completion")):
            task = next((kw.value.value for kw in node.keywords if kw.arg == "task"), None)
            tasks.append(task)
    assert tasks, f"no LLM calls found in {path}"
    assert set(tasks) == expected, f"{path}: {tasks}"
