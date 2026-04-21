# apps/api/services/retrieval_service.py
"""
Retrieval mechanics service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Normalize retrieval and assistant queries.
- Execute PostgreSQL text search through a retrieval RPC.
- Apply lightweight app-side reranking for better chunk relevance.
- Return citation-ready chunk rows only.
"""

import re
import time
from typing import Any, Dict, List, Optional

import asyncpg

from core.config import settings
from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "you",
    "your",
}

GENERIC_SECTION_PENALTIES = {
    "contact",
    "introduction",
    "overview",
    "references",
    "about",
}

TARGET_TERM_HINTS = {
    "approve": {"approve", "approval", "authority", "registrar"},
    "approval": {"approve", "approval", "authority", "registrar"},
    "deadline": {"deadline", "before", "midterm", "period"},
    "required": {"required", "documents", "form", "evidence", "id"},
    "documents": {"required", "documents", "form", "evidence", "id"},
    "refund": {"refund", "tuition", "automatically"},
    "tuition": {"refund", "tuition", "automatically"},
    "freeze": {"freeze", "semester", "inactive"},
    "semester": {"freeze", "semester"},
}


class RetrievalService:
    """
    Stateless retrieval helper for official university documents.
    """

    @staticmethod
    def normalize_query(query: str) -> str:
        normalized = re.sub(r"\s+", " ", query or "").strip()

        if len(normalized) < 3:
            raise RuntimeError("Invalid input")

        return normalized

    @staticmethod
    def normalize_assistant_query(query: str) -> str:
        normalized = re.sub(r"\s+", " ", query or "").strip()

        if not normalized:
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
        started_at = time.perf_counter()
        requested_top_k = top_k
        fetch_top_k = min(
            max(top_k * 2, top_k),
            settings.document_retrieval_max_top_k,
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
                    from library.search_university_document_chunks_text(
                        $1::text,
                        $2::integer,
                        $3::double precision,
                        $4::text,
                        $5::text,
                        $6::text
                    )
                    """,
                    query,
                    fetch_top_k,
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
                    "requested_top_k": requested_top_k,
                    "fetch_top_k": fetch_top_k,
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
        reranked_results = RetrievalService._rerank_results(query, results)[:requested_top_k]

        logger.info(
            "AI: retrieval query completed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(query),
                "requested_top_k": requested_top_k,
                "fetch_top_k": fetch_top_k,
                "similarity_threshold": similarity_threshold,
                "document_type": document_type,
                "audience_scope": audience_scope,
                "department": department,
                "matches_returned_before_rerank": len(results),
                "matches_returned_after_rerank": len(reranked_results),
                "latency_ms": latency_ms,
            },
        )

        return reranked_results

    @staticmethod
    def _rerank_results(
        query: str,
        items: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        if not items:
            return items

        scored_items: list[tuple[float, Dict[str, Any]]] = []

        for item in items:
            final_score = RetrievalService._score_result(query, item)
            scored_items.append((final_score, item))

        scored_items.sort(
            key=lambda pair: (
                pair[0],
                float(pair[1].get("similarity_score", 0.0)),
            ),
            reverse=True,
        )

        return [item for _, item in scored_items]

    @staticmethod
    def _score_result(
        query: str,
        item: Dict[str, Any],
    ) -> float:
        base_similarity = float(item.get("similarity_score", 0.0))
        query_tokens = RetrievalService._significant_tokens(query)

        section_text = str(item.get("section_label") or "").lower()
        title_text = str(item.get("document_title") or "").lower()
        content_text = str(item.get("content") or "").lower()

        section_tokens = RetrievalService._significant_tokens(section_text)
        title_tokens = RetrievalService._significant_tokens(title_text)
        content_tokens = RetrievalService._significant_tokens(content_text)

        section_overlap = len(query_tokens & section_tokens)
        title_overlap = len(query_tokens & title_tokens)
        content_overlap = len(query_tokens & content_tokens)

        score = base_similarity
        score += min(section_overlap * 0.12, 0.60)
        score += min(title_overlap * 0.08, 0.24)
        score += min(content_overlap * 0.03, 0.45)

        lowered_query = query.lower()

        for query_term, target_terms in TARGET_TERM_HINTS.items():
            if query_term in lowered_query:
                if any(target in section_text for target in target_terms):
                    score += 0.22
                elif any(target in content_text for target in target_terms):
                    score += 0.12

        if "contact" in section_text and "contact" not in lowered_query:
            score -= 0.28

        if any(generic in section_text for generic in GENERIC_SECTION_PENALTIES):
            score -= 0.08

        if not section_text.strip():
            score -= 0.03

        return score

    @staticmethod
    def _significant_tokens(text: str) -> set[str]:
        raw_tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
        return {
            token
            for token in raw_tokens
            if len(token) > 2 and token not in STOP_WORDS
        }
