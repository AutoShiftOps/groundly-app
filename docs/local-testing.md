# Local Testing Guide — Ingest → Retrieve → Generate → API

This walks through testing the full RAG chain locally before deploying to Render.

## 1. Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → New Project.
2. Wait for provisioning (~2 minutes).
3. Go to **Database → Extensions** → search "vector" → enable it.
4. Go to **SQL Editor** → paste the full contents of `data/schema.sql` → Run.
5. Go to **Project Settings → Database → Connection string** → copy the URI
   (use the "Session pooler" or direct connection string, `postgresql://...`).

## 2. Configure Local Environment

In `backend/.env` (create this file, copy from `backend/.env.example`):

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres
ALLOWED_ORIGIN=http://localhost:5173
```

## 3. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
```

## 4. Ingest a Test Document

Create a sample file `data/raw/test_market.txt` with a real paragraph of market data
(e.g. copy a snippet from a Statista or industry report on your idea's market).

```bash
cd ..   # back to repo root, so 'agents' package resolves correctly
python -m agents.ingest --file backend/../data/raw/test_market.txt \\
    --title "REPLACE-WITH-REAL-SOURCE-TITLE" \\
    --url "REPLACE-WITH-REAL-SOURCE-URL" \\
    --framework tam
```

Replace `--title`/`--url` with the actual source's title/URL before running --
the CLI now refuses to ingest anything that still says "REPLACE-WITH" (see
docs/PHASE_4_SPEC.md A2: an earlier version of this exact snippet used a
literal `"Test Market Snippet"` placeholder that someone ran unedited,
permanently polluting the production tam corpus).

Expected output: `Ingested N chunk(s) from '<your title>' tagged as 'tam'.`

## 5. Test Retrieval + Generation Directly (Python shell)

```bash
python
>>> import asyncio
>>> from agents.rag_pipeline import run_pipeline
>>> result = asyncio.run(run_pipeline("What is the TAM for eco-friendly packaging?", framework_tag="tam"))
>>> print(result["text"])
>>> print(result["citations"])
>>> print(result["verification"])
```

If you see real generated text with `[1]` style citation markers referencing your
ingested chunk (not "Insufficient grounded data available"), the pipeline works end-to-end.

## 6. Test the Full API Locally

```bash
cd backend
uvicorn main:app --reload
```

In another terminal:

```bash
curl -X POST http://localhost:8000/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{"idea": "Eco-friendly packaging subscription for small e-commerce brands", "frameworks": ["tam"], "tier": "free"}'
```

Expected: JSON response with `results.tam.text` containing grounded, cited content.

## 7. Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Insufficient grounded data" always returned | No matching chunks ingested, or `framework_tag` mismatch | Re-check ingest `--framework` matches the query's `framework_tag` |
| `ModuleNotFoundError: agents` | Running uvicorn from wrong directory | Run ingest/test scripts from repo root, not from inside `backend/` |
| `psycopg2.OperationalError` | Wrong `DATABASE_URL` or Supabase project paused | Check connection string; visit Supabase dashboard to un-pause project |
| Embedding dimension mismatch error | Schema `VECTOR(1536)` doesn't match embedding model output | Confirm using `text-embedding-3-small` (1536-dim), not a different model |

## 8. Once Working Locally → Deploy

1. Push code to GitHub.
2. Render dashboard → your `groundly-api` service → Environment → add `DATABASE_URL` (Supabase string) and `OPENAI_API_KEY`.
3. Redeploy → test the same `curl` command against your live Render URL.
