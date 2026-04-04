# apps/api/modules/ai/service.py
"""
Service layer for the AI Module of the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Normalize route-facing retrieval and answer input.
- Apply configured defaults and clamps for the legacy AI endpoints.
- Resolve backend-owned assistant intent profiles for the admin assistant flow.
- Build strict grounded-answer payloads with deterministic fallback handling.
- Keep retrieval tuning and assistant context assembly out of route handlers.
"""

from dataclasses import dataclass
from typing import Any, Dict, Optional

from core.config import settings
from core.logging import get_logger
from modules.ai.schemas import AIQueryRequest, RetrievalSearchRequest
from services.chat_generation_service import ChatGenerationService
from services.retrieval_service import RetrievalService

logger = get_logger(__name__)
FALLBACK_ANSWER = "Information not found in official documents."
MAX_CONTEXT_CHARS_PER_CHUNK = 1800
MAX_HISTORY_MESSAGES = 8
MAX_HISTORY_CHARS_PER_MESSAGE = 500


@dataclass(frozen=True)
class AssistantIntentProfile:
    """
    Backend-owned retrieval profile for assistant turns.
    """

    name: str
    top_k: int
    similarity_threshold: float
    document_type: Optional[str] = None
    audience_scope: Optional[str] = None
    department: Optional[str] = None


class AIService:
    """
    Route-facing orchestration for legacy AI routes and assistant turns.
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

        answer = await ChatGenerationService.generate_answer(
            query,
            AIService._build_context_block(items[:top_k]),
        )

        fallback_used = answer.strip() == FALLBACK_ANSWER
        citations = [] if fallback_used else AIService._build_citations(items[:top_k])

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
    async def generate_assistant_turn(
        *,
        user_id: str,
        request_id: Optional[str],
        query: str,
        conversation_messages: Optional[list[dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        normalized_query = RetrievalService.normalize_query(query)
        profile = AIService.resolve_assistant_intent_profile(
            normalized_query,
            conversation_messages=conversation_messages or [],
        )

        items = await RetrievalService.search_university_document_chunks(
            user_id=user_id,
            request_id=request_id,
            query=normalized_query,
            top_k=profile.top_k,
            similarity_threshold=profile.similarity_threshold,
            document_type=profile.document_type,
            audience_scope=profile.audience_scope,
            department=profile.department,
        )

        logger.info(
            "AI: assistant retrieval completed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(normalized_query),
                "intent_profile": profile.name,
                "top_k": profile.top_k,
                "similarity_threshold": profile.similarity_threshold,
                "document_type": profile.document_type,
                "audience_scope": profile.audience_scope,
                "department": profile.department,
                "retrieved_chunks_count": len(items),
            },
        )

        if not items:
            return {
                "query": normalized_query,
                "answer": FALLBACK_ANSWER,
                "fallback_used": True,
                "retrieved_chunks_count": 0,
                "citations": [],
                "intent_profile": profile.name,
                "applied_top_k": profile.top_k,
                "applied_similarity_threshold": profile.similarity_threshold,
            }

        history_block = AIService._build_conversation_history_block(
            conversation_messages or []
        )
        answer = await ChatGenerationService.generate_answer(
            normalized_query,
            AIService._build_context_block(items[: profile.top_k]),
            history_block,
        )

        fallback_used = answer.strip() == FALLBACK_ANSWER
        citations = [] if fallback_used else AIService._build_citations(items[: profile.top_k])

        logger.info(
            "AI: assistant generation completed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(normalized_query),
                "intent_profile": profile.name,
                "retrieved_chunks_count": len(items),
                "fallback_used": fallback_used,
            },
        )

        return {
            "query": normalized_query,
            "answer": answer.strip(),
            "fallback_used": fallback_used,
            "retrieved_chunks_count": len(items),
            "citations": citations,
            "intent_profile": profile.name,
            "applied_top_k": profile.top_k,
            "applied_similarity_threshold": profile.similarity_threshold,
        }

    @staticmethod
    def resolve_assistant_intent_profile(
        query: str,
        *,
        conversation_messages: list[dict[str, Any]],
    ) -> AssistantIntentProfile:
        """
        Resolve one deterministic backend-owned retrieval profile.
        """

        combined_query = AIService._build_intent_resolution_text(
            query,
            conversation_messages,
        )
        lowered = combined_query.lower()
        default_threshold = settings.document_retrieval_similarity_threshold

        department_map = {
            "registrar": "Registrar Office",
            "registrar office": "Registrar Office",
            "admission office": "Admission Office",
            "admissions office": "Admission Office",
            "controller of examinations": "Controller of Examinations",
            "controller": "Controller of Examinations",
            "financial aid": "Financial Aid Office",
            "fee section": "Fee Section",
        }

        for needle, department in department_map.items():
            if needle in lowered:
                return AssistantIntentProfile(
                    name="department_specific_notice",
                    top_k=min(settings.document_retrieval_default_top_k + 1, 8),
                    similarity_threshold=default_threshold,
                    department=department,
                )

        if any(
            keyword in lowered
            for keyword in (
                "policy",
                "freeze",
                "semester freeze",
                "rule",
                "regulation",
                "attendance",
                "semester",
                "withdrawal",
                "discipline",
            )
        ):
            return AssistantIntentProfile(
                name="policy_lookup",
                top_k=min(settings.document_retrieval_default_top_k + 1, 8),
                similarity_threshold=default_threshold,
            )

        if any(
            keyword in lowered
            for keyword in (
                "fee",
                "tuition",
                "dues",
                "charges",
                "payment",
                "refund",
                "scholarship",
                "hostel fee",
            )
        ):
            return AssistantIntentProfile(
                name="fee_lookup",
                top_k=min(settings.document_retrieval_default_top_k + 1, 8),
                similarity_threshold=max(0.60, default_threshold - 0.05),
            )

        if any(
            keyword in lowered
            for keyword in (
                "admission",
                "apply",
                "application",
                "merit",
                "eligibility",
                "entry test",
                "admitted",
            )
        ):
            return AssistantIntentProfile(
                name="admission_lookup",
                top_k=min(settings.document_retrieval_default_top_k + 1, 8),
                similarity_threshold=max(0.60, default_threshold - 0.05),
            )

        return AssistantIntentProfile(
            name="general_university_info",
            top_k=settings.document_retrieval_default_top_k,
            similarity_threshold=default_threshold,
        )

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

        for rank, item in enumerate(items, start=1):
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
                    "rank": rank,
                    "content_hash": item.get("content_hash"),
                }
            )

        return citations

    @staticmethod
    def _build_conversation_history_block(
        conversation_messages: list[dict[str, Any]],
    ) -> Optional[str]:
        if not conversation_messages:
            return None

        blocks: list[str] = []

        for item in conversation_messages[-MAX_HISTORY_MESSAGES:]:
            role = "User" if item.get("role") == "user" else "Assistant"
            content = str(item.get("content") or "").strip()

            if not content:
                continue

            if len(content) > MAX_HISTORY_CHARS_PER_MESSAGE:
                content = content[:MAX_HISTORY_CHARS_PER_MESSAGE].rstrip() + "..."

            blocks.append(f"{role}: {content}")

        if not blocks:
            return None

        return "\n".join(blocks)

    @staticmethod
    def _build_intent_resolution_text(
        query: str,
        conversation_messages: list[dict[str, Any]],
    ) -> str:
        trimmed_query = query.strip()

        if not conversation_messages:
            return trimmed_query

        lowered = trimmed_query.lower()
        looks_like_follow_up = any(
            token in lowered
            for token in (
                "what about",
                "what if",
                "and ",
                "that ",
                "those ",
                "them",
                "it ",
                "they ",
                "eligibility",
                "deadline",
                "fees",
            )
        ) or len(trimmed_query.split()) <= 5

        if not looks_like_follow_up:
            return trimmed_query

        previous_context = [
            str(item.get("content") or "").strip()
            for item in conversation_messages[-2:]
            if str(item.get("content") or "").strip()
        ]

        if not previous_context:
            return trimmed_query

        return " ".join([*previous_context, trimmed_query])
