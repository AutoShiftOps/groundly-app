import asyncio
import sys
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

# Allow importing the sibling top-level 'agents' package (repo_root/agents)
# when running backend as its own working directory (e.g. `cd backend && uvicorn main:app`).
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agents.rag_pipeline import run_pipeline, STRUCTURED_FRAMEWORKS  # noqa: E402
from agents.synthesis import synthesize_business_metrics  # noqa: E402

router = APIRouter()

# GitHub issue #11: Porter's Five Forces added here as a real, working
# framework. There's no actual paid-tier billing/gating infrastructure in
# this codebase yet (req.tier is just an unchecked string) -- "free" here
# really means "the set of frameworks that actually work", so a built and
# verified framework goes in this set rather than sitting fully working
# but permanently unreachable behind a gate that doesn't exist. Revisit
# once real tier/billing logic exists.
FREE_FRAMEWORKS = {"pestel", "swot", "tam", "bmc", "porter", "stp"}

# Extra structured-output fields (agents/rag_pipeline.py's
# STRUCTURED_FRAMEWORKS, Phase 1 for market_sizing + Phase 3 for the
# rest) that get forwarded into each framework's result -- each only
# present on a pipeline_output for its own framework_tag.
#
# Derived from STRUCTURED_FRAMEWORKS itself (each entry's field_name,
# index 1) rather than hand-duplicated as a separate hardcoded tuple --
# that duplication is exactly what silently dropped porter_forces from
# every response after Porter's Five Forces was added to
# STRUCTURED_FRAMEWORKS but this tuple wasn't updated to match (GitHub
# issue #11's real-call verification caught it: porter_forces came back
# null in the API response even though the model generated it correctly
# -- see tests/backend/unit/test_structured_result_keys.py). Deriving it
# means the next framework added to STRUCTURED_FRAMEWORKS can't
# reintroduce the same class of bug by forgetting a second list.
STRUCTURED_RESULT_KEYS = tuple(field_name for _suffix, field_name, _schema_name, _schema in STRUCTURED_FRAMEWORKS.values())

# tam's query label is "TAM/SAM/SOM", not bare "TAM" -- confirmed live:
# the bare "TAM analysis" wording (sent as both the retrieval embedding
# query AND the LLM's user-turn QUESTION text) anchored the model on TAM
# alone, causing it to skip sam/som in market_sizing even when the
# CONTEXT contained clean, unambiguous, well-attributed dollar figures
# for both (confirmed via a real EV-charging call: one retrieved chunk
# contained both a "$330-$670 million" SAM figure and an "$8-15 million"
# SOM figure in full, yet the raw model response returned
# "sam":null,"som":null). Changing this one word fixed it 3/3 in real
# re-tests, with retrieval quality improving rather than degrading (top
# similarity 0.655 -> 0.6661) since the corpus's own seed content is
# titled "TAM/SAM/SOM Analysis Source". Every other framework's wording
# is unchanged.
QUERY_FRAMEWORK_LABELS = {"tam": "TAM/SAM/SOM"}


def build_analysis_query(idea: str, framework: str, industry: str | None = None, geography: str | None = None) -> str:
    # docs/PHASE_5_SPEC.md C1: previously led with the framework name
    # ("PESTEL analysis for: <idea>"), which biased both local embedding
    # retrieval and the Tavily fallback toward generic framework-
    # methodology content instead of the actual idea topic. Idea leads
    # now; framework is trailing context, not the dominant term.
    label = QUERY_FRAMEWORK_LABELS.get(framework, framework.upper())
    query = f"{idea} — {label} analysis"
    if industry:
        query += f" | industry: {industry}"
    if geography:
        query += f" | geography: {geography}"
    return query


class AnalysisRequest(BaseModel):
    idea: str
    industry: str | None = None
    geography: str | None = None
    frameworks: list[str] = ["pestel", "swot", "tam", "bmc", "porter", "stp"]
    tier: str = "free"  # "free" or "paid"


class AnalysisResponse(BaseModel):
    stage: str
    frameworks_requested: list[str]
    frameworks_allowed: list[str]
    results: dict
    verification: dict
    business_metrics: dict  # Phase 2 of docs/BUSINESS_METRICS_SPEC.md; keys: market_size, competitive_pressure, customer_segment, business_model_fit, risk_flags -- each a dict or None


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(req: AnalysisRequest):
    # Enforce free-tier framework gating server-side (never trust frontend toggles alone)
    if req.tier == "free":
        allowed = [f for f in req.frameworks if f in FREE_FRAMEWORKS]
    else:
        allowed = req.frameworks

    results = {}
    verification = {}

    def build_query(framework: str) -> str:
        return build_analysis_query(req.idea, framework, req.industry, req.geography)

    # Run every requested framework's pipeline concurrently instead of
    # blocking on 4 serial OpenAI calls.
    pipeline_outputs = await asyncio.gather(
        *(run_pipeline(build_query(framework), framework_tag=framework) for framework in allowed)
    )

    for framework, pipeline_output in zip(allowed, pipeline_outputs):
        results[framework] = {
            "text": pipeline_output["text"],
            "citations": pipeline_output["citations"],
        }
        for key in STRUCTURED_RESULT_KEYS:
            if key in pipeline_output:
                results[framework][key] = pipeline_output[key]
        verification[framework] = pipeline_output["verification"]

    # No new retrieval -- reuses the results dict just built above. Never
    # allowed to turn a successful framework run into a 500: any failure
    # here degrades to "not enough data" for every synthesized card
    # (see synthesize_business_metrics()'s own try/except), and if even
    # that call itself somehow raises, business_metrics degrades to all-None
    # here rather than losing the whole response.
    try:
        business_metrics = await synthesize_business_metrics(req.idea, results, allowed)
    except Exception:
        business_metrics = {key: None for key in
                             ("market_size", "competitive_pressure", "customer_segment", "business_model_fit", "risk_flags")}

    return AnalysisResponse(
        stage="finalizing",
        frameworks_requested=req.frameworks,
        frameworks_allowed=allowed,
        results=results,
        verification=verification,
        business_metrics=business_metrics,
    )


@router.get("/frameworks")
def list_frameworks():
    # Not called by the frontend anywhere yet (checked) -- but was stale
    # and actively wrong (listed porter/stp as paid, plus several
    # never-planned names) at the point Porter's Five Forces/STP moved
    # into FREE_FRAMEWORKS. Fixed while touching this file for that same
    # change rather than leaving a second silently-drifting list, same
    # concern as STRUCTURED_RESULT_KEYS above. "paid" reflects the
    # remaining GitHub-tracked M6 frameworks (issues #13-16) not yet
    # built, using the same short-key convention as the ones that are.
    return {
        "free": sorted(FREE_FRAMEWORKS),
        "paid": ["bcg", "ansoff", "value_chain", "balanced_scorecard"],
    }