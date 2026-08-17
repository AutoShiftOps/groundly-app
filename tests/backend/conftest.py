# Shared pytest fixtures for tests/backend/. pytest.ini's `pythonpath = .
# backend` already makes `agents.*` and `routers.*`/`main` importable
# without manual sys.path hacks in individual test files.
import pytest


@pytest.fixture
def api_client():
    """A FastAPI TestClient against the real app -- used by both the fast
    unit tests (endpoint shape/gating, no LLM calls triggered) and the
    real_api suite (actual /api/analyze calls). Constructing the app does
    not itself make any network calls.
    """
    from fastapi.testclient import TestClient
    from main import app

    return TestClient(app)


@pytest.fixture
def db_conn():
    """Real Postgres connection (agents.db), for tests that need to seed or
    clean up probe rows. Callers are responsible for cleaning up anything
    they insert -- see test_min_context_similarity_calibration.py for the
    insert/verify/cleanup pattern already used elsewhere in this project.
    """
    from agents.db import get_connection

    with get_connection() as conn:
        yield conn
