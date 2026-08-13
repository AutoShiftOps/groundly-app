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

from agents.rag_pipeline import run_pipeline  # noqa: E402
from agents.synthesis import synthesize_business_metrics  # noqa: E402

router = APIRouter()

FREE_FRAMEWORKS = {"pestel", "swot", "tam", "bmc"}


class AnalysisRequest(BaseModel):
    idea: str
    industry: str | None = None
    geography: str | None = None
    frameworks: list[str] = ["pestel", "swot", "tam", "bmc"]
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
        query = f"{framework.upper()} analysis for: {req.idea}"
        if req.industry:
            query += f" | industry: {req.industry}"
        if req.geography:
            query += f" | geography: {req.geography}"
        return query

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
        # Only present for tam (agents/rag_pipeline.py's structured-output
        # path, docs/BUSINESS_METRICS_SPEC.md Phase 1); absent for every
        # other framework, same as pipeline_output itself only has the key
        # when framework_tag == "tam".
        if "market_sizing" in pipeline_output:
            results[framework]["market_sizing"] = pipeline_output["market_sizing"]
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
    return {
        "free": sorted(FREE_FRAMEWORKS),
        "paid": ["porter_five_forces", "vrio", "sam_som", "competitive_benchmarking",
                 "stp_targeting", "stp_positioning", "bcg", "ansoff",
                 "value_chain", "balanced_scorecard", "decision_recommendation"],
    }