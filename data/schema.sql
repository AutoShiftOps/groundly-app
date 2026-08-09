-- Run this once against your Render Postgres (or local Postgres) database.
-- psql "$DATABASE_URL" -f data/schema.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_text TEXT NOT NULL,
    source_url TEXT,
    source_title TEXT,
    source_date DATE,
    framework_tag TEXT,           -- e.g. 'tam', 'swot', 'pestel', 'general'
    confidence_score REAL DEFAULT 0.8,
    retrieved_at TIMESTAMPTZ DEFAULT now(),
    embedding VECTOR(1536)        -- matches OpenAI text-embedding-3-small dimension
);

-- Cosine-distance index for fast similarity search at scale
CREATE INDEX IF NOT EXISTS sources_embedding_idx
    ON sources USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS sources_framework_tag_idx
    ON sources (framework_tag);
