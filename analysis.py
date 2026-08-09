from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class AnalysisRequest(BaseModel):
    idea: str
    industry: str | None = None
    geography: str | None = None
    frameworks: list[str] = ["pestel", "swot", "tam", "bmc"]

@router.post("/analyze")
def analyze(req: AnalysisRequest):
    # TODO: call RAG pipeline in /agents, stream stage updates
    return {
        "stage": "ideating",
        "frameworks_requested": req.frameworks,
        "message": "Analysis pipeline placeholder - wire up agents/rag_pipeline.py"
    }
