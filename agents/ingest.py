"""
Ingestion script: turns raw text/documents into embedded, searchable chunks
in the pgvector `sources` table.

Run from the REPO ROOT (not from inside backend/ or agents/), e.g.:

  python -m agents.ingest --file data/raw/test_market.txt \\
      --title "Test Market Snippet" \\
      --url "https://example.com/source" \\
      --framework tam

Requires backend/.env to contain OPENAI_API_KEY and DATABASE_URL
(copy from backend/.env.example if you haven't already).
"""

import os
import argparse
from datetime import date

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
from openai import OpenAI
from agents.db import insert_source

client = OpenAI(api_key=config.OPENAI_API_KEY)
EMBEDDING_MODEL = "text-embedding-3-small"

CHUNK_SIZE_CHARS = 1200
CHUNK_OVERLAP_CHARS = 150


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE_CHARS, overlap: int = CHUNK_OVERLAP_CHARS):
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - overlap
    return chunks


def embed_batch(texts: list[str]):
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def ingest_text(text: str, source_url: str | None = None, source_title: str | None = None,
                 source_date: date | None = None, framework_tag: str = "general",
                 confidence_score: float = 0.8):
    chunks = chunk_text(text)
    if not chunks:
        print("No content to ingest (empty text after chunking).")
        return []

    embeddings = embed_batch(chunks)
    inserted_ids = []
    for chunk, embedding in zip(chunks, embeddings):
        source_id = insert_source(
            chunk_text=chunk,
            embedding=embedding,
            source_url=source_url,
            source_title=source_title,
            source_date=source_date,
            framework_tag=framework_tag,
            confidence_score=confidence_score,
        )
        inserted_ids.append(source_id)

    print(f"Ingested {len(inserted_ids)} chunk(s) from '{source_title or source_url or 'raw text'}' "
          f"tagged as '{framework_tag}'.")
    return inserted_ids


def ingest_file(file_path: str, source_url: str | None = None, source_title: str | None = None,
                 framework_tag: str = "general", confidence_score: float = 0.8):
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    title = source_title or os.path.basename(file_path)
    return ingest_text(
        text,
        source_url=source_url,
        source_title=title,
        framework_tag=framework_tag,
        confidence_score=confidence_score,
    )


def main():
    parser = argparse.ArgumentParser(description="Ingest documents into the Groundly RAG store.")
    parser.add_argument("--file", type=str, help="Path to a local .txt file to ingest.")
    parser.add_argument("--text", type=str, help="Raw text to ingest directly.")
    parser.add_argument("--title", type=str, default=None, help="Source title.")
    parser.add_argument("--url", type=str, default=None, help="Source URL, if applicable.")
    parser.add_argument("--framework", type=str, default="general",
                         help="Framework tag: tam, swot, pestel, bmc, general, etc.")
    parser.add_argument("--confidence", type=float, default=0.8,
                         help="Confidence score 0-1 for this source (default 0.8).")
    args = parser.parse_args()

    if not args.file and not args.text:
        parser.error("Provide either --file or --text.")

    if args.file:
        ingest_file(args.file, source_url=args.url, source_title=args.title,
                    framework_tag=args.framework, confidence_score=args.confidence)
    else:
        ingest_text(args.text, source_url=args.url, source_title=args.title,
                    framework_tag=args.framework, confidence_score=args.confidence)


if __name__ == "__main__":
    main()
