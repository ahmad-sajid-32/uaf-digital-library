# apps/api/modules/ai/service.py
"""
Service layer for the AI assistant module of the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Normalize assistant input.
- Resolve one backend-owned assistant mode per turn.
- Support conversational, grounded-document, and general-answer flows.
- Keep retrieval tuning and assistant context assembly out of route handlers.
"""

from dataclasses import dataclass
from typing import Any, Dict, Optional

from core.config import settings
from core.logging import get_logger
from services.chat_generation_service import ChatGenerationService
from services.retrieval_service import RetrievalService

logger = get_logger(__name__)
FALLBACK_ANSWER = "Information not found in official documents."
GENERAL_FALLBACK_ANSWER = "Please ask a more specific question."
GENERATION_TEMPORARY_FAILURE_ANSWER = (
    "I found relevant official documents, but I can't generate an answer right now. Please try again."
)
MAX_CONTEXT_CHARS_PER_CHUNK = 1800
MAX_HISTORY_MESSAGES = 8
MAX_HISTORY_CHARS_PER_MESSAGE = 500
MAX_FOLLOW_UP_USER_MESSAGES = 2


@dataclass(frozen=True)
class AssistantIntentProfile:
    name: str
    top_k: int
    similarity_threshold: float
    document_type: Optional[str] = None
    audience_scope: Optional[str] = None
    department: Optional[str] = None


class AIService:
    @staticmethod
    async def generate_assistant_turn(
        *,
        user_id: str,
        request_id: Optional[str],
        query: str,
        conversation_messages: Optional[list[dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        history_messages = conversation_messages or []
        normalized_query = RetrievalService.normalize_assistant_query(query)
        history_block = AIService._build_conversation_history_block(history_messages)

        assistant_mode = AIService._classify_assistant_mode(
            normalized_query,
            conversation_messages=history_messages,
        )

        if assistant_mode == "conversational":
            answer = AIService._build_conversational_reply(normalized_query)
            return {
                "query": normalized_query,
                "answer": answer,
                "fallback_used": False,
                "retrieved_chunks_count": 0,
                "citations": [],
                "intent_profile": "conversation",
                "applied_top_k": 0,
                "applied_similarity_threshold": 0.0,
            }

        if assistant_mode == "general":
            answer = await AIService._generate_general_answer(
                normalized_query,
                history_block,
            )
            return {
                "query": normalized_query,
                "answer": answer,
                "fallback_used": False,
                "retrieved_chunks_count": 0,
                "citations": [],
                "intent_profile": "general_assistant",
                "applied_top_k": 0,
                "applied_similarity_threshold": 0.0,
            }

        profile_resolution_query = AIService._build_profile_resolution_query(
            normalized_query,
            history_messages,
        )
        retrieval_query = AIService._build_retrieval_query(
            normalized_query,
            history_messages,
        )

        profile = AIService.resolve_assistant_intent_profile(profile_resolution_query)

        items = await RetrievalService.search_university_document_chunks(
            user_id=user_id,
            request_id=request_id,
            query=retrieval_query,
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
                "assistant_mode": assistant_mode,
                "profile_resolution_query": profile_resolution_query,
                "retrieval_query": retrieval_query,
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

        try:
            answer = await ChatGenerationService.generate_answer(
                query=normalized_query,
                context_block=AIService._build_context_block(items[: profile.top_k]),
                conversation_history_block=history_block,
                mode="grounded",
            )
        except RuntimeError:
            return {
                "query": normalized_query,
                "answer": GENERATION_TEMPORARY_FAILURE_ANSWER,
                "fallback_used": True,
                "retrieved_chunks_count": len(items),
                "citations": [],
                "intent_profile": profile.name,
                "applied_top_k": profile.top_k,
                "applied_similarity_threshold": profile.similarity_threshold,
            }

        fallback_used = answer.strip() == FALLBACK_ANSWER
        citations = [] if fallback_used else AIService._build_citations(items[: profile.top_k])

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
    def resolve_assistant_intent_profile(query_text: str) -> AssistantIntentProfile:
        lowered = query_text.lower()
        default_threshold = settings.document_retrieval_similarity_threshold

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

        department_notice_markers = (
            "notice",
            "circular",
            "announcement",
            "office timing",
            "office hours",
            "contact",
        )

        if any(marker in lowered for marker in department_notice_markers):
            for needle, department in department_map.items():
                if needle in lowered:
                    return AssistantIntentProfile(
                        name="department_specific_notice",
                        top_k=min(settings.document_retrieval_default_top_k + 1, 8),
                        similarity_threshold=default_threshold,
                        department=department,
                    )

        return AssistantIntentProfile(
            name="general_university_info",
            top_k=settings.document_retrieval_default_top_k,
            similarity_threshold=default_threshold,
        )

    @staticmethod
    def _classify_assistant_mode(
        query: str,
        *,
        conversation_messages: list[dict[str, Any]],
    ) -> str:
        lowered = query.strip().lower()

        if AIService._is_conversational_query(lowered):
            return "conversational"

        classification_query = AIService._build_profile_resolution_query(
            query,
            conversation_messages,
        ).lower()

        if AIService._looks_like_document_query(classification_query):
            return "document"

        return "general"

    @staticmethod
    def _is_conversational_query(lowered_query: str) -> bool:
        normalized = lowered_query.strip().strip("?.!,")

        if not normalized:
            return True

        exact_phrases = {
            "hi",
            "hello",
            "hey",
            "thanks",
            "thank you",
            "ok",
            "okay",
            "alright",
            "who are you",
            "how are you",
            "help",
        }

        if normalized in exact_phrases:
            return True

        if normalized.startswith(("hi ", "hello ", "hey ")):
            return True

        return False

    @staticmethod
    def _looks_like_document_query(lowered_query: str) -> bool:
        return any(
            keyword in lowered_query
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
                "fee",
                "tuition",
                "dues",
                "charges",
                "payment",
                "refund",
                "scholarship",
                "hostel fee",
                "admission",
                "apply",
                "application",
                "merit",
                "eligibility",
                "entry test",
                "registrar",
                "admission office",
                "controller of examinations",
                "financial aid",
                "fee section",
                "official document",
                "uploaded document",
                "document",
                "notice",
                "circular",
            )
        )

    @staticmethod
    def _looks_like_follow_up(query: str) -> bool:
        lowered = query.strip().lower().strip()

        if not lowered:
            return False

        normalized = f" {lowered} "

        reference_terms = (
            " it ",
            " that ",
            " those ",
            " them ",
            " they ",
            " this ",
            " these ",
        )

        if any(term in normalized for term in reference_terms):
            return True

        if lowered.startswith(("what about", "what if", "how about", "and ")):
            return True

        words = lowered.replace("?", "").split()
        if len(words) <= 3 and words:
            first_word = words[0]
            if first_word in {"who", "what", "when", "where", "why", "how"} and not AIService._looks_like_document_query(lowered):
                return True

        return False

    @staticmethod
    def _get_recent_user_messages(
        conversation_messages: list[dict[str, Any]],
        *,
        limit: int = MAX_FOLLOW_UP_USER_MESSAGES,
    ) -> list[str]:
        user_messages = [
            str(item.get("content") or "").strip()
            for item in conversation_messages
            if item.get("role") == "user" and str(item.get("content") or "").strip()
        ]

        if not user_messages:
            return []

        return user_messages[-limit:]

    @staticmethod
    def _build_profile_resolution_query(
        query: str,
        conversation_messages: list[dict[str, Any]],
    ) -> str:
        trimmed_query = query.strip()

        if not trimmed_query:
            return trimmed_query

        if not conversation_messages or not AIService._looks_like_follow_up(trimmed_query):
            return trimmed_query

        recent_user_messages = AIService._get_recent_user_messages(conversation_messages)

        if not recent_user_messages:
            return trimmed_query

        combined = " ".join([*recent_user_messages, trimmed_query]).strip()
        return " ".join(combined.split())

    @staticmethod
    def _build_retrieval_query(
        query: str,
        conversation_messages: list[dict[str, Any]],
    ) -> str:
        trimmed_query = query.strip()

        if not trimmed_query:
            return trimmed_query

        if not conversation_messages or not AIService._looks_like_follow_up(trimmed_query):
            return trimmed_query

        recent_user_messages = AIService._get_recent_user_messages(conversation_messages)

        if not recent_user_messages:
            return trimmed_query

        combined = " ".join([*recent_user_messages, trimmed_query]).strip()
        return " ".join(combined.split())

    @staticmethod
    def _build_conversational_reply(query: str) -> str:
        lowered = query.strip().lower().strip("?.!,")

        if lowered in {"hi", "hello", "hey"}:
            return "Hello. How can I help you?"

        if lowered in {"thanks", "thank you"}:
            return "You're welcome."

        if lowered in {"ok", "okay", "alright"}:
            return "Okay."

        if lowered == "who are you":
            return "I am your assistant for this system. I can help with document-based and general questions."

        if lowered == "how are you":
            return "I'm ready to help."

        if lowered == "help":
            return "Ask me a document question or a general question, and I will answer directly."

        return "Hello. How can I help you?"

    @staticmethod
    async def _generate_general_answer(
        query: str,
        history_block: Optional[str],
    ) -> str:
        try:
            answer = await ChatGenerationService.generate_answer(
                query=query,
                context_block=None,
                conversation_history_block=history_block,
                mode="general",
            )
        except RuntimeError:
            return GENERAL_FALLBACK_ANSWER

        cleaned = answer.strip()

        if not cleaned or cleaned == FALLBACK_ANSWER:
            return GENERAL_FALLBACK_ANSWER

        return cleaned

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
                    "similarity_score": max(
                        0.0,
                        min(1.0, float(item["similarity_score"])),
                    ),
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
