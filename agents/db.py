"""
Shared Postgres + pgvector connection helper for the agents package.
"""

from agents import config  # noqa: F401  side-effect: loads backend/.env reliably
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

DATABASE_URL = config.DATABASE_URL


@contextmanager
def get_connection():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()


def insert_source(chunk_text, embedding, source_url=None, source_title=None,
                   source_date=None, framework_tag="general", confidence_score=0.8):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sources
                    (chunk_text, embedding, source_url, source_title,
                     source_date, framework_tag, confidence_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (chunk_text, embedding, source_url, source_title,
                 source_date, framework_tag, confidence_score),
            )
            conn.commit()
            return cur.fetchone()["id"]


def search_similar(embedding, top_k=8, framework_tag=None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            if framework_tag:
                cur.execute(
                    """
                    SELECT id, chunk_text, source_url, source_title, source_date,
                           framework_tag, confidence_score,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM sources
                    WHERE framework_tag = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (embedding, framework_tag, embedding, top_k),
                )
            else:
                cur.execute(
                    """
                    SELECT id, chunk_text, source_url, source_title, source_date,
                           framework_tag, confidence_score,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM sources
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (embedding, embedding, top_k),
                )
            return cur.fetchall()
