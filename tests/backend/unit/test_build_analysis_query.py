# Follow-up to the SAM/SOM extraction bug: build_analysis_query()'s
# per-framework label -- confirmed live that the bare "TAM analysis"
# wording (used as both the retrieval embedding query AND the LLM's
# user-turn QUESTION text) anchored the model on TAM alone, causing it to
# skip sam/som in market_sizing even when the CONTEXT contained clean,
# well-attributed dollar figures for both. Changing the query label to
# "TAM/SAM/SOM" fixed it 3/3 in real re-tests (see agents/rag_pipeline.py's
# and this commit's real-call verification). This locks in that specific
# wording so a future refactor can't silently drop it back to bare "TAM".
from routers.analysis import build_analysis_query, QUERY_FRAMEWORK_LABELS, FREE_FRAMEWORKS


def test_tam_query_uses_tam_sam_som_label():
    query = build_analysis_query("an EV charging network startup", "tam")
    assert "TAM/SAM/SOM analysis" in query
    assert query == "an EV charging network startup — TAM/SAM/SOM analysis"


def test_other_frameworks_unaffected():
    for framework in ("pestel", "swot", "bmc"):
        query = build_analysis_query("an EV charging network startup", framework)
        assert f"{framework.upper()} analysis" in query
        assert "TAM/SAM/SOM" not in query


def test_idea_still_leads_the_query():
    # docs/PHASE_5_SPEC.md C1: idea must stay the dominant/leading term,
    # framework trailing context -- this fix only changes the trailing
    # label's wording, not the overall query structure.
    query = build_analysis_query("a subscription box for eco-friendly packaging", "tam")
    assert query.startswith("a subscription box for eco-friendly packaging")


def test_industry_and_geography_still_appended():
    query = build_analysis_query("an EV charging network startup", "tam", industry="mobility", geography="US")
    assert "industry: mobility" in query
    assert "geography: US" in query


def test_query_framework_labels_only_overrides_tam():
    # Every OTHER real framework must fall through to framework.upper()
    # unchanged -- this mapping is deliberately narrow, not a general
    # relabeling table.
    for framework in FREE_FRAMEWORKS - {"tam"}:
        assert framework not in QUERY_FRAMEWORK_LABELS
    assert QUERY_FRAMEWORK_LABELS.get("tam") == "TAM/SAM/SOM"
