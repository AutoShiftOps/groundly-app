"""
RAG grounding pipeline: retrieve -> generate with citations -> verify claims -> confidence score.
"""

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from openai import OpenAI
from agents.db import search_similar

client = OpenAI(api_key=config.OPENAI_API_KEY)

EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o-mini"

GROUNDING_SYSTEM_PROMPT = """You are a grounded business-analysis assistant.
Rules you must follow strictly:
1. Only use facts present in the provided CONTEXT below. Never use outside knowledge for market data, statistics, or claims.
2. Every factual sentence must end with a citation marker like [1], [2] referring to the numbered context chunk it came from.
3. If the CONTEXT does not contain enough information to answer, explicitly say "Insufficient grounded data available for this section" instead of guessing.
4. Do not fabricate numbers, company names, or sources under any circumstance.
"""


def embed_query(query: str):
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=query)
    return response.data[0].embedding


def retrieve(query: str, top_k: int = 8, framework_tag: str | None = None):
    embedding = embed_query(query)
    rows = search_similar(embedding, top_k=top_k, framework_tag=framework_tag)
    return rows


def generate_with_citations(query: str, context_chunks: list):
    if not context_chunks:
        return {
            "text": "Insufficient grounded data available for this section.",
            "citations": [],
        }

    context_block = "\n\n".join(
        f"[{i+1}] {c['chunk_text']} (source: {c.get('source_title') or c.get('source_url', 'unknown')})"
        for i, c in enumerate(context_chunks)
    )

    completion = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": GROUNDING_SYSTEM_PROMPT},
            {"role": "user", "content": f"CONTEXT:\n{context_block}\n\nQUESTION:\n{query}"},
        ],
        temperature=0.2,
    )

    text = completion.choices[0].message.content
    citations = [
        {
            "index": i + 1,
            "source_url": c.get("source_url"),
            "source_title": c.get("source_title"),
            "confidence_score": c.get("confidence_score"),
            "similarity": c.get("similarity"),
        }
        for i, c in enumerate(context_chunks)
    ]
    return {"text": text, "citations": citations}


def verify_claims(generated_text: str, citations: list):
    has_markers = any(f"[{c['index']}]" in generated_text for c in citations)
    if not citations:
        unsupported = ["No grounded sources retrieved for this section"]
    elif not has_markers:
        unsupported = ["No inline citation markers found in output"]
    else:
        unsupported = []
    return {
        "verified": len(unsupported) == 0,
        "unsupported_claims": unsupported,
    }


def run_pipeline(query: str, framework_tag: str | None = None):
    chunks = retrieve(query, framework_tag=framework_tag)
    result = generate_with_citations(query, chunks)
    verification = verify_claims(result["text"], result["citations"])
    return {**result, "verification": verification}
