# fix/remove-seed-corpus: a citation must be a real, public web page.
# Placeholder hosts (example.com etc.), local/private addresses, reserved
# test TLDs, non-http(s) and empty URLs are refused at ingest and dropped
# at retrieval, and the hand-written data/raw seed corpus is gone.
from pathlib import Path
from unittest.mock import AsyncMock
import asyncio
import re

import pytest

from agents import rag_pipeline
from agents.ingest import ingest_content
from agents.source_urls import is_public_source_url, placeholder_reason

REPO = Path(__file__).resolve().parents[3]

PLACEHOLDERS = [
    "https://example.com/pestel-source",
    "https://example.com/swot-source",
    "http://www.example.org/report",
    "https://example.net",
    "https://docs.example.com/x",
    "http://localhost:8000/doc",
    "http://127.0.0.1/doc",
    "http://10.0.0.5/doc",
    "http://192.168.1.20/doc",
    "http://169.254.1.1/doc",
    "http://[::1]/doc",
    "https://market.test/report",
    "https://data.invalid/x",
    "http://printer.local/status",
    "http://intranet/wiki",
    "",
    "   ",
    None,
    "ftp://files.statcan.gc.ca/x.csv",
    "CAESkAEB6zswFRFTTlozMm-TTGm_Ebf_-k2BWEZrd5HS1wFnt0Oat",  # opaque token, no scheme
]

REAL = [
    "https://www.ontario.ca/page/electric-vehicles",
    "http://ieso.ca/en/Learn",
    "https://services6.arcgis.com/abc/arcgis/rest/services/Business_Directory/FeatureServer/0/query",
    "https://8.8.8.8/",
    "https://www.example-site.com/report",  # 'example' only as part of a label
]


@pytest.mark.parametrize("url", PLACEHOLDERS)
def test_placeholder_urls_are_not_public_sources(url):
    assert placeholder_reason(url) is not None
    assert is_public_source_url(url) is False


@pytest.mark.parametrize("url", REAL)
def test_real_public_urls_are_accepted(url):
    assert placeholder_reason(url) is None


@pytest.mark.parametrize("url", PLACEHOLDERS)
def test_ingest_refuses_placeholder_urls_before_embedding_or_storing(monkeypatch, url):
    import agents.ingest as ingest_module

    monkeypatch.setattr(ingest_module, "embed_batch", lambda texts: pytest.fail("must not embed"))
    monkeypatch.setattr(ingest_module, "insert_source", lambda **kw: pytest.fail("must not store"))
    with pytest.raises(ValueError, match="Refusing to ingest"):
        ingest_content(text="68% of prospective EV buyers cite charging convenience.",
                       title="PESTEL: EV Charging Market", url=url, framework_tag="pestel")


def _chunk(url, title, similarity=0.7):
    return {"id": title, "chunk_text": f"text from {title}", "source_title": title, "source_url": url,
            "similarity": similarity, "confidence_score": 0.8}


def test_retrieval_drops_placeholder_chunks_even_if_they_are_in_the_database(monkeypatch):
    rows = [
        _chunk("https://example.com/pestel-source", "PESTEL: EV Charging Market", 0.9),
        _chunk("https://www.ontario.ca/page/electric-vehicles", "Ontario EVs", 0.7),
        _chunk("CAESewHrOzAV9MjKULrBD1Mn", "Opaque token row", 0.8),
    ]
    monkeypatch.setattr(rag_pipeline, "search_similar", lambda embedding, top_k=8, framework_tag=None: rows)

    kept = asyncio.run(rag_pipeline._search_similar_chunks([0.0], framework_tag="pestel"))

    assert [c["source_title"] for c in kept] == ["Ontario EVs"]


def test_a_placeholder_chunk_never_reaches_generation(monkeypatch):
    rows = [
        _chunk("https://example.com/pestel-source", "PESTEL: EV Charging Market", 0.9),
        _chunk("https://www.ontario.ca/page/electric-vehicles", "Ontario EVs", 0.7),
    ]
    seen = {}

    async def fake_generate(query, context_chunks, framework_tag=None, extra_context_chunks=None,
                            specific_category=None, parent_category=None):
        seen["urls"] = [c["source_url"] for c in context_chunks]
        return {"text": "Grounded [1].", "citations": [{"index": 1}]}

    monkeypatch.setattr(rag_pipeline, "embed_query", AsyncMock(return_value=[0.0] * 3))
    monkeypatch.setattr(rag_pipeline, "search_similar", lambda embedding, top_k=8, framework_tag=None: rows)
    monkeypatch.setattr(rag_pipeline, "generate_with_citations", fake_generate)
    monkeypatch.setattr(rag_pipeline, "verify_claims", AsyncMock(return_value={"verified": True, "unsupported_claims": [], "claims": []}))
    monkeypatch.setattr(rag_pipeline.web_retrieval, "search_and_ingest", AsyncMock(return_value=0))

    asyncio.run(rag_pipeline.run_pipeline("EV charging in Mississauga", framework_tag="pestel"))

    assert seen["urls"] == ["https://www.ontario.ca/page/electric-vehicles"]


def test_the_seed_corpus_files_are_gone_and_nothing_references_them():
    assert not list((REPO / "data").glob("raw/*_source.txt"))
    pattern = re.compile(r"data[/\\]raw|(pestel|swot|tam|bmc)_source\.txt")
    # Every place an ingest could be wired up: app code, deploy config, and
    # the docs that tell people how to load data.
    paths = [*(REPO / "agents").rglob("*.py"), *(REPO / "backend").rglob("*.py"),
             REPO / "render.yaml", REPO / "README.md", REPO / "docs" / "local-testing.md",
             REPO / "docs" / "deploy-render.md"]
    offenders = [str(p.relative_to(REPO)) for p in paths
                 if p.exists() and "site-packages" not in p.parts and pattern.search(p.read_text(encoding="utf-8", errors="ignore"))]
    assert offenders == []
