from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers import analysis

app = FastAPI(title="Groundly API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}

handler = Mangum(app)  # AWS Lambda entrypoint
