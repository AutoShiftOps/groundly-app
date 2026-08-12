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
