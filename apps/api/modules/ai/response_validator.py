# apps/api/modules/ai/response_validator.py
"""
Assistant response validator.

Purpose:
- Enforce mode-safe output before persistence.
- Prevent invalid citation/fallback combinations from leaking to storage/UI.
- Preserve the difference between strict document fallback and temporary
  generation failure after successful retrieval.

Integration notes:
- `response_kind` is internal pipeline metadata produced by the executor.
- `response_kind` is intentionally not returned in the final public assistant
  message payload.
- Public `/api/ai/*` response shape remains unchanged.
"""

from typing import Any

from modules.ai.constants import (
    FALLBACK_ANSWER,
    GENERAL_FALLBACK_ANSWER,
    GENERATION_TEMPORARY_FAILURE_ANSWER,
)
from modules.ai.models import AssistantResponseKind, AssistantTask

VALID_RESPONSE_KINDS: set[AssistantResponseKind] = {
    "normal",
    "strict_document_fallback",
    "generation_temporary_failure",
    "general_fallback",
}


def _safe_int(value: object, *, default: int = 0) -> int:
    """
    Convert a value to a non-negative integer.

    Args:
        value (object): Raw value.
        default (int): Value used when conversion fails.

    Returns:
        int: Non-negative integer.
    """

    try:
        numeric = int(value)
    except (TypeError, ValueError):
        numeric = default

    return max(0, numeric)


def _safe_float(value: object, *, default: float = 0.0) -> float:
    """
    Convert a value to float.

    Args:
        value (object): Raw value.
        default (float): Value used when conversion fails.

    Returns:
        float: Parsed float value.
    """

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp_similarity(value: object) -> float:
    """
    Clamp a similarity score into the valid display/storage range.

    Args:
        value (object): Raw similarity score.

    Returns:
        float: Score between 0.0 and 1.0.
    """

    numeric = _safe_float(value)
    return max(0.0, min(1.0, numeric))


def _resolve_response_kind(response: dict[str, object]) -> AssistantResponseKind:
    """
    Resolve internal executor response kind safely.

    Args:
        response (dict[str, object]): Raw executor response.

    Returns:
        AssistantResponseKind: Valid response kind.
    """

    response_kind = str(response.get("response_kind") or "normal")

    if response_kind in VALID_RESPONSE_KINDS:
        return response_kind  # type: ignore[return-value]

    return "normal"


def _normalize_citations(citations: list[object]) -> list[dict[str, object]]:
    """
    Normalize citation dictionaries and clamp similarity scores.

    Args:
        citations (list[object]): Raw citation list.

    Returns:
        list[dict[str, object]]: Clean citation list.
    """

    normalized_citations: list[dict[str, object]] = []

    for citation in citations:
        if not isinstance(citation, dict):
            continue

        normalized: dict[str, object] = dict(citation)
        normalized["similarity_score"] = _clamp_similarity(
            citation.get("similarity_score")
        )
        normalized_citations.append(normalized)

    return normalized_citations


def _validate_non_rag_response(
    *,
    answer: str,
    response_kind: AssistantResponseKind,
) -> dict[str, object]:
    """
    Validate static, app-help, general, and clarification responses.

    Non-RAG modes must never persist citations or retrieval counts.

    Args:
        answer (str): Candidate answer.
        response_kind (AssistantResponseKind): Internal response kind.

    Returns:
        dict[str, object]: Validated non-RAG response payload.
    """

    if response_kind == "general_fallback" or not answer:
        answer = GENERAL_FALLBACK_ANSWER
        fallback_used = True
    else:
        fallback_used = False

    return {
        "answer": answer,
        "fallback_used": fallback_used,
        "retrieved_chunks_count": 0,
        "citations": [],
        "applied_top_k": 0,
        "applied_similarity_threshold": 0.0,
    }


def _validate_rag_response(
    *,
    answer: str,
    response_kind: AssistantResponseKind,
    fallback_used: bool,
    retrieved_chunks_count: int,
    citations: list[object],
    applied_top_k: int,
    applied_similarity_threshold: float,
) -> dict[str, object]:
    """
    Validate document-grounded responses.

    RAG has three valid outcomes:
    1. Normal cited answer.
    2. Strict document fallback when no supported answer exists.
    3. Temporary generation failure when retrieval succeeded but generation
       failed.

    Args:
        answer (str): Candidate answer.
        response_kind (AssistantResponseKind): Internal response kind.
        fallback_used (bool): Candidate fallback flag.
        retrieved_chunks_count (int): Retrieved chunk count.
        citations (list[object]): Candidate citations.
        applied_top_k (int): Applied retrieval top-k.
        applied_similarity_threshold (float): Applied retrieval threshold.

    Returns:
        dict[str, object]: Validated RAG response payload.
    """

    normalized_threshold = _clamp_similarity(applied_similarity_threshold)

    if response_kind == "generation_temporary_failure":
        return {
            "answer": GENERATION_TEMPORARY_FAILURE_ANSWER,
            "fallback_used": True,
            "retrieved_chunks_count": retrieved_chunks_count,
            "citations": [],
            "applied_top_k": applied_top_k,
            "applied_similarity_threshold": normalized_threshold,
        }

    if (
        response_kind == "strict_document_fallback"
        or fallback_used
        or not answer
        or answer == FALLBACK_ANSWER
    ):
        return {
            "answer": FALLBACK_ANSWER,
            "fallback_used": True,
            "retrieved_chunks_count": retrieved_chunks_count,
            "citations": [],
            "applied_top_k": applied_top_k,
            "applied_similarity_threshold": normalized_threshold,
        }

    normalized_citations = _normalize_citations(citations)

    if not normalized_citations:
        return {
            "answer": FALLBACK_ANSWER,
            "fallback_used": True,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": applied_top_k,
            "applied_similarity_threshold": normalized_threshold,
        }

    return {
        "answer": answer,
        "fallback_used": False,
        "retrieved_chunks_count": retrieved_chunks_count,
        "citations": normalized_citations,
        "applied_top_k": applied_top_k,
        "applied_similarity_threshold": normalized_threshold,
    }


def validate_assistant_response(
    task: AssistantTask,
    response: dict[str, object],
) -> dict[str, object]:
    """
    Validate an assistant executor response before persistence.

    Args:
        task (AssistantTask): Planned assistant task.
        response (dict[str, object]): Raw internal executor response.

    Returns:
        dict[str, object]: Public-shape generated-turn fields consumed by the
        assistant pipeline.
    """

    answer = str(response.get("answer") or "").strip()
    response_kind = _resolve_response_kind(response)
    fallback_used = bool(response.get("fallback_used"))
    retrieved_chunks_count = _safe_int(response.get("retrieved_chunks_count"))
    applied_top_k = _safe_int(response.get("applied_top_k"))
    applied_similarity_threshold = _safe_float(
        response.get("applied_similarity_threshold")
    )
    raw_citations = list(response.get("citations") or [])

    if task.execution_mode != "rag_generation":
        return _validate_non_rag_response(
            answer=answer,
            response_kind=response_kind,
        )

    return _validate_rag_response(
        answer=answer,
        response_kind=response_kind,
        fallback_used=fallback_used,
        retrieved_chunks_count=retrieved_chunks_count,
        citations=raw_citations,
        applied_top_k=applied_top_k,
        applied_similarity_threshold=applied_similarity_threshold,
    )