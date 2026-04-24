"""
Assistant response validator.

Purpose:
- Enforce mode-safe output before persistence.
- Prevent invalid citation/fallback combinations from leaking to storage/UI.
"""

from modules.ai.constants import FALLBACK_ANSWER, GENERAL_FALLBACK_ANSWER
from modules.ai.models import AssistantTask


def _clamp_similarity(value: object) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0

    return max(0.0, min(1.0, numeric))


def validate_assistant_response(
    task: AssistantTask,
    response: dict[str, object],
) -> dict[str, object]:
    answer = str(response.get("answer") or "").strip()
    citations = list(response.get("citations") or [])

    try:
        retrieved_chunks_count = int(response.get("retrieved_chunks_count") or 0)
    except (TypeError, ValueError):
        retrieved_chunks_count = 0
    retrieved_chunks_count = max(0, retrieved_chunks_count)

    applied_top_k = int(response.get("applied_top_k") or 0)
    applied_similarity_threshold = float(response.get("applied_similarity_threshold") or 0.0)
    fallback_used = bool(response.get("fallback_used"))

    if not answer:
        if task.execution_mode == "rag_generation":
            answer = FALLBACK_ANSWER
            fallback_used = True
        else:
            answer = GENERAL_FALLBACK_ANSWER
            fallback_used = True

    if task.execution_mode != "rag_generation":
        citations = []
        retrieved_chunks_count = 0
        applied_top_k = 0
        applied_similarity_threshold = 0.0
        fallback_used = False

    if task.execution_mode == "rag_generation":
        if fallback_used or answer == FALLBACK_ANSWER:
            answer = FALLBACK_ANSWER
            fallback_used = True
            citations = []
        elif not citations:
            answer = FALLBACK_ANSWER
            fallback_used = True
            citations = []
            retrieved_chunks_count = 0

    normalized_citations: list[dict[str, object]] = []
    for citation in citations:
        if not isinstance(citation, dict):
            continue
        normalized = dict(citation)
        normalized["similarity_score"] = _clamp_similarity(
            citation.get("similarity_score")
        )
        normalized_citations.append(normalized)

    return {
        "answer": answer,
        "fallback_used": fallback_used,
        "retrieved_chunks_count": retrieved_chunks_count,
        "citations": normalized_citations,
        "applied_top_k": applied_top_k,
        "applied_similarity_threshold": applied_similarity_threshold,
    }
