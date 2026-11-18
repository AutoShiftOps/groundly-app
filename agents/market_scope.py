"""
Shared term-overlap heuristic for "does this market-size description
actually match that market category/chunk, or is it too generic/too
broad a sector name to mean anything specific". Factored out of
agents/rag_pipeline.py so agents/claim_verifier.py can reuse the exact
same definitions (not a second, drifting copy) for its own cheap
first-pass TAM-tier scope check.
"""

import re

# Generic words that can never, by themselves, count as evidence that a
# tier_description matches (or is specific enough to represent) the
# idea's own market category -- either too generic to mean anything
# ("market", "size", a bare year) or an entire industry/sector name too
# broad to be THIS idea's actual addressable market ("software", "food
# services"). Shared by rag_pipeline's category-fit check (does
# tier_description match the idea's category?) and claim_verifier's
# scope-mismatch check (does the cited chunk actually support what
# tier_description claims?).
MARKET_SCOPE_STOPWORDS = {
    "the", "a", "an", "of", "in", "for", "and", "or", "to", "by", "is", "are", "was", "were",
    "from", "through", "with", "on", "at", "as", "this", "that", "its", "their",
    "market", "size", "global", "national", "industry", "sector", "report", "forecast",
    "analysis", "growth", "value", "valued", "billion", "million", "trillion", "usd",
    "revenue", "overview", "outlook", "study", "insights", "trends", "projected", "projection",
}
SECTOR_LEVEL_WORDS = {
    "software", "food", "foods", "foodservice", "catering", "restaurant", "restaurants",
    "retail", "healthcare", "health", "construction", "logistics", "freight", "transportation",
    "consulting", "technology", "tech", "hospitality", "ecommerce", "manufacturing", "finance",
    "financial", "education", "services", "apps", "app", "fintech", "saas",
}
_YEAR_PATTERN = re.compile(r"\b(?:19|20)\d{2}\b")


def significant_terms(text: str | None) -> set[str]:
    """Lowercased words (len >= 4) from `text`, with years, generic
    filler words, and bare sector/industry names all excluded -- what's
    left is whatever actually makes this description specific to one
    idea's market, if anything."""
    if not text:
        return set()
    cleaned = _YEAR_PATTERN.sub(" ", text.lower())
    words = re.findall(r"[a-z]{4,}", cleaned)
    return {w for w in words if w not in MARKET_SCOPE_STOPWORDS and w not in SECTOR_LEVEL_WORDS}
