# apps/api/services/retrieval_service.py
"""
Retrieval mechanics service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Normalize retrieval queries.
- Generate query embeddings through the existing Bytez embedding client.
- Execute pgvector similarity search through the retrieval RPC.
- Return citation-ready chunk rows only.
"""

import re
import time
from typing import Any, Dict, List, Optional

import asyncpg

from core.database import Database
from core.logging import get_logger
from services.embedding_service import EmbeddingService

logger = get_logger(__name__)


class RetrievalService:
    """
    Stateless retrieval helper for official university documents.
    """

    @staticmethod
    def normalize_query(query: str) -> str:
        """
        Normalize user input into a retrieval-safe query string.
        """

        normalized = re.sub(r"\s+", " ", query or "").strip()

        if len(normalized) < 3:
            raise RuntimeError("Invalid input")

        return normalized

    @staticmethod
    async def search_university_document_chunks(
        user_id: str,
        request_id: Optional[str],
        query: str,
        top_k: int,
        similarity_threshold: float,
        document_type: Optional[str],
        audience_scope: Optional[str],
        department: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        Embed the query and execute the document retrieval RPC.
        """

        started_at = time.perf_counter()

        try:
            query_embedding = (
                await EmbeddingService.embed_texts([query], document_id="query")
            )[0]
        except RuntimeError as exc:
            logger.error(
                "AI: embedding generation failed",
                extra={
                    "request_id": request_id,
                    "user_id": user_id,
                    "query_length": len(query),
                    "top_k": top_k,
                    "similarity_threshold": similarity_threshold,
                    "document_type": document_type,
                    "audience_scope": audience_scope,
                    "department": department,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Embedding generation failed") from exc

        logger.info(
            "AI: embedding generation completed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(query),
                "top_k": top_k,
                "similarity_threshold": similarity_threshold,
                "document_type": document_type,
                "audience_scope": audience_scope,
                "department": department,
            },
        )

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )
                rows = await connection.fetch(
                    """
                    select *
                    from library.search_university_document_chunks(
                        $1::extensions.vector,
                        $2::integer,
                        $3::double precision,
                        $4::text,
                        $5::text,
                        $6::text
                    )
                    """,
                    RetrievalService._vector_literal(query_embedding),
                    top_k,
                    similarity_threshold,
                    document_type,
                    audience_scope,
                    department,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: retrieval rpc failed",
                extra={
                    "request_id": request_id,
                    "user_id": user_id,
                    "query_length": len(query),
                    "top_k": top_k,
                    "similarity_threshold": similarity_threshold,
                    "document_type": document_type,
                    "audience_scope": audience_scope,
                    "department": department,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Retrieval RPC failed") from exc

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        results = [dict(row) for row in rows]

        logger.info(
            "AI: retrieval query completed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(query),
                "top_k": top_k,
                "similarity_threshold": similarity_threshold,
                "document_type": document_type,
                "audience_scope": audience_scope,
                "department": department,
                "matches_returned": len(results),
                "latency_ms": latency_ms,
            },
        )

        return results

    @staticmethod
    def _vector_literal(values: List[float]) -> str:
        return "[" + ",".join(f"{value:.10f}" for value in values) + "]"
