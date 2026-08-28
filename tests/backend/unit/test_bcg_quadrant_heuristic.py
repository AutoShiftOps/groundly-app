# GitHub issue #13. BCG Matrix needs the same numeric-grounding
# discipline as market_sizing (docs/TEST_COVERAGE_SPEC.md's original
# concern, extended here): a quadrant assignment (star/cash_cow/
# question_mark/dog) is only trustworthy if the model actually had both a
# real market growth rate AND a real market-position description to
# justify it. _null_out_unsupported_bcg_quadrant() is a deterministic
# backstop -- same philosophy as _null_out_unsupported_tam_tiers() --
# that verifies this rather than trusting the model's own judgment alone.
from agents.rag_pipeline import _null_out_unsupported_bcg_quadrant


def _quadrant(growth_rate=15.0, position="Market leader with an estimated 40% share"):
    return {
        "quadrant": "star",
        "market_growth_rate_pct": growth_rate,
        "market_share_position": position,
        "citation_index": 1,
        "rationale": "High growth with a leading market position.",
    }


def test_none_passes_through_unchanged():
    assert _null_out_unsupported_bcg_quadrant(None) is None


def test_fully_grounded_quadrant_is_kept():
    q = _quadrant()
    assert _null_out_unsupported_bcg_quadrant(q) == q


def test_missing_growth_rate_nulls_out_the_whole_result():
    q = _quadrant(growth_rate=None)
    assert _null_out_unsupported_bcg_quadrant(q) is None


def test_missing_market_position_nulls_out_the_whole_result():
    q = _quadrant(position=None)
    assert _null_out_unsupported_bcg_quadrant(q) is None


def test_empty_string_market_position_counts_as_missing():
    # Defensive against a model returning "" instead of null for an
    # ungrounded field -- must not count as "real" grounding.
    q = _quadrant(position="   ")
    assert _null_out_unsupported_bcg_quadrant(q) is None


def test_both_missing_nulls_out():
    q = _quadrant(growth_rate=None, position=None)
    assert _null_out_unsupported_bcg_quadrant(q) is None


def test_zero_percent_growth_rate_is_a_real_value_not_missing():
    # 0.0 is falsy in Python but is a genuine, real growth-rate figure
    # (a stagnant market) -- must not be treated the same as null/missing.
    q = _quadrant(growth_rate=0.0)
    assert _null_out_unsupported_bcg_quadrant(q) == q
