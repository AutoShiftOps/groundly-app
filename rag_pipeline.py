"""
RAG grounding pipeline skeleton.
Steps: retrieve -> generate with citations -> verify claims -> confidence score.
"""

def retrieve(query: str, top_k: int = 8):
    # TODO: query pgvector store
    return []

def generate_with_citations(query: str, context_chunks: list):
    # TODO: call LLM with strict grounding system prompt
    # System prompt should force: only use retrieved context, cite every claim,
    # say "insufficient data" when context is empty.
    return {"text": "", "citations": []}

def verify_claims(generated_text: str, citations: list):
    # TODO: entailment check - does each sentence match its cited source
    return {"verified": True, "unsupported_claims": []}

def run_pipeline(query: str):
    chunks = retrieve(query)
    result = generate_with_citations(query, chunks)
    verification = verify_claims(result["text"], result["citations"])
    return {**result, "verification": verification}
