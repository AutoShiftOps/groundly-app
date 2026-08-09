# Deploy Backend to Render

## One-time setup
1. Push repo to GitHub (must include `render.yaml` at repo root).
2. Go to render.com -> New -> Blueprint -> connect your GitHub repo.
3. Render auto-detects `render.yaml` and provisions:
   - Web Service `groundly-api` (FastAPI, Python)
   - PostgreSQL database `groundly-db`
4. Review the plan (Starter tier recommended, ~$7/mo, no cold starts) and click Apply.

## Environment Variables (Render dashboard -> Service -> Environment)
- `OPENAI_API_KEY` = your LLM API key
- `DATABASE_URL` = auto-populated from linked Render Postgres, or your own connection string
- `ALLOWED_ORIGIN` = your Vercel frontend URL (update CORS in main.py to use this instead of "*")

## Manual deploy (without Blueprint)
1. New -> Web Service -> connect repo.
2. Root directory: leave blank (repo root), since build/start commands reference `backend/`.
3. Build command: `pip install -r backend/requirements.txt`
4. Start command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Instance type: Free (cold starts after 15 min idle) or Starter $7/mo (always-on, recommended for demos).

## Database Setup (pgvector)
1. Render Postgres -> Connect -> open psql shell (or use a client).
2. Run: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Update `DATABASE_URL` in your backend `.env` / Render env vars.

## Auto-Deploy
- Every push to `main` triggers an automatic redeploy.
- Render provides a live URL like `https://groundly-api.onrender.com` — use this as `VITE_API_BASE_URL` in Vercel.

## Verify
- Visit `https://groundly-api.onrender.com/health` -> should return `{"status": "ok"}`.
