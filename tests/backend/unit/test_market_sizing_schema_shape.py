# docs/TEST_COVERAGE_SPEC.md #2 (backend half): "cagr_pct, tier_description,
# and the market-sizing tiers themselves must be null when the CONTEXT
# doesn't support them -- never estimated, never a fallback default."
#
# This asserts the schema *shape* actually allows null everywhere that
# discipline depends on -- pure static-dict inspection, no API call, no
# LLM output involved (deliberately not asserting anything about actual
# generated content, per the spec's "don't test LLM output content"
# guidance). If a future edit tightens one of these fields back to a
# required-non-null type, OpenAI's strict schema mode would then force the
# model to always fabricate a value instead of being allowed to say "I
# don't know" -- this is exactly the regression this test exists to catch.
from agents.rag_pipeline import MARKET_SIZING_SCHEMA, _CATEGORY_ITEM_SCHEMA


def _tier_schema(tier: str) -> dict:
    tier_any_of = MARKET_SIZING_SCHEMA["properties"]["market_sizing"]["properties"][tier]["anyOf"]
    object_variant = next(v for v in tier_any_of if v.get("type") == "object")
    null_variant = next(v for v in tier_any_of if v.get("type") == "null")
    return object_variant, null_variant


def test_each_tier_can_be_null_outright():
    # A whole tier (not just individual fields inside it) must be allowed
    # to be null -- e.g. SOM genuinely absent when the CONTEXT never gives
    # a realistic-capture figure at all.
    for tier in ("tam", "sam", "som"):
        _, null_variant = _tier_schema(tier)
        assert null_variant == {"type": "null"}


def test_cagr_pct_and_tier_description_allow_null_when_tier_present():
    # Even when a tier object IS present (grounded value_usd/label exist),
    # cagr_pct and tier_description must independently be allowed to be
    # null -- a real dollar figure with no stated growth rate, or no
    # specific description, is a normal, expected combination.
    for tier in ("tam", "sam", "som"):
        object_variant, _ = _tier_schema(tier)
        props = object_variant["properties"]
        assert props["cagr_pct"]["type"] == ["number", "null"]
        assert props["tier_description"]["type"] == ["string", "null"]
        # OpenAI strict-mode schemas require every property present in
        # "required" even when its type union includes null -- that's how
        # "must be present, but allowed to be null" is expressed. Being
        # missing from `required` here would be a stricter-mode violation,
        # not a looser one, so this isn't in tension with the null
        # discipline above.
        assert "cagr_pct" in object_variant["required"]
        assert "tier_description" in object_variant["required"]


def test_citation_index_allows_null_on_tiers_and_category_items():
    for tier in ("tam", "sam", "som"):
        object_variant, _ = _tier_schema(tier)
        assert object_variant["properties"]["citation_index"]["type"] == ["integer", "null"]

    # Shared by PESTEL/SWOT/BMC's category items (agents/rag_pipeline.py's
    # _category_breakdown_schema) -- same "attribute it, or say you can't"
    # discipline as market_sizing's citation_index.
    assert _CATEGORY_ITEM_SCHEMA["properties"]["citation_index"]["type"] == ["integer", "null"]


def test_market_sizing_schema_has_no_fallback_default_values():
    # There should be no "default" key anywhere feeding a tier -- a JSON
    # schema default is exactly the kind of silent fabrication-by-fallback
    # this project has held itself to never doing.
    def _walk(node):
        if isinstance(node, dict):
            assert "default" not in node, f"Found a schema default: {node}"
            for v in node.values():
                _walk(v)
        elif isinstance(node, list):
            for v in node:
                _walk(v)

    _walk(MARKET_SIZING_SCHEMA)
