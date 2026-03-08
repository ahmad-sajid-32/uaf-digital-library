# apps/api/modules/ai/service.py
"""
Service layer for the AI Module of the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Normalize route-facing retrieval and answer input.
- Apply configured defaults and clamps.
- Delegate embedding and pgvector lookup to the retrieval service.
- Build strict grounded-answer payloads with deterministic fallback handling.
"""

from typing import Any, Dict, Optional

from core.config import settings
from core.logging import get_logger
from modules.ai.schemas import AIQueryRequest, RetrievalSearchRequest
from services.chat_generation_service import ChatGenerationService
from services.retrieval_service import RetrievalService

logger = get_logger(__name__)
FALLBACK_ANSWER = "Information not found in official documents."
MAX_CONTEXT_CHARS_PER_CHUNK = 1800


class AIService:
    """
    Thin route-facing orchestration for retrieval-only searches.
    """

    @staticmethod
    async def search_document_corpus(
        user_id: str,
        request_id: Optional[str],
        payload: RetrievalSearchRequest,
    ) -> Dict[str, Any]:
        query = RetrievalService.normalize_query(payload.query)
        top_k = AIService._resolve_top_k(payload.top_k)
        similarity_threshold = AIService._resolve_similarity_threshold(
            payload.similarity_threshold
        )

        items = await RetrievalService.search_university_document_chunks(
            user_id=user_id,
            request_id=request_id,
            query=query,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            document_type=AIService._normalize_optional_text(payload.document_type),
            audience_scope=AIService._normalize_optional_text(payload.audience_scope),
            department=AIService._normalize_optional_text(payload.department),
        )

        return {
            "query": query,
            "applied_top_k": top_k,
            "applied_similarity_threshold": similarity_threshold,
            "items": items,
        }

    @staticmethod
    async def generate_grounded_answer(
        user_id: str,
        request_id: Optional[str],
        payload: AIQueryRequest,
    ) -> Dict[str, Any]:
        query = RetrievalService.normalize_query(payload.query)
        top_k = AIService._resolve_top_k(payload.top_k)
        similarity_threshold = AIService._resolve_similarity_threshold(
            payload.similarity_threshold
        )
        document_type = AIService._normalize_optional_text(payload.document_type)
        audience_scope = AIService._normalize_optional_text(payload.audience_scope)
        department = AIService._normalize_optional_text(payload.department)

        items = await RetrievalService.search_university_document_chunks(
            user_id=user_id,
            request_id=request_id,
            query=query,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            document_type=document_type,
            audience_scope=audience_scope,
            department=department,
        )

        logger.info(
            "AI: retrieval completed for answer flow",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(query),
                "top_k": top_k,
                "similarity_threshold": similarity_threshold,
                "document_type": document_type,
                "audience_scope": audience_scope,
                "department": department,
                "retrieved_chunks_count": len(items),
            },
        )

        if not items:
            logger.info(
                "AI: fallback returned",
                extra={
                    "request_id": request_id,
                    "user_id": user_id,
                    "query_length": len(query),
                    "top_k": top_k,
                    "similarity_threshold": similarity_threshold,
                    "document_type": document_type,
                    "audience_scope": audience_scope,
                    "department": department,
                    "retrieved_chunks_count": 0,
                    "fallback_used": True,
                },
            )
            return {
                "query": query,
                "answer": FALLBACK_ANSWER,
                "fallback_used": True,
                "applied_top_k": top_k,
                "applied_similarity_threshold": similarity_threshold,
                "citations": [],
                "retrieved_chunks_count": 0,
            }

        context_block = AIService._build_context_block(items[:top_k])
        answer = await ChatGenerationService.generate_answer(query, context_block)

        fallback_used = answer.strip() == FALLBACK_ANSWER
        citations = AIService._build_citations(items[:top_k])

        logger.info(
            "AI: generation completed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(query),
                "top_k": top_k,
                "similarity_threshold": similarity_threshold,
                "document_type": document_type,
                "audience_scope": audience_scope,
                "department": department,
                "retrieved_chunks_count": len(items),
                "fallback_used": fallback_used,
            },
        )

        return {
            "query": query,
            "answer": answer.strip(),
            "fallback_used": fallback_used,
            "applied_top_k": top_k,
            "applied_similarity_threshold": similarity_threshold,
            "citations": citations,
            "retrieved_chunks_count": len(items),
        }

    @staticmethod
    def _resolve_top_k(top_k: Optional[int]) -> int:
        if top_k is None:
            return settings.document_retrieval_default_top_k

        if top_k < 1:
            raise RuntimeError("Invalid input")

        return min(top_k, settings.document_retrieval_max_top_k)

    @staticmethod
    def _resolve_similarity_threshold(similarity_threshold: Optional[float]) -> float:
        if similarity_threshold is None:
            return settings.document_retrieval_similarity_threshold

        if similarity_threshold < 0 or similarity_threshold > 1:
            raise RuntimeError("Invalid input")

        return similarity_threshold

    @staticmethod
    def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @staticmethod
    def _build_context_block(items: list[dict[str, Any]]) -> str:
        blocks: list[str] = []

        for index, item in enumerate(items, start=1):
            content = (item.get("content") or "").strip()
            if len(content) > MAX_CONTEXT_CHARS_PER_CHUNK:
                content = content[:MAX_CONTEXT_CHARS_PER_CHUNK].rstrip() + "..."

            section_label = item.get("section_label") or "Unknown Section"
            page_number = item.get("page_number")
            page_label = str(page_number) if page_number is not None else "Unknown"

            blocks.append(
                "\n".join(
                    [
                        f"[Source {index}]",
                        f"Document: {item.get('document_title')}",
                        f"Section: {section_label}",
                        f"Page: {page_label}",
                        f"Chunk Index: {item.get('chunk_index')}",
                        "Content:",
                        content,
                    ]
                )
            )

        return "\n\n".join(blocks)

    @staticmethod
    def _build_citations(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        citations: list[dict[str, Any]] = []
        seen_chunk_ids: set[str] = set()

        for item in items:
            chunk_id = str(item["chunk_id"])
            if chunk_id in seen_chunk_ids:
                continue
            seen_chunk_ids.add(chunk_id)
            citations.append(
                {
                    "document_id": item["document_id"],
                    "document_title": item["document_title"],
                    "original_filename": item["original_filename"],
                    "chunk_id": item["chunk_id"],
                    "chunk_index": item["chunk_index"],
                    "section_label": item.get("section_label"),
                    "page_number": item.get("page_number"),
                    "similarity_score": item["similarity_score"],
                }
            )

        return citations
