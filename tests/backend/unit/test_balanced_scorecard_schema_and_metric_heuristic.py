# GitHub issue #15: Balanced Scorecard. The issue explicitly flagged
# needing a decision on numeric-grounding strictness before schema
# design (it's "closer to market_sizing's numeric discipline than pure
# qualitative text"). Decision made: each perspective is still an array
# of qualitative {text, citation_index} points (same base shape as
# every other framework -- naturally supports "empty when ungrounded"),
# but each point MAY also carry an optional grounded metric_name/
# metric_value/target_value trio -- unlike BCG Matrix's single
# forced-choice quadrant, there's no single all-or-nothing field here
# that risks the model always guessing something.
from agents.rag_pipeline import (
    STRUCTURED_FRAMEWORKS,
    BALANCED_SCORECARD_CATEGORIES,
    BALANCED_SCORECARD_SCHEMA,
    _null_out_ungrounded_scorecard_metrics,
)


def test_balanced_scorecard_has_four_standard_perspectives():
    assert BALANCED_SCORECARD_CATEGORIES == ("financial", "customer", "internal_process", "learning_and_growth")


def test_balanced_scorecard_registered_in_structured_frameworks():
    assert "balanced_scorecard" in STRUCTURED_FRAMEWORKS
    _suffix, field_name, schema_name, schema = STRUCTURED_FRAMEWORKS["balanced_scorecard"]
    assert field_name == "balanced_scorecard"
    assert schema_name == "grounded_balanced_scorecard_analysis"
    assert schema is BALANCED_SCORECARD_SCHEMA


def test_balanced_scorecard_item_schema_has_metric_fields_all_nullable():
    item_schema = BALANCED_SCORECARD_SCHEMA["properties"]["balanced_scorecard"]["properties"]["financial"]["items"]
    assert set(item_schema["properties"]) == {"text", "citation_index", "metric_name", "metric_value", "target_value"}
    for field in ("citation_index", "metric_name", "metric_value", "target_value"):
        assert "null" in item_schema["properties"][field]["type"], f"{field} should be nullable"
    # All 5 required in strict-schema mode, even the nullable ones
    assert set(item_schema["required"]) == {"text", "citation_index", "metric_name", "metric_value", "target_value"}


def _item(text="x", citation_index=None, metric_name=None, metric_value=None, target_value=None):
    return {
        "text": text, "citation_index": citation_index,
        "metric_name": metric_name, "metric_value": metric_value, "target_value": target_value,
    }


def test_metric_kept_when_both_name_and_value_present():
    scorecard = {"financial": [_item(metric_name="ARR", metric_value="$4.2M", target_value="$6M")]}
    result = _null_out_ungrounded_scorecard_metrics(scorecard)
    item = result["financial"][0]
    assert item["metric_name"] == "ARR"
    assert item["metric_value"] == "$4.2M"
    assert item["target_value"] == "$6M"


def test_metric_nulled_when_name_present_but_value_missing():
    scorecard = {"customer": [_item(metric_name="Retention rate", metric_value=None, target_value="90%")]}
    result = _null_out_ungrounded_scorecard_metrics(scorecard)
    item = result["customer"][0]
    assert item["metric_name"] is None
    assert item["metric_value"] is None
    assert item["target_value"] is None


def test_metric_nulled_when_value_present_but_name_missing():
    scorecard = {"internal_process": [_item(metric_name=None, metric_value="12 days", target_value=None)]}
    result = _null_out_ungrounded_scorecard_metrics(scorecard)
    item = result["internal_process"][0]
    assert item["metric_name"] is None
    assert item["metric_value"] is None


def test_target_value_alone_is_insufficient_and_gets_nulled():
    # A target with no actual metric name/value attached isn't a usable
    # grounded metric -- same "both signals or nothing" discipline as
    # BCG Matrix's growth-rate-and-position pairing.
    scorecard = {"learning_and_growth": [_item(metric_name=None, metric_value=None, target_value="40 hours/employee")]}
    result = _null_out_ungrounded_scorecard_metrics(scorecard)
    item = result["learning_and_growth"][0]
    assert item["target_value"] is None


def test_purely_qualitative_point_untouched():
    scorecard = {"financial": [_item(text="Revenue grew steadily.", citation_index=2)]}
    result = _null_out_ungrounded_scorecard_metrics(scorecard)
    item = result["financial"][0]
    assert item["text"] == "Revenue grew steadily."
    assert item["citation_index"] == 2
    assert item["metric_name"] is None


def test_none_input_returns_none():
    assert _null_out_ungrounded_scorecard_metrics(None) is None


def test_empty_arrays_pass_through_unchanged():
    scorecard = {k: [] for k in BALANCED_SCORECARD_CATEGORIES}
    result = _null_out_ungrounded_scorecard_metrics(scorecard)
    assert result == scorecard
