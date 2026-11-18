# agents/mississauga_data.py's query_directory() against the real City
# of Mississauga ArcGIS FeatureServer endpoints -- all HTTP calls are
# mocked here (no real network), exercising the real decision logic:
# exact business-name match -> NAICS-sector fallback -> keyword fallback
# -> not_found, plus the sanitisation/scope-gating helpers in isolation.
import asyncio
from unittest.mock import patch

import httpx

from agents.mississauga_data import (
    query_directory,
    sanitize_business_name,
    is_mississauga_scope,
    infer_sector_keywords,
    build_naics_priority_plan,
    DEFAULT_DIRECTORY_URL,
    EMPLOYMENT_SURVEY_URL,
    EATERIES_URL,
)


def test_sanitize_business_name_keeps_only_alnum_space_ampersand_dot():
    # Matches server.ts's `.replace(/[^a-zA-Z0-9 &.]/g, " ")` exactly --
    # each disallowed character becomes its own space, never collapsed.
    assert sanitize_business_name("Tim's Coffee & Co.! @2025") == "Tim s Coffee & Co.   2025"
    assert sanitize_business_name(None) == ""
    assert sanitize_business_name("  spaced  out  ") == "spaced  out"


def test_is_mississauga_scope_matches_city_gta_and_ontario_only():
    assert is_mississauga_scope("Mississauga, ON, Canada")
    assert is_mississauga_scope("Greater Toronto Area (GTA)")
    assert is_mississauga_scope("Ontario")
    assert not is_mississauga_scope("Austin, TX")
    assert not is_mississauga_scope(None)
    assert not is_mississauga_scope("")


def test_infer_sector_keywords_matches_catering_terms():
    kw = infer_sector_keywords("Food Mamba", "Corporate catering and events platform", None)
    assert "CATER" in kw
    assert "FOOD" in kw


def test_build_naics_priority_plan_prioritizes_caterers():
    plan = build_naics_priority_plan("Food Mamba", "Corporate catering platform", None, ["CATER", "FOOD"])
    assert plan["exact_where"] == "NAICSCode = '722320'"
    assert "722" in plan["broad_where"]


def _json_response(payload: dict) -> httpx.Response:
    return httpx.Response(200, json=payload, request=httpx.Request("GET", "https://example.com"))


def _empty_response() -> httpx.Response:
    return _json_response({"features": []})


class _FakeAsyncClient:
    """Routes AsyncClient.get(endpoint, params=...) calls to a caller-
    supplied responder keyed by (endpoint, whether this is a count query),
    so each test controls exactly what each real endpoint returns without
    any real HTTP call."""

    def __init__(self, responder):
        self._responder = responder

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, endpoint, params=None, timeout=None):
        return self._responder(endpoint, params or {})


def _patched_client(responder):
    return patch("agents.mississauga_data.httpx.AsyncClient", lambda: _FakeAsyncClient(responder))


def test_exact_business_name_match_returns_found_status():
    def responder(endpoint, params):
        if endpoint == DEFAULT_DIRECTORY_URL and "LIKE" in params.get("where", "") and "returnCountOnly" not in params:
            return _json_response({"features": [{"attributes": {
                "BusinessName": "FOOD MAMBA CATERING", "NAICSCode": "722320",
                "NAICSDescription": "Caterers", "CHArea": "Airport Corporate Centre", "EmplRange": "1-4",
            }}]})
        return _empty_response()

    with _patched_client(responder):
        result = asyncio.run(query_directory(
            mode="business", business_name="Food Mamba Catering", idea=None, industry=None,
            geography="Mississauga, ON, Canada", data_source_url=None,
        ))

    assert result["status"] == "found"
    assert result["exact_match"] is True
    assert result["matched_count"] == 1
    assert len(result["citations"]) >= 1
    directory_citation = result["citations"][0]
    assert directory_citation["source_url"].startswith(DEFAULT_DIRECTORY_URL)
    assert directory_citation["similarity"] is None  # never a pgvector score -- not a vector-matched source


def test_unlisted_business_falls_back_to_naics_sector_peers():
    def responder(endpoint, params):
        where = params.get("where", "")
        if endpoint != DEFAULT_DIRECTORY_URL:
            return _empty_response()
        if "returnCountOnly" in params:
            return _json_response({"count": 42})
        if where == "NAICSCode = '722320'":
            return _json_response({"features": [{"attributes": {
                "BusinessName": "Mississauga Catering Co", "NAICSCode": "722320",
                "NAICSDescription": "Caterers", "CHArea": "Meadowvale", "EmplRange": "5-9",
            }}]})
        return _empty_response()

    with _patched_client(responder):
        # "Food Mamba" (not "Nonexistent Trade Name") so it actually
        # matches SECTOR_MAP's \bfood\b -- same real word-boundary
        # behavior as the ported JS regex (inferSectorKeywords), where
        # "catering" alone does NOT match \bcater\b but a whole-word
        # "food"/"cater" does and pulls in the whole CATER/FOOD/
        # RESTAURANT term group together.
        result = asyncio.run(query_directory(
            mode="business", business_name="Food Mamba", idea="corporate catering platform", industry=None,
            geography="Mississauga, ON, Canada", data_source_url=None,
        ))

    assert result["status"] == "sector_context"
    assert result["exact_match"] is False
    assert result["matched_count"] == 1
    assert result["total_sector_count"] == 42
    assert "Mississauga Catering Co" in result["citations"][0]["snippet"]


def test_nothing_found_anywhere_returns_not_found_with_no_fabricated_citation():
    with _patched_client(lambda endpoint, params: _empty_response()):
        result = asyncio.run(query_directory(
            mode="idea", business_name=None, idea="a completely generic venture", industry=None,
            geography="Mississauga, ON, Canada", data_source_url=None,
        ))

    assert result["status"] == "not_found"
    assert result["matched_count"] == 0
    assert result["citations"] == []


def test_network_failure_degrades_to_not_found_never_raises():
    class _BrokenClient(_FakeAsyncClient):
        async def get(self, endpoint, params=None, timeout=None):
            raise httpx.ConnectError("boom")

    with patch("agents.mississauga_data.httpx.AsyncClient", lambda: _BrokenClient(lambda *a: None)):
        result = asyncio.run(query_directory(
            mode="business", business_name="Anything", idea=None, industry=None,
            geography="Mississauga, ON, Canada", data_source_url=None,
        ))

    assert result["status"] == "not_found"
    assert result["citations"] == []


def test_custom_data_source_url_is_queried_instead_of_default():
    custom_url = "https://services6.arcgis.com/custom/FeatureServer/0/query"
    seen_endpoints = []

    def responder(endpoint, params):
        seen_endpoints.append(endpoint)
        return _empty_response()

    with _patched_client(responder):
        asyncio.run(query_directory(
            mode="business", business_name="Food Mamba", idea=None, industry=None,
            geography="Mississauga, ON, Canada", data_source_url=custom_url,
        ))

    assert any(e == custom_url for e in seen_endpoints)
    # Supplementary employment/eateries datasets are only queried against
    # the DEFAULT directory, never a custom endpoint.
    assert EMPLOYMENT_SURVEY_URL not in seen_endpoints
    assert EATERIES_URL not in seen_endpoints
