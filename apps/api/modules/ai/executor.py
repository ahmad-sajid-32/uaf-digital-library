# apps/api/modules/ai/executor.py
"""
Assistant task executor.

Purpose:
- Execute one assistant task using the selected execution mode.
- Keep retrieval and generation behavior mode-specific and explicit.
- Return internal response metadata so the validator can distinguish normal
  answers, strict document fallback, generation failure, and general fallback.

Integration notes:
- Non-RAG modes must not call document retrieval.
- RAG mode must use official document retrieval and grounded generation.
- `response_kind` is internal pipeline metadata. It is not part of the public
  `/api/ai/*` response contract.
"""

from typing import Any, Optional

from modules.ai.constants import (
    FALLBACK_ANSWER,
    GENERAL_FALLBACK_ANSWER,
    GENERATION_TEMPORARY_FAILURE_ANSWER,
    MAX_CONTEXT_CHARS_PER_CHUNK,
)
from modules.ai.models import AssistantResponseKind, AssistantTask
from services.chat_generation_service import ChatGenerationService
from services.retrieval_service import RetrievalService


def _build_execution_result(
    *,
    answer: str,
    response_kind: AssistantResponseKind,
    fallback_used: bool,
    retrieved_chunks_count: int = 0,
    citations: list[dict[str, Any]] | None = None,
    applied_top_k: int = 0,
    applied_similarity_threshold: float = 0.0,
) -> dict[str, Any]:
    """
    Build a normalized internal executor result.

    Args:
        answer (str): Final answer text or fallback text.
        response_kind (AssistantResponseKind): Internal response category used
            by the response validator.
        fallback_used (bool): Whether a fallback-like path was used.
        retrieved_chunks_count (int): Number of retrieved chunks used or found.
        citations (list[dict[str, Any]] | None): Citation payloads for grounded
            answers.
        applied_top_k (int): Effective top-k used for retrieval.
        applied_similarity_threshold (float): Effective retrieval threshold.

    Returns:
        dict[str, Any]: Internal executor result consumed by the response
        validator.
    """

    return {
        "answer": answer,
        "response_kind": response_kind,
        "fallback_used": fallback_used,
        "retrieved_chunks_count": max(0, retrieved_chunks_count),
        "citations": citations or [],
        "applied_top_k": max(0, applied_top_k),
        "applied_similarity_threshold": applied_similarity_threshold,
    }


def _build_static_response(query: str) -> str:
    """
    Build deterministic response text for short conversational turns.

    Args:
        query (str): Current user query.

    Returns:
        str: Static assistant response.
    """

    lowered = query.strip().lower().strip("?.!,")

    if lowered in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}:
        return "Hello. I can help with library tasks, general questions, and official-document questions."
    if lowered in {"thanks", "thank you"}:
        return "You're welcome."
    if lowered in {"ok", "okay", "alright"}:
        return "Okay."

    return "Hello. I can help with library tasks, general questions, and official-document questions."


def _build_assistant_capability_response() -> str:
    """
    Build the assistant capability response.

    Returns:
        str: User-facing capability explanation.
    """

    return (
        "I can help in three ways:\n\n"
        "1. General questions: ask normal learning or explanation questions.\n"
        "2. Library system help: ask where to find catalog, borrowed books, fines, waiting list, result, or profile.\n"
        "3. Official-document questions: ask about university rules, policies, fees, notices, or procedures. "
        "When matching official documents are available, I will answer from those sources and show citations."
    )


def _build_fines_help_response() -> str:
    """
    Build help text for fine-related navigation.

    Returns:
        str: Fines section guidance.
    """

    return (
        "Open the Fines section. There you can review fines linked to your account, "
        "including pending and paid records. Start with pending fines if you want to "
        "see what still needs attention."
    )


def _build_borrows_help_response() -> str:
    """
    Build help text for borrow-related navigation.

    Returns:
        str: Borrow section guidance.
    """

    return (
        "Open My Borrows. There you can check books currently issued to you, due dates, "
        "renewal status, and return-related information. Start there when you want to "
        "see what you have borrowed."
    )


def _build_queue_help_response() -> str:
    """
    Build help text for waiting-list navigation.

    Returns:
        str: Queue section guidance.
    """

    return (
        "Open My Queue. There you can track books you are waiting for and see whether "
        "any item is ready for pickup. Use this section after joining a waiting list "
        "from the catalog."
    )


def _build_result_help_response() -> str:
    """
    Build help text for result navigation.

    Returns:
        str: Result section guidance.
    """

    return (
        "Open the Result section. There you can view your protected academic result "
        "details when they are available for your account."
    )


def _build_catalog_help_response() -> str:
    """
    Build help text for catalog navigation.

    Returns:
        str: Catalog section guidance.
    """

    return (
        "Open Catalog. There you can search books, check availability, view book details, "
        "borrow available books, or join the waiting list for books that are not currently available."
    )


def _build_profile_help_response() -> str:
    """
    Build help text for profile navigation.

    Returns:
        str: Profile section guidance.
    """

    return (
        "Open Profile. There you can review your account details and confirm that your "
        "library profile information is correct."
    )


def _build_dashboard_help_response() -> str:
    """
    Build help text for dashboard navigation.

    Returns:
        str: Dashboard section guidance.
    """

    return (
        "Open Dashboard for a quick overview. It shows the most important library activity "
        "for your role, such as borrowed books, fines, waiting-list items, or staff work."
    )


def _build_app_help_response(query: str, intent: str) -> str:
    """
    Build deterministic application-help response text.

    Args:
        query (str): Current user query.
        intent (str): Final assistant intent.

    Returns:
        str: User-facing app-help response.
    """

    lowered = query.strip().lower()

    if intent == "assistant_help":
        return _build_assistant_capability_response()

    if "fine" in lowered:
        return _build_fines_help_response()
    if "borrow" in lowered or "issued" in lowered:
        return _build_borrows_help_response()
    if "queue" in lowered or "waiting list" in lowered or "pickup" in lowered:
        return _build_queue_help_response()
    if "result" in lowered:
        return _build_result_help_response()
    if "catalog" in lowered or "book" in lowered or "search" in lowered:
        return _build_catalog_help_response()
    if "profile" in lowered or "account" in lowered:
        return _build_profile_help_response()
    if "dashboard" in lowered:
        return _build_dashboard_help_response()

    return (
        "Use the sidebar to open the section you need. Catalog is for finding books, "
        "My Borrows is for issued books and due dates, My Queue is for waiting-list "
        "status, Fines is for fine records, Result is for academic results, and "
        "Profile is for account details."
    )


def _build_context_block(items: list[dict[str, Any]]) -> str:
    """
    Build the official document context block for grounded generation.

    Args:
        items (list[dict[str, Any]]): Retrieved document chunks.

    Returns:
        str: Prompt-ready official context block.
    """

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
    """
    Build citation payloads from retrieved document chunks.

    Args:
        items (list[dict[str, Any]]): Retrieved document chunks.

    Returns:
        list[dict[str, Any]]: Deduplicated citation payloads.
    """

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


async def _execute_general_generation(task: AssistantTask) -> dict[str, Any]:
    """
    Execute a general-generation assistant task.

    Args:
        task (AssistantTask): Planned assistant task.

    Returns:
        dict[str, Any]: Internal executor result.
    """

    try:
        answer = await ChatGenerationService.generate_answer(
            query=task.generation_query,
            context_block=None,
            conversation_history_block=task.history_block,
            mode="general",
        )
    except RuntimeError:
        return _build_execution_result(
            answer=GENERAL_FALLBACK_ANSWER,
            response_kind="general_fallback",
            fallback_used=True,
        )

    cleaned_answer = answer.strip()
    if not cleaned_answer or cleaned_answer == FALLBACK_ANSWER:
        return _build_execution_result(
            answer=GENERAL_FALLBACK_ANSWER,
            response_kind="general_fallback",
            fallback_used=True,
        )

    return _build_execution_result(
        answer=cleaned_answer,
        response_kind="normal",
        fallback_used=False,
    )


async def _execute_rag_generation(
    *,
    user_id: str,
    request_id: Optional[str],
    task: AssistantTask,
) -> dict[str, Any]:
    """
    Execute a document-grounded assistant task.

    Args:
        user_id (str): Authenticated user ID.
        request_id (Optional[str]): Request ID for logging/retrieval context.
        task (AssistantTask): Planned assistant task.

    Returns:
        dict[str, Any]: Internal executor result.
    """

    profile = task.retrieval_profile
    if profile is None or not task.retrieval_query:
        return _build_execution_result(
            answer=FALLBACK_ANSWER,
            response_kind="strict_document_fallback",
            fallback_used=True,
        )

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
        return _build_execution_result(
            answer=FALLBACK_ANSWER,
            response_kind="strict_document_fallback",
            fallback_used=True,
            retrieved_chunks_count=0,
            applied_top_k=profile.top_k,
            applied_similarity_threshold=profile.similarity_threshold,
        )

    top_items = items[: profile.top_k]

    try:
        answer = await ChatGenerationService.generate_answer(
            query=task.generation_query,
            context_block=_build_context_block(top_items),
            conversation_history_block=task.history_block,
            mode="grounded",
        )
    except RuntimeError:
        return _build_execution_result(
            answer=GENERATION_TEMPORARY_FAILURE_ANSWER,
            response_kind="generation_temporary_failure",
            fallback_used=True,
            retrieved_chunks_count=len(items),
            citations=[],
            applied_top_k=profile.top_k,
            applied_similarity_threshold=profile.similarity_threshold,
        )

    cleaned_answer = answer.strip()
    if not cleaned_answer or cleaned_answer == FALLBACK_ANSWER:
        return _build_execution_result(
            answer=FALLBACK_ANSWER,
            response_kind="strict_document_fallback",
            fallback_used=True,
            retrieved_chunks_count=len(items),
            citations=[],
            applied_top_k=profile.top_k,
            applied_similarity_threshold=profile.similarity_threshold,
        )

    return _build_execution_result(
        answer=cleaned_answer,
        response_kind="normal",
        fallback_used=False,
        retrieved_chunks_count=len(items),
        citations=_build_citations(top_items),
        applied_top_k=profile.top_k,
        applied_similarity_threshold=profile.similarity_threshold,
    )


async def execute_assistant_task(
    *,
    user_id: str,
    request_id: Optional[str],
    task: AssistantTask,
) -> dict[str, Any]:
    """
    Execute a planned assistant task.

    Args:
        user_id (str): Authenticated user ID.
        request_id (Optional[str]): Request ID for retrieval/logging context.
        task (AssistantTask): Final assistant task from the planner.

    Returns:
        dict[str, Any]: Internal executor result consumed by the response
        validator.
    """

    if task.execution_mode == "static_response":
        return _build_execution_result(
            answer=_build_static_response(task.generation_query),
            response_kind="normal",
            fallback_used=False,
        )

    if task.execution_mode == "app_help_response":
        return _build_execution_result(
            answer=_build_app_help_response(task.generation_query, task.intent),
            response_kind="normal",
            fallback_used=False,
        )

    if task.execution_mode == "clarification_response":
        return _build_execution_result(
            answer=GENERAL_FALLBACK_ANSWER,
            response_kind="general_fallback",
            fallback_used=True,
        )

    if task.execution_mode == "general_generation":
        return await _execute_general_generation(task)

    if task.execution_mode == "rag_generation":
        return await _execute_rag_generation(
            user_id=user_id,
            request_id=request_id,
            task=task,
        )

    return _build_execution_result(
        answer=GENERAL_FALLBACK_ANSWER,
        response_kind="general_fallback",
        fallback_used=True,
    )