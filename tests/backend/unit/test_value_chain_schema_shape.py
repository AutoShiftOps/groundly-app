# GitHub issue #14: Porter's Value Chain. Same generic qualitative
# {text, citation_index}-per-category shape as PESTEL/SWOT/BMC/Porter/STP
# (agents/rag_pipeline.py's _category_breakdown_schema), so unlike BCG
# Matrix this doesn't need its own bespoke null-discipline backstop --
# these tests just lock in the 9-category shape (5 primary + 4 support)
# actually matches the issue's spec and STRUCTURED_FRAMEWORKS wiring.
from agents.rag_pipeline import (
    STRUCTURED_FRAMEWORKS,
    VALUE_CHAIN_CATEGORIES,
    VALUE_CHAIN_PRIMARY_CATEGORIES,
    VALUE_CHAIN_SUPPORT_CATEGORIES,
    VALUE_CHAIN_SCHEMA,
)


def test_value_chain_has_nine_categories_five_primary_four_support():
    assert VALUE_CHAIN_PRIMARY_CATEGORIES == (
        "inbound_logistics", "operations", "outbound_logistics", "marketing_and_sales", "service",
    )
    assert VALUE_CHAIN_SUPPORT_CATEGORIES == (
        "firm_infrastructure", "human_resource_management", "technology_development", "procurement",
    )
    assert len(VALUE_CHAIN_CATEGORIES) == 9
    assert set(VALUE_CHAIN_CATEGORIES) == set(VALUE_CHAIN_PRIMARY_CATEGORIES) | set(VALUE_CHAIN_SUPPORT_CATEGORIES)


def test_value_chain_registered_in_structured_frameworks():
    assert "value_chain" in STRUCTURED_FRAMEWORKS
    _suffix, field_name, schema_name, schema = STRUCTURED_FRAMEWORKS["value_chain"]
    assert field_name == "value_chain"
    assert schema_name == "grounded_value_chain_analysis"
    assert schema is VALUE_CHAIN_SCHEMA


def test_value_chain_schema_requires_narrative_and_all_nine_categories():
    props = VALUE_CHAIN_SCHEMA["properties"]["value_chain"]["properties"]
    assert set(props) == set(VALUE_CHAIN_CATEGORIES)
    assert set(VALUE_CHAIN_SCHEMA["properties"]["value_chain"]["required"]) == set(VALUE_CHAIN_CATEGORIES)
    assert VALUE_CHAIN_SCHEMA["required"] == ["narrative", "value_chain"]
