# Groundly (working name) — AI-Grounded Business Decision Platform

Grounded, multi-framework business analysis reports (PESTEL, Porter's Five Forces, SWOT, TAM/SAM/SOM, STP, BCG, Ansoff, Value Chain, BMC, Balanced Scorecard) synthesized into one decision-ready recommendation, backed by RAG-based citations to reduce hallucination.

## Tech Stack
- Frontend: React + Vite + Framer Motion (train progress UI, dashboard)
- Backend: Python + FastAPI on AWS Lambda (via API Gateway)
- Retrieval: PostgreSQL + pgvector (RAG store)
- LLM: Gemini (default) with an automatic OpenAI fallback (`agents/llm_provider.py`, `LLM_PROVIDER` env var) -- embeddings always stay on OpenAI for pgvector compatibility
- Deploy: Vercel (frontend), AWS SAM/CDK (backend)
- Analytics: Google Analytics 4

## Repo Structure
```
/frontend        React app (dashboard, train UI, report viewer)
/backend         FastAPI app + Lambda handlers
/agents          RAG pipeline + framework generation agents
/infra           AWS CDK/Terraform IaC
/docs            PRD, specs, positioning docs
/data            source ingestion configs, citation schema
```

## Local Setup
```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in OPENAI_API_KEY, DATABASE_URL, and (optional) GEMINI_API_KEY/TAVILY_API_KEY
uvicorn main:app --reload
```

`LLM_PROVIDER` (in `backend/.env`) picks the default text-generation provider: `gemini` (default) or `openai`. A missing `GEMINI_API_KEY` degrades every call to the OpenAI fallback rather than failing -- see `backend/.env.example` for the full list of variables.

## Deployment
See `docs/deploy-vercel.md` and `docs/deploy-ga4.md`.
