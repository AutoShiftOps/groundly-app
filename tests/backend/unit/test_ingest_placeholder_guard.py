# docs/TEST_COVERAGE_SPEC.md #5: ingest_content()'s refusal to ingest
# anything whose title/url still contains the "REPLACE-WITH" placeholder
# marker (agents/ingest.py, docs/PHASE_4_SPEC.md A2) is a one-line guard
# that's easy to accidentally delete in an unrelated refactor without
# anyone noticing until pollution reappears in production months later.
# Locking it in here.
#
# The guard raises before any embedding/network call (see
# agents/ingest.py's ingest_content -- the _PLACEHOLDER_MARKER check runs
# before chunk_text/embed_batch), so this is a genuinely fast, offline
# unit test, not a real-API one.
import pytest

from agents.ingest import ingest_content, _PLACEHOLDER_MARKER


def test_placeholder_marker_constant_is_still_replace_with():
    # If someone changes the marker string itself, the rest of this test
    # file's assertions (which hardcode "REPLACE-WITH") would silently stop
    # meaning what they say. Pin the constant's value directly too.
    assert _PLACEHOLDER_MARKER == "REPLACE-WITH"


def test_refuses_when_title_contains_marker():
    with pytest.raises(ValueError, match="REPLACE-WITH"):
        ingest_content(
            text="Some real market data.",
            title="REPLACE-WITH-REAL-SOURCE-TITLE",
            url="https://example.com/real-source",
            framework_tag="tam",
        )


def test_refuses_when_url_contains_marker():
    with pytest.raises(ValueError, match="REPLACE-WITH"):
        ingest_content(
            text="Some real market data.",
            title="A Real Source Title",
            url="https://example.com/REPLACE-WITH-REAL-SOURCE-URL",
            framework_tag="tam",
        )


def test_allows_real_looking_title_and_url_through_the_guard(monkeypatch):
    # Doesn't actually reach the network: stub out embed_batch/insert_source
    # so this only proves the guard itself doesn't false-positive on
    # legitimate data (e.g. the seeded demo corpus's real example.com URLs
    # with real, descriptive titles) -- not a real-API test.
    import agents.ingest as ingest_module

    monkeypatch.setattr(ingest_module, "embed_batch", lambda texts: [[0.0] * 3 for _ in texts])
    monkeypatch.setattr(ingest_module, "insert_source", lambda **kwargs: 1)

    count = ingest_content(
        text="Real market sizing data for the demo corpus.",
        title="TAM: EV Charging Market",
        url="https://example.com/pestel-source",
        framework_tag="tam",
    )
    assert count > 0
