import asyncio
import sys
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Allow importing the sibling top-level 'agents' package (repo_root/agents)
# when running backend as its own working directory (e.g. `cd backend && uvicorn main:app`).
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agents.rag_pipeline import run_pipeline, STRUCTURED_FRAMEWORKS  # noqa: E402
from agents.synthesis import synthesize_business_metrics  # noqa: E402
from agents.report_qa import answer_report_question  # noqa: E402
from agents import mississauga_data  # noqa: E402

router = APIRouter()

# GitHub issue #11: Porter's Five Forces added here as a real, working
# framework. There's no actual paid-tier billing/gating infrastructure in
# this codebase yet (req.tier is just an unchecked string) -- "free" here
# really means "the set of frameworks that actually work", so a built and
# verified framework goes in this set rather than sitting fully working
# but permanently unreachable behind a gate that doesn't exist. Revisit
# once real tier/billing logic exists.
#
# GitHub issue #16 (Ansoff Matrix) was the last of the original 6
# "paid tier" M6 frameworks (docs/milestones.md) -- all 6 are now real
# and in this set. Once actual tier/billing logic exists, this set
# stops being "everything that works" and needs to actually split by
# what a free vs paid *account* can request, not by what's been built.
FREE_FRAMEWORKS = {"pestel", "swot", "tam", "bmc", "porter", "stp", "bcg", "value_chain", "balanced_scorecard", "ansoff"}

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
    # GitHub "unify backend" follow-up: these 4 camelCase fields match
    # exactly what frontend/src/App.tsx already sends on every /api/analyze
    # call (mode/businessName/dataSourceUrl were previously silently
    # dropped by pydantic's default extra="ignore" behavior -- declaring
    # them here is what actually wires them up).
    mode: str = "idea"  # "idea" or "business"
    businessName: str | None = None
    industry: str | None = None
    geography: str | None = None
    # Only an https:// URL on a real City of Mississauga/Esri ArcGIS
    # open-data host is accepted -- validated in analyze() below via
    # agents.mississauga_data.validate_data_source_url(), which raises
    # 400 for anything else before any network call is made.
    dataSourceUrl: str | None = None
    frameworks: list[str] = ["pestel", "swot", "tam", "bmc", "porter", "stp", "bcg", "value_chain", "balanced_scorecard", "ansoff"]
    tier: str = "free"  # "free" or "paid"


class AnalysisResponse(BaseModel):
    stage: str
    frameworks_requested: list[str]
    frameworks_allowed: list[str]
    results: dict
    verification: dict
    business_metrics: dict  # Phase 2 of docs/BUSINESS_METRICS_SPEC.md; keys: market_size, competitive_pressure, customer_segment, business_model_fit, risk_flags -- each a dict or None
    # Real City of Mississauga open-data business-directory lookup
    # (agents/mississauga_data.py) -- None whenever the geography doesn't
    # qualify (Mississauga/GTA/Ontario) and the feature never ran at all;
    # the frontend renders its directory badge only when directory_status
    # is non-None.
    directory_status: str | None = None  # "found" | "sector_context" | "not_found" | None
    directory_matches: int | None = None
    directory_exact_match: bool | None = None
    directory_total_sector: int | None = None
    # Whole-report retrieval-health summary: "grounded" if at least one
    # framework ended up with a real citation (vector-matched or
    # directory), "unavailable" if none did. Never fabricated -- computed
    # from the same citations the frontend itself sees, not a separate
    # guess.
    rag_status: str | None = None
    # The geography actually used for retrieval/directory lookup --
    # always present (never None), since analyze() always resolves one
    # even when the request sent none. geography_defaulted is true when
    # the request itself had no geography and this server-side default
    # was applied, so the frontend can show *why* directory data appears
    # even though the user never typed a geography.
    geography: str = "Mississauga, ON, Canada"
    geography_defaulted: bool = False


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(req: AnalysisRequest):
    # Enforce free-tier framework gating server-side (never trust frontend toggles alone)
    if req.tier == "free":
        allowed = [f for f in req.frameworks if f in FREE_FRAMEWORKS]
    else:
        allowed = req.frameworks

    if req.dataSourceUrl:
        try:
            mississauga_data.validate_data_source_url(req.dataSourceUrl)
        except mississauga_data.DataSourceUrlError as exc:
            # {"error": ...}, not FastAPI's default {"detail": ...} --
            # frontend/src/App.tsx reads `data.error` on a non-ok response
            # (the same shape the AI Studio source's server.ts used for
            # its own 400s), so this must match that shape to actually
            # surface the real message instead of falling back to a
            # generic one.
            return JSONResponse(status_code=400, content={"error": str(exc)})

    # server.ts's own default when the frontend sends no geography at all.
    geography_defaulted = not (req.geography and req.geography.strip())
    resolved_geography = req.geography.strip() if not geography_defaulted else "Mississauga, ON, Canada"

    # Step 1 (matches the AI Studio source this was ported from): check
    # the real Mississauga Business Directory BEFORE any web-retrieval
    # fallback, and only for a Mississauga/GTA/Ontario geography -- a
    # Mississauga-specific open-data lookup is meaningless context for
    # a business based somewhere else.
    directory_result = None
    if mississauga_data.is_mississauga_scope(resolved_geography):
        directory_result = await mississauga_data.query_directory(
            mode=req.mode,
            business_name=req.businessName,
            idea=req.idea,
            industry=req.industry,
            geography=resolved_geography,
            data_source_url=req.dataSourceUrl,
        )

    results = {}
    verification = {}

    def build_query(framework: str) -> str:
        return build_analysis_query(req.idea, framework, req.industry, resolved_geography)

    # Run every requested framework's pipeline concurrently instead of
    # blocking on 4 serial OpenAI calls. Every framework gets the same
    # directory_result -- it was fetched once above, not once per
    # framework.
    pipeline_outputs = await asyncio.gather(
        *(run_pipeline(
            build_query(framework), framework_tag=framework, directory_context=directory_result,
            idea=req.idea, industry=req.industry, business_name=req.businessName, geography=resolved_geography,
        ) for framework in allowed)
    )

    for framework, pipeline_output in zip(allowed, pipeline_outputs):
        results[framework] = {
            "text": pipeline_output["text"],
            "citations": pipeline_output["citations"],
            "assumptions": pipeline_output.get("assumptions", []),
            "actions": pipeline_output.get("actions", []),
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

    has_any_real_citation = any(results[fw]["citations"] for fw in allowed)
    rag_status = "grounded" if has_any_real_citation else "unavailable"

    return AnalysisResponse(
        stage="finalizing",
        frameworks_requested=req.frameworks,
        frameworks_allowed=allowed,
        results=results,
        verification=verification,
        business_metrics=business_metrics,
        directory_status=directory_result["status"] if directory_result else None,
        directory_matches=directory_result["matched_count"] if directory_result else None,
        directory_exact_match=directory_result["exact_match"] if directory_result else None,
        directory_total_sector=directory_result["total_sector_count"] if directory_result else None,
        rag_status=rag_status,
        geography=resolved_geography,
        geography_defaulted=geography_defaulted,
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
        "paid": [],
    }


# GitHub issue #20 ("Ask AI"). Deliberately takes the report's own
# already-generated results dict (the same shape AnalysisResponse.results
# returned from /analyze) rather than a report ID -- there's no report
# persistence in this codebase yet (see GitHub issue #21, still open),
# so the frontend is the only thing holding a completed report right
# now. This endpoint does no new retrieval of its own; it only re-reads
# the text the /analyze call already produced (see agents/report_qa.py).
class AskRequest(BaseModel):
    idea: str
    question: str
    results: dict  # same shape as AnalysisResponse.results
    frameworks_allowed: list[str]  # AnalysisResponse.frameworks_allowed from the same report


class AskResponse(BaseModel):
    answer: str
    grounded: bool
    sources: list[dict]  # [{framework, citation_index, source_title, source_url}, ...]


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    result = await answer_report_question(req.idea, req.results, req.frameworks_allowed, req.question)
    return AskResponse(**result)