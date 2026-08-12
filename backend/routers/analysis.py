import sys
import os
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

# Allow importing the sibling top-level 'agents' package (repo_root/agents)
# when running backend as its own working directory (e.g. `cd backend && uvicorn main:app`).
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agents.rag_pipeline import run_pipeline  # noqa: E402

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


@router.post("/analyze", response_model=AnalysisResponse)
def analyze(req: AnalysisRequest):
    # Enforce free-tier framework gating server-side (never trust frontend toggles alone)
    if req.tier == "free":
        allowed = [f for f in req.frameworks if f in FREE_FRAMEWORKS]
    else:
        allowed = req.frameworks

    results = {}
    verification = {}

    for framework in allowed:
        query = f"{framework.upper()} analysis for: {req.idea}"
        if req.industry:
            query += f" | industry: {req.industry}"
        if req.geography:
            query += f" | geography: {req.geography}"

        pipeline_output = run_pipeline(query, framework_tag=framework)
        results[framework] = {
            "text": pipeline_output["text"],
            "citations": pipeline_output["citations"],
        }
        verification[framework] = pipeline_output["verification"]

    return AnalysisResponse(
        stage="finalizing",
        frameworks_requested=req.frameworks,
        frameworks_allowed=allowed,
        results=results,
        verification=verification,
    )


@router.get("/frameworks")
def list_frameworks():
    return {
        "free": sorted(FREE_FRAMEWORKS),
        "paid": ["porter_five_forces", "vrio", "sam_som", "competitive_benchmarking",
                 "stp_targeting", "stp_positioning", "bcg", "ansoff",
                 "value_chain", "balanced_scorecard", "decision_recommendation"],
    }