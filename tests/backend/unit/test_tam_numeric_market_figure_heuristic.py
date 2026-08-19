# Follow-up: paywalled market-research aggregator pages (confirmed live,
# twice -- researchandmarkets.com and dataintelo.com) scrape into a
# table-of-contents layer dense with exactly the right vocabulary ("Total
# Addressable Market", "Market Size", "Growth Rate") but containing zero
# actual dollar figures or percentages. A chunk like that can score above
# MIN_CONTEXT_SIMILARITY on vocabulary alone (confirmed: 0.62 on one real
# case). agents/rag_pipeline.py's _null_out_unsupported_tam_tiers() is a
# cheap regex backstop, tam-only, that nulls a market_sizing tier whose
# cited chunk has no real dollar/percentage figure -- deterministic, no
# extra LLM call.
from agents.rag_pipeline import _chunk_has_numeric_market_figure, _null_out_unsupported_tam_tiers

TOC_ONLY_CHUNK = (
    "The total addressable market (TAM) analysis section defines and estimates the "
    "market potential compares it with the current market size, and provides "
    "strategic insights and growth opportunities based on this evaluation. [...] "
    "7.1. Global Subscription Box PESTEL Analysis (Political, Social, Technological, "
    "Environmental and Legal Factors, Drivers and Restraints)\n"
    "7.2. Global Subscription Box Market Size, Comparisons and Growth Rate Analysis\n"
    "7.3. Global Subscription Box Historic Market Size and Growth, 2020-2025, Value ($ Billion)\n"
    "8. Global Subscription Box Total Addressable Market (TAM) Analysis for the Market [...] "
    "8.3. Global Total Addressable Market (TAM) Estimation"
)

REAL_DOLLAR_CHUNK = "The global EV charging market is valued at $22B in 2024, growing at a 22% CAGR."
REAL_PERCENT_ONLY_CHUNK = "The home charging segment is expected to grow at 18.5% annually through 2030."


def test_toc_only_chunk_has_no_numeric_figure():
    # Real production chunk (verbatim, minus the URL) -- zero dollar
    # figures, zero percentages, only section numbers and year ranges.
    assert not _chunk_has_numeric_market_figure(TOC_ONLY_CHUNK)


def test_real_dollar_figure_chunk_is_detected():
    assert _chunk_has_numeric_market_figure(REAL_DOLLAR_CHUNK)


def test_real_percentage_only_chunk_is_detected():
    # CAGR/growth-rate mentions are percentage-formatted in practice --
    # the percentage pattern alone covers the "CAGR-style growth-rate
    # mention" case without a separate CAGR-specific regex.
    assert _chunk_has_numeric_market_figure(REAL_PERCENT_ONLY_CHUNK)


def test_year_ranges_and_section_numbers_alone_do_not_count():
    # The exact false-positive risk this heuristic must avoid: a TOC's
    # "2020-2025" / "7.1" / "8.3" are digit sequences but not market figures.
    assert not _chunk_has_numeric_market_figure("Section 7.1 covers 2020-2025 forecasts.")


def test_null_out_unsupported_tiers_nulls_toc_only_citation():
    market_sizing = {
        "tam": {"value_usd": 5_000_000_000, "label": "$5B", "citation_index": 1, "cagr_pct": None, "tier_description": "desc"},
        "sam": None,
        "som": None,
    }
    context_chunks = [{"chunk_text": TOC_ONLY_CHUNK}]
    result = _null_out_unsupported_tam_tiers(market_sizing, context_chunks)
    assert result["tam"] is None, "tam tier cited a numeric-free chunk -- must be nulled"
    assert result["sam"] is None
    assert result["som"] is None


def test_null_out_unsupported_tiers_keeps_real_numeric_citation():
    market_sizing = {
        "tam": {"value_usd": 22_000_000_000, "label": "$22B", "citation_index": 1, "cagr_pct": 22, "tier_description": "EV charging market"},
        "sam": None,
        "som": None,
    }
    context_chunks = [{"chunk_text": REAL_DOLLAR_CHUNK}]
    result = _null_out_unsupported_tam_tiers(market_sizing, context_chunks)
    assert result["tam"] == market_sizing["tam"], "real numeric citation must survive unchanged -- this is the regression check that matters most"


def test_null_out_unsupported_tiers_leaves_null_citation_index_alone():
    # citation_index: null is a pre-existing, separate allowance (the
    # model legitimately couldn't attribute the figure to one specific
    # chunk) -- this heuristic only concerns tiers that DO point at a
    # specific chunk, so a null-citation_index tier must pass through
    # untouched, not get penalized for something it never claimed.
    market_sizing = {
        "tam": {"value_usd": 5_000_000_000, "label": "$5B", "citation_index": None, "cagr_pct": None, "tier_description": None},
        "sam": None,
        "som": None,
    }
    context_chunks = [{"chunk_text": TOC_ONLY_CHUNK}]
    result = _null_out_unsupported_tam_tiers(market_sizing, context_chunks)
    assert result["tam"] == market_sizing["tam"]


def test_null_out_unsupported_tiers_handles_multiple_tiers_independently():
    # tam cites a real numeric chunk (kept), sam cites the TOC-only chunk
    # (nulled) -- each tier validated against its own citation_index, not
    # a batch pass/fail.
    market_sizing = {
        "tam": {"value_usd": 22_000_000_000, "label": "$22B", "citation_index": 1, "cagr_pct": 22, "tier_description": "d"},
        "sam": {"value_usd": 5_000_000_000, "label": "$5B", "citation_index": 2, "cagr_pct": None, "tier_description": "d"},
        "som": None,
    }
    context_chunks = [{"chunk_text": REAL_DOLLAR_CHUNK}, {"chunk_text": TOC_ONLY_CHUNK}]
    result = _null_out_unsupported_tam_tiers(market_sizing, context_chunks)
    assert result["tam"] == market_sizing["tam"]
    assert result["sam"] is None
    assert result["som"] is None


def test_null_out_unsupported_tiers_handles_out_of_range_citation_index_gracefully():
    # Defensive: an out-of-range citation_index (should not happen, but
    # must never crash the request) is left as-is rather than raising.
    market_sizing = {
        "tam": {"value_usd": 5_000_000_000, "label": "$5B", "citation_index": 99, "cagr_pct": None, "tier_description": None},
        "sam": None,
        "som": None,
    }
    context_chunks = [{"chunk_text": REAL_DOLLAR_CHUNK}]
    result = _null_out_unsupported_tam_tiers(market_sizing, context_chunks)
    assert result["tam"] == market_sizing["tam"]
