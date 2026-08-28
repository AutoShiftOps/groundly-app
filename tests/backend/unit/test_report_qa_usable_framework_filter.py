# GitHub issue #20: Ask AI. Unit coverage for the deterministic parts of
# agents/report_qa.py that don't require a live OpenAI call --
# _usable() (same has-real-grounding filter as synthesis.py's _usable())
# and _ask_schema()'s shape. The actual grounded-vs-not LLM behavior is
# covered by real-call verification (see the issue's closing comment),
# same as every other framework in this project.
from agents.report_qa import _usable, _ask_schema


def test_usable_requires_framework_in_allowed_list():
    results = {"swot": {"text": "x", "citations": [{"index": 1}]}}
    assert _usable("swot", results, allowed=["swot"]) is True
    assert _usable("swot", results, allowed=["pestel"]) is False


def test_usable_requires_real_citations():
    results = {"swot": {"text": "x", "citations": []}}
    assert _usable("swot", results, allowed=["swot"]) is False


def test_usable_requires_real_text():
    results = {"swot": {"text": "", "citations": [{"index": 1}]}}
    assert _usable("swot", results, allowed=["swot"]) is False


def test_usable_false_for_framework_missing_from_results():
    assert _usable("swot", results={}, allowed=["swot"]) is False


def test_ask_schema_enum_matches_frameworks_needed():
    schema = _ask_schema(["pestel", "swot"])
    framework_enum = schema["properties"]["sources"]["items"]["properties"]["framework"]["enum"]
    assert framework_enum == ["pestel", "swot"]


def test_ask_schema_requires_answer_grounded_sources():
    schema = _ask_schema(["swot"])
    assert schema["required"] == ["answer", "grounded", "sources"]
