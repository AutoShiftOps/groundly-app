# GitHub issue #16: Ansoff Matrix. Same "don't guess a quadrant without
# real dual grounding" discipline as BCG Matrix (issue #13,
# test_bcg_quadrant_heuristic.py) -- here the two dimensions are
# categorical (market: existing/new, product: existing/new) instead of
# numeric (growth rate, market share position).
from agents.rag_pipeline import (
    STRUCTURED_FRAMEWORKS,
    ANSOFF_QUADRANTS,
    ANSOFF_MATRIX_SCHEMA,
    _null_out_unsupported_ansoff_quadrant,
)


def test_ansoff_has_four_standard_quadrants():
    assert set(ANSOFF_QUADRANTS) == {
        "market_penetration", "market_development", "product_development", "diversification",
    }


def test_ansoff_registered_in_structured_frameworks():
    assert "ansoff" in STRUCTURED_FRAMEWORKS
    _suffix, field_name, schema_name, schema = STRUCTURED_FRAMEWORKS["ansoff"]
    assert field_name == "ansoff_matrix"
    assert schema_name == "grounded_ansoff_analysis"
    assert schema is ANSOFF_MATRIX_SCHEMA


def _matrix(quadrant="market_penetration", market_dimension=None, product_dimension=None):
    return {
        "quadrant": quadrant, "market_dimension": market_dimension, "product_dimension": product_dimension,
        "citation_index": 1, "rationale": "x",
    }


def test_quadrant_kept_when_both_dimensions_real():
    result = _null_out_unsupported_ansoff_quadrant(_matrix(market_dimension="existing", product_dimension="new"))
    assert result is not None
    assert result["quadrant"] == "market_penetration"


def test_quadrant_nulled_when_market_dimension_missing():
    result = _null_out_unsupported_ansoff_quadrant(_matrix(market_dimension=None, product_dimension="new"))
    assert result is None


def test_quadrant_nulled_when_product_dimension_missing():
    result = _null_out_unsupported_ansoff_quadrant(_matrix(market_dimension="existing", product_dimension=None))
    assert result is None


def test_quadrant_nulled_when_both_dimensions_missing():
    result = _null_out_unsupported_ansoff_quadrant(_matrix(market_dimension=None, product_dimension=None))
    assert result is None


def test_quadrant_nulled_when_dimension_value_is_garbage_not_just_falsy():
    # A dimension value that isn't literally "existing" or "new" (e.g. a
    # stray empty string or an unexpected value) shouldn't count as real
    # grounding either -- same defensive strictness as BCG's numeric check.
    result = _null_out_unsupported_ansoff_quadrant(_matrix(market_dimension="unclear", product_dimension="new"))
    assert result is None


def test_none_input_returns_none():
    assert _null_out_unsupported_ansoff_quadrant(None) is None
