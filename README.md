# Groundly (working name) — AI-Grounded Business Decision Platform

Grounded, multi-framework business analysis reports (PESTEL, Porter's Five Forces, SWOT, TAM/SAM/SOM, STP, BCG, Ansoff, Value Chain, BMC, Balanced Scorecard) synthesized into one decision-ready recommendation, backed by RAG-based citations to reduce hallucination.

## Tech Stack
- Frontend: React + Vite + Framer Motion (train progress UI, dashboard)
- Backend: Python + FastAPI on AWS Lambda (via API Gateway)
- Retrieval: PostgreSQL + pgvector (RAG store)
- LLM: OpenAI / AWS Bedrock (pluggable)
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
uvicorn main:app --reload
```

## Deployment
See `docs/deploy-vercel.md` and `docs/deploy-ga4.md`.
