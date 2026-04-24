"""
Assistant task executor.

Purpose:
- Execute one assistant task using the selected mode.
- Keep retrieval and generation behavior mode-specific and explicit.
"""

from typing import Any, Optional

from modules.ai.constants import (
    FALLBACK_ANSWER,
    GENERAL_FALLBACK_ANSWER,
    GENERATION_TEMPORARY_FAILURE_ANSWER,
    MAX_CONTEXT_CHARS_PER_CHUNK,
)
from modules.ai.models import AssistantTask
from services.chat_generation_service import ChatGenerationService
from services.retrieval_service import RetrievalService


def _build_static_response(query: str) -> str:
    lowered = query.strip().lower().strip("?.!,")

    if lowered in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}:
        return "Hello. How can I help you?"
    if lowered in {"thanks", "thank you"}:
        return "You're welcome."
    if lowered in {"ok", "okay", "alright"}:
        return "Okay."

    return "Hello. How can I help you?"


def _build_app_help_response(query: str, intent: str) -> str:
    lowered = query.strip().lower()

    if intent == "assistant_help":
        return (
            "I can answer general questions, help you use this library system, "
            "and answer official-document questions when matching documents are available."
        )

    if "fine" in lowered:
        return "Open the Fines section to review pending and paid fines."
    if "borrow" in lowered:
        return "Open My Borrows to check issued books, due dates, and renewals."
    if "queue" in lowered or "waiting list" in lowered:
        return "Open My Queue to track waiting-list status and pickup notices."
    if "result" in lowered:
        return "Open the Result section to view your academic result details."
    if "catalog" in lowered:
        return "Open Catalog to search books, view details, and borrow available copies."
    if "profile" in lowered:
        return "Open Profile to review your account details."

    return "Open the section you need next from the sidebar."


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


async def execute_assistant_task(
    *,
    user_id: str,
    request_id: Optional[str],
    task: AssistantTask,
) -> dict[str, Any]:
    if task.execution_mode == "static_response":
        return {
            "answer": _build_static_response(task.generation_query),
            "fallback_used": False,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 0,
            "applied_similarity_threshold": 0.0,
        }

    if task.execution_mode == "app_help_response":
        return {
            "answer": _build_app_help_response(task.generation_query, task.intent),
            "fallback_used": False,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 0,
            "applied_similarity_threshold": 0.0,
        }

    if task.execution_mode == "clarification_response":
        return {
            "answer": GENERAL_FALLBACK_ANSWER,
            "fallback_used": False,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 0,
            "applied_similarity_threshold": 0.0,
        }

    if task.execution_mode == "general_generation":
        try:
            answer = await ChatGenerationService.generate_answer(
                query=task.generation_query,
                context_block=None,
                conversation_history_block=task.history_block,
                mode="general",
            )
        except RuntimeError:
            answer = GENERAL_FALLBACK_ANSWER

        cleaned_answer = answer.strip()
        if not cleaned_answer or cleaned_answer == FALLBACK_ANSWER:
            cleaned_answer = GENERAL_FALLBACK_ANSWER

        return {
            "answer": cleaned_answer,
            "fallback_used": False,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 0,
            "applied_similarity_threshold": 0.0,
        }

    if task.execution_mode != "rag_generation":
        return {
            "answer": GENERAL_FALLBACK_ANSWER,
            "fallback_used": False,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 0,
            "applied_similarity_threshold": 0.0,
        }

    profile = task.retrieval_profile
    if profile is None or not task.retrieval_query:
        return {
            "answer": FALLBACK_ANSWER,
            "fallback_used": True,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 0,
            "applied_similarity_threshold": 0.0,
        }

    items = await RetrievalService.search_university_document_chunks(
        user_id=user_id,
        request_id=request_id,
        query=task.retrieval_query,
        top_k=profile.top_k,
        similarity_threshold=profile.similarity_threshold,
        document_type=profile.document_type,
        audience_scope=profile.audience_scope,
        department=profile.department,
    )

    if not items:
        return {
            "answer": FALLBACK_ANSWER,
            "fallback_used": True,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": profile.top_k,
            "applied_similarity_threshold": profile.similarity_threshold,
        }

    try:
        answer = await ChatGenerationService.generate_answer(
            query=task.generation_query,
            context_block=_build_context_block(items[: profile.top_k]),
            conversation_history_block=task.history_block,
            mode="grounded",
        )
    except RuntimeError:
        return {
            "answer": GENERATION_TEMPORARY_FAILURE_ANSWER,
            "fallback_used": True,
            "retrieved_chunks_count": len(items),
            "citations": [],
            "applied_top_k": profile.top_k,
            "applied_similarity_threshold": profile.similarity_threshold,
        }

    cleaned_answer = answer.strip()
    fallback_used = cleaned_answer == FALLBACK_ANSWER
    citations = [] if fallback_used else _build_citations(items[: profile.top_k])

    return {
        "answer": cleaned_answer,
        "fallback_used": fallback_used,
        "retrieved_chunks_count": len(items),
        "citations": citations,
        "applied_top_k": profile.top_k,
        "applied_similarity_threshold": profile.similarity_threshold,
    }
