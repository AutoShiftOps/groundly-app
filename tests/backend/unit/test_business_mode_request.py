# /api/analyze's business-mode request path: the camelCase
# mode/businessName/dataSourceUrl fields (matching exactly what frontend/
# src/App.tsx sends) actually reach agents.mississauga_data.query_directory
# and agents.rag_pipeline.run_pipeline, a rejected dataSourceUrl returns a
# real 400 with {"error": ...} (not FastAPI's default {"detail": ...}),
# and an idea-only request still works unchanged. No real OpenAI/ArcGIS
# calls -- run_pipeline and query_directory are both mocked.
from unittest.mock import AsyncMock

import routers.analysis as analysis_module


def _fake_pipeline_output(framework_tag, directory_context=None):
    return {
        "text": f"{framework_tag} analysis [1].",
        "citations": [{"index": 1, "source_url": "https://example.com", "source_title": "x", "similarity": 0.8}],
        "assumptions": ["a1", "a2"],
        "actions": ["ac1", "ac2"],
        "verification": {"verified": True, "unsupported_claims": []},
    }


def _install_fast_fakes(monkeypatch):
    async def fake_run_pipeline(query, framework_tag=None, directory_context=None):
        return _fake_pipeline_output(framework_tag, directory_context)

    monkeypatch.setattr(analysis_module, "run_pipeline", fake_run_pipeline)
    monkeypatch.setattr(
        analysis_module, "synthesize_business_metrics",
        AsyncMock(return_value={k: None for k in
                                 ("market_size", "competitive_pressure", "customer_segment", "business_model_fit", "risk_flags")}),
    )


def test_idea_only_request_still_works_unchanged(api_client, monkeypatch):
    _install_fast_fakes(monkeypatch)
    # No geography supplied -- defaults to "Mississauga, ON, Canada" (see
    # test_missing_geography_defaults_to_mississauga_on_canada below), so
    # the directory lookup DOES run by default; this test is only about
    # the idea-only request shape still working, not about geography
    # gating, so it just stubs the lookup as not_found.
    monkeypatch.setattr(
        analysis_module.mississauga_data, "query_directory",
        AsyncMock(return_value={"status": "not_found", "matched_count": 0, "total_sector_count": None,
                                 "exact_match": False, "context_snippet": "", "citations": []}),
    )

    resp = api_client.post("/api/analyze", json={
        "idea": "a peer-to-peer synthesizer rental marketplace",
        "frameworks": ["pestel"],
        "tier": "free",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["directory_status"] == "not_found"
    assert data["rag_status"] == "grounded"
    assert data["results"]["pestel"]["assumptions"] == ["a1", "a2"]
    assert data["results"]["pestel"]["actions"] == ["ac1", "ac2"]


def test_business_mode_request_triggers_directory_lookup_with_camelcase_fields(api_client, monkeypatch):
    _install_fast_fakes(monkeypatch)
    captured = {}

    async def fake_query_directory(mode, business_name, idea, industry, geography, data_source_url):
        captured.update(mode=mode, business_name=business_name, idea=idea, industry=industry,
                         geography=geography, data_source_url=data_source_url)
        return {
            "status": "found", "matched_count": 1, "total_sector_count": None, "exact_match": True,
            "context_snippet": "Matched 1 exact record.",
            "citations": [{"source_title": "Directory", "source_url": "https://services6.arcgis.com/x", "snippet": "s", "similarity": None}],
        }

    monkeypatch.setattr(analysis_module.mississauga_data, "query_directory", fake_query_directory)

    resp = api_client.post("/api/analyze", json={
        "idea": "",
        "mode": "business",
        "businessName": "Food Mamba Catering",
        "industry": "Food & Beverage",
        "geography": "Mississauga, ON, Canada",
        "frameworks": ["pestel"],
        "tier": "free",
    })
    assert resp.status_code == 200
    data = resp.json()

    assert captured["mode"] == "business"
    assert captured["business_name"] == "Food Mamba Catering"
    assert captured["geography"] == "Mississauga, ON, Canada"

    assert data["directory_status"] == "found"
    assert data["directory_matches"] == 1
    assert data["directory_exact_match"] is True


def test_missing_geography_defaults_to_mississauga_on_canada(api_client, monkeypatch):
    _install_fast_fakes(monkeypatch)
    captured = {}

    async def fake_query_directory(mode, business_name, idea, industry, geography, data_source_url):
        captured["geography"] = geography
        return {"status": "not_found", "matched_count": 0, "total_sector_count": None, "exact_match": False,
                "context_snippet": "", "citations": []}

    monkeypatch.setattr(analysis_module.mississauga_data, "query_directory", fake_query_directory)

    resp = api_client.post("/api/analyze", json={
        "idea": "a corner store loyalty app",
        "frameworks": ["pestel"],
        "tier": "free",
    })
    assert resp.status_code == 200
    assert captured["geography"] == "Mississauga, ON, Canada"
    data = resp.json()
    # The frontend shows "<geography> (default)" so a user who never typed
    # a geography can see why directory data appears at all -- this is
    # the response contract that powers that badge.
    assert data["geography"] == "Mississauga, ON, Canada"
    assert data["geography_defaulted"] is True


def test_explicit_geography_is_not_marked_as_defaulted(api_client, monkeypatch):
    _install_fast_fakes(monkeypatch)
    captured = {}

    async def fake_query_directory(mode, business_name, idea, industry, geography, data_source_url):
        captured["geography"] = geography
        return {"status": "not_found", "matched_count": 0, "total_sector_count": None, "exact_match": False,
                "context_snippet": "", "citations": []}

    monkeypatch.setattr(analysis_module.mississauga_data, "query_directory", fake_query_directory)

    resp = api_client.post("/api/analyze", json={
        "idea": "a corner store loyalty app",
        "geography": "Mississauga, Ontario",
        "frameworks": ["pestel"],
        "tier": "free",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["geography"] == "Mississauga, Ontario"
    assert data["geography_defaulted"] is False


def test_rejected_data_source_url_returns_400_with_error_key_not_detail(api_client, monkeypatch):
    _install_fast_fakes(monkeypatch)
    monkeypatch.setattr(
        analysis_module.mississauga_data, "query_directory",
        AsyncMock(side_effect=AssertionError("should never reach the directory lookup -- request must be rejected first")),
    )

    resp = api_client.post("/api/analyze", json={
        "idea": "a corner store loyalty app",
        "dataSourceUrl": "https://evil.example.com/not-allowed",
        "frameworks": ["pestel"],
        "tier": "free",
    })
    assert resp.status_code == 400
    body = resp.json()
    assert "error" in body, f"expected an 'error' key (frontend reads data.error), got: {body}"
    assert "detail" not in body
    assert "evil.example.com" in body["error"]


def test_non_mississauga_geography_skips_directory_lookup_entirely(api_client, monkeypatch):
    _install_fast_fakes(monkeypatch)
    monkeypatch.setattr(
        analysis_module.mississauga_data, "query_directory",
        AsyncMock(side_effect=AssertionError("directory lookup must not run for a non-Mississauga/GTA/Ontario geography")),
    )

    resp = api_client.post("/api/analyze", json={
        "idea": "a corner store loyalty app",
        "geography": "Austin, TX",
        "frameworks": ["pestel"],
        "tier": "free",
    })
    assert resp.status_code == 200
    assert resp.json()["directory_status"] is None
