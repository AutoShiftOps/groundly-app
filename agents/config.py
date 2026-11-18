"""
Centralized environment loading for the agents package.
Ensures OPENAI_API_KEY / DATABASE_URL are found regardless of which
directory a script is run from (repo root, backend/, etc.)

Import this FIRST in any agents module that needs env vars:
    from agents import config  # noqa: F401  (side-effect import loads .env)
"""

import os
from pathlib import Path
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = REPO_ROOT / "backend" / ".env"

load_dotenv(dotenv_path=ENV_PATH)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
# Optional: live web-retrieval fallback (agents/web_retrieval.py). Unlike the
# two vars below, a missing key is not fatal -- it just disables that
# fallback and the pipeline behaves as it did before that feature existed.
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# unify/3-gemini: Gemini is the default text-generation provider,
# OpenAI the fallback (agents/llm_provider.py) -- embeddings always
# stay on OpenAI regardless of LLM_PROVIDER (pgvector compatibility:
# every stored vector must come from the same embedding model).
# Model names are env-configurable, never hardcoded in a provider
# module, so a model can be swapped without a code change.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
# Falls back to GEMINI_MODEL when not set separately -- most deployments
# don't need a different model just for claim verification/repair.
GEMINI_VERIFIER_MODEL = os.getenv("GEMINI_VERIFIER_MODEL", GEMINI_MODEL)

if LLM_PROVIDER not in ("gemini", "openai"):
    raise RuntimeError(f"LLM_PROVIDER must be 'gemini' or 'openai', got {LLM_PROVIDER!r}.")

# Deliberately NOT a hard RuntimeError when LLM_PROVIDER=gemini (the
# default) but GEMINI_API_KEY is missing -- agents/llm_provider.py
# treats a missing key the same as any other Gemini-call failure: it
# falls back to OpenAI for that call (see its retry-once-then-OpenAI
# logic) rather than refusing to even start. OPENAI_API_KEY is always
# required above regardless of LLM_PROVIDER specifically so that
# fallback path always has somewhere real to land.

if not OPENAI_API_KEY:
    raise RuntimeError(
        f"OPENAI_API_KEY not found. Expected it in {ENV_PATH}. "
        f"Copy backend/.env.example to backend/.env and fill in your key."
    )

if not DATABASE_URL:
    raise RuntimeError(
        f"DATABASE_URL not found. Expected it in {ENV_PATH}. "
        f"Copy backend/.env.example to backend/.env and fill in your Supabase connection string."
    )
