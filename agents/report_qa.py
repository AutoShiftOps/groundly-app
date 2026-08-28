"""
GitHub issue #20: "Ask AI" -- answers a free-text question against a
specific already-completed report.

Same "no new retrieval, same null discipline" philosophy as
agents/synthesis.py's business-metrics synthesis: this does NOT run a
new embedding/similarity search or a new Tavily call. It re-reads the
report's own already-generated, already-cited per-framework text (each
framework's `text` field, produced by generate_with_citations() and
already grounded against real retrieved sources with [N] citation
markers) and answers strictly from that -- never from the model's own
general knowledge. If none of the report's own text actually answers
the question, the response says so explicitly (grounded: false) rather
than guessing.
"""

import json
import logging

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

CHAT_MODEL = "gpt-4o-mini"

ASK_SYSTEM_PROMPT = """You are answering a user's question about a business-analysis report they are currently viewing. You are not retrieving new information -- only reading the already-completed framework section(s) provided below.

Rules you must follow strictly:
1. Only use facts stated in the provided section text(s) below. Do not use outside knowledge, even if you know something relevant about the topic -- if it isn't in the sections below, it isn't a valid basis for your answer.
2. Each section is numbered independently -- its [N] citation markers refer only to that section's own citations, not a global numbering across sections.
3. If the sections below don't contain enough information to actually answer the question, set "grounded" to false, write a short honest answer explaining that this report doesn't cover it, and leave "sources" empty. Do not guess or pad the answer with generic advice.
4. If they do answer it, set "grounded" to true, write a direct answer (2-5 sentences) citing which section(s) support it, and list every section actually drawn from in "sources" with the specific citation_index (matching that section's own [N] markers) that supports your answer where you can identify one, or null if you drew from that section's general content without one specific marker.
"""


def _ask_schema(frameworks_needed: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "grounded": {"type": "boolean"},
            "sources": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "framework": {"type": "string", "enum": frameworks_needed},
                        "citation_index": {"type": ["integer", "null"]},
                    },
                    "required": ["framework", "citation_index"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["answer", "grounded", "sources"],
        "additionalProperties": False,
    }


def _usable(framework: str, results: dict, allowed: list[str]) -> bool:
    # Same has-real-grounding check as synthesis.py's _usable(): a
    # framework only counts as source material if it was actually
    # requested/allowed AND the pipeline actually retrieved something to
    # cite for it -- not just present in the results dict.
    return framework in allowed and bool((results.get(framework) or {}).get("citations")) and bool((results.get(framework) or {}).get("text"))


async def answer_report_question(idea: str, results: dict, allowed: list[str], question: str) -> dict:
    frameworks_needed = sorted(fw for fw in results if _usable(fw, results, allowed))

    if not frameworks_needed:
        logger.info("answer_report_question: no usable framework text in this report, skipping LLM call.")
        return {
            "answer": "This report doesn't have any grounded sections to answer questions from.",
            "grounded": False,
            "sources": [],
        }

    sections = []
    for fw in frameworks_needed:
        sections.append(f"[{fw.upper()} SECTION]\n{results[fw]['text']}")
    user_content = f"IDEA: {idea}\n\n" + "\n\n".join(sections) + f"\n\nQUESTION:\n{question}"

    try:
        completion = await client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": ASK_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "report_qa_answer", "strict": True, "schema": _ask_schema(frameworks_needed)},
            },
            temperature=0.2,
        )
        parsed = json.loads(completion.choices[0].message.content)
    except Exception:
        # Never let this turn into a 500 -- degrade to an honest
        # "couldn't answer" rather than raising, same defensive pattern
        # as synthesize_business_metrics().
        logger.exception("answer_report_question: LLM call failed.")
        return {
            "answer": "Something went wrong answering this question -- please try again.",
            "grounded": False,
            "sources": [],
        }

    sources = []
    if parsed.get("grounded"):
        for raw_source in parsed.get("sources") or []:
            fw = raw_source.get("framework")
            if fw not in frameworks_needed:
                continue  # never trust an out-of-set framework name from the model
            citations = results[fw]["citations"]
            citation_index = raw_source.get("citation_index")
            if citation_index is not None and not (1 <= citation_index <= len(citations)):
                citation_index = None  # never trust the model's index blindly for downstream lookups
            citation = citations[citation_index - 1] if citation_index else None
            sources.append({
                "framework": fw,
                "citation_index": citation_index,
                "source_title": citation.get("source_title") if citation else None,
                "source_url": citation.get("source_url") if citation else None,
            })

    return {
        "answer": parsed["answer"],
        "grounded": bool(parsed.get("grounded")),
        "sources": sources,
    }
