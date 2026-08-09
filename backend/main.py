from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analysis

app = FastAPI(title="Groundly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict to your Vercel domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}

# Run locally: uvicorn main:app --reload
# Render runs this via: uvicorn main:app --host 0.0.0.0 --port $PORT
