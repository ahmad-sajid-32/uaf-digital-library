# apps/api/tests/modules/ai/test_response_validator.py
"""
Tests for assistant response validation.

Purpose:
- Prove assistant responses are safe before persistence.
- Ensure non-RAG modes never keep citations or retrieval metadata.
- Ensure RAG answers require citations unless they are valid fallback states.
- Preserve the distinction between "information not found" and temporary
  generation failure after successful retrieval.

Integration notes:
- These tests do not call retrieval, database, embeddings, or the LLM.
- These tests validate the final generated-turn shape consumed by the assistant
  pipeline and AssistantService.
"""

from modules.ai.constants import (
    FALLBACK_ANSWER,
    GENERAL_FALLBACK_ANSWER,
    GENERATION_TEMPORARY_FAILURE_ANSWER,
)
from modules.ai.models import AssistantTask, RetrievalProfile
from modules.ai.response_validator import validate_assistant_response


def _base_task(
    *,
    execution_mode: str,
    intent: str = "general_question",
    fallback_policy: str = "none",
    requires_citations: bool = False,
    requires_official_sources: bool = False,
) -> AssistantTask:
    """
    Build a minimal assistant task for validator tests.

    Args:
        execution_mode (str): Assistant execution mode.
        intent (str): Assistant intent.
        fallback_policy (str): Task fallback policy.
        requires_citations (bool): Whether the task requires citations.
        requires_official_sources (bool): Whether official sources are required.

    Returns:
        AssistantTask: Test task instance.
    """

    return AssistantTask(
        query="test",
        intent=intent,  # type: ignore[arg-type]
        execution_mode=execution_mode,  # type: ignore[arg-type]
        retrieval_query=None,
        generation_query="test",
        retrieval_profile=None,
        history_block=None,
        fallback_policy=fallback_policy,  # type: ignore[arg-type]
        requires_citations=requires_citations,
        requires_official_sources=requires_official_sources,
        intent_profile=f"{execution_mode}:{intent}",
    )


def _rag_task() -> AssistantTask:
    """
    Build a document-grounded assistant task for validator tests.

    Returns:
        AssistantTask: RAG test task instance.
    """

    return AssistantTask(
        query="What is semester freeze policy?",
        intent="document_question",
        execution_mode="rag_generation",
        retrieval_query="What is semester freeze policy?",
        generation_query="What is semester freeze policy?",
        retrieval_profile=RetrievalProfile(
            name="policy_lookup",
            top_k=4,
            similarity_threshold=0.65,
        ),
        history_block=None,
        fallback_policy="strict_document_fallback",
        requires_citations=True,
        requires_official_sources=True,
        intent_profile="rag:policy_lookup",
    )


def test_validator_removes_citations_for_non_rag_modes() -> None:
    """
    Non-RAG modes must not persist citations or retrieval metadata.
    """

    task = _base_task(execution_mode="general_generation")
    validated = validate_assistant_response(
        task,
        {
            "answer": "General answer",
            "response_kind": "normal",
            "fallback_used": False,
            "retrieved_chunks_count": 4,
            "citations": [{"rank": 1, "similarity_score": 0.99}],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["answer"] == "General answer"
    assert validated["fallback_used"] is False
    assert validated["citations"] == []
    assert validated["retrieved_chunks_count"] == 0
    assert validated["applied_top_k"] == 0
    assert validated["applied_similarity_threshold"] == 0.0


def test_validator_uses_general_fallback_for_blank_non_rag_answer() -> None:
    """
    Blank non-RAG answers should become the general fallback.
    """

    task = _base_task(execution_mode="general_generation")
    validated = validate_assistant_response(
        task,
        {
            "answer": "   ",
            "response_kind": "normal",
            "fallback_used": False,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 0,
            "applied_similarity_threshold": 0.0,
        },
    )

    assert validated["answer"] == GENERAL_FALLBACK_ANSWER
    assert validated["fallback_used"] is True
    assert validated["citations"] == []
    assert validated["retrieved_chunks_count"] == 0


def test_validator_uses_general_fallback_for_non_rag_general_fallback_kind() -> None:
    """
    Non-RAG general fallback kind should persist the general fallback answer.
    """

    task = _base_task(execution_mode="clarification_response")
    validated = validate_assistant_response(
        task,
        {
            "answer": "Some ignored answer",
            "response_kind": "general_fallback",
            "fallback_used": True,
            "retrieved_chunks_count": 3,
            "citations": [{"rank": 1, "similarity_score": 0.9}],
            "applied_top_k": 3,
            "applied_similarity_threshold": 0.7,
        },
    )

    assert validated["answer"] == GENERAL_FALLBACK_ANSWER
    assert validated["fallback_used"] is True
    assert validated["citations"] == []
    assert validated["retrieved_chunks_count"] == 0
    assert validated["applied_top_k"] == 0
    assert validated["applied_similarity_threshold"] == 0.0


def test_validator_accepts_rag_answer_with_citations() -> None:
    """
    RAG normal answers should be accepted only when citations exist.
    """

    task = _rag_task()
    validated = validate_assistant_response(
        task,
        {
            "answer": "The semester freeze policy allows eligible students to apply.",
            "response_kind": "normal",
            "fallback_used": False,
            "retrieved_chunks_count": 2,
            "citations": [
                {
                    "document_id": "document-1",
                    "document_title": "Academic Rules",
                    "original_filename": "rules.pdf",
                    "chunk_id": "chunk-1",
                    "chunk_index": 3,
                    "section_label": "Semester Freeze",
                    "page_number": 4,
                    "similarity_score": 0.91,
                    "rank": 1,
                }
            ],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["answer"] == (
        "The semester freeze policy allows eligible students to apply."
    )
    assert validated["fallback_used"] is False
    assert validated["retrieved_chunks_count"] == 2
    assert len(validated["citations"]) == 1
    assert validated["applied_top_k"] == 4
    assert validated["applied_similarity_threshold"] == 0.65


def test_validator_forces_rag_fallback_when_citations_missing() -> None:
    """
    Generated RAG answers without citations must not be persisted.
    """

    task = _rag_task()
    validated = validate_assistant_response(
        task,
        {
            "answer": "Generated answer without citations",
            "response_kind": "normal",
            "fallback_used": False,
            "retrieved_chunks_count": 2,
            "citations": [],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["answer"] == FALLBACK_ANSWER
    assert validated["fallback_used"] is True
    assert validated["citations"] == []
    assert validated["retrieved_chunks_count"] == 0
    assert validated["applied_top_k"] == 4
    assert validated["applied_similarity_threshold"] == 0.65


def test_validator_preserves_strict_document_fallback() -> None:
    """
    Strict document fallback should remain exact and citation-free.
    """

    task = _rag_task()
    validated = validate_assistant_response(
        task,
        {
            "answer": FALLBACK_ANSWER,
            "response_kind": "strict_document_fallback",
            "fallback_used": True,
            "retrieved_chunks_count": 0,
            "citations": [],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["answer"] == FALLBACK_ANSWER
    assert validated["fallback_used"] is True
    assert validated["citations"] == []
    assert validated["retrieved_chunks_count"] == 0
    assert validated["applied_top_k"] == 4
    assert validated["applied_similarity_threshold"] == 0.65


def test_validator_preserves_generation_temporary_failure_after_retrieval() -> None:
    """
    Temporary generation failure after retrieved chunks must not become
    "Information not found in official documents."
    """

    task = _rag_task()
    validated = validate_assistant_response(
        task,
        {
            "answer": GENERATION_TEMPORARY_FAILURE_ANSWER,
            "response_kind": "generation_temporary_failure",
            "fallback_used": True,
            "retrieved_chunks_count": 3,
            "citations": [{"rank": 1, "similarity_score": 0.9}],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["answer"] == GENERATION_TEMPORARY_FAILURE_ANSWER
    assert validated["answer"] != FALLBACK_ANSWER
    assert validated["fallback_used"] is True
    assert validated["retrieved_chunks_count"] == 3
    assert validated["citations"] == []
    assert validated["applied_top_k"] == 4
    assert validated["applied_similarity_threshold"] == 0.65


def test_validator_forces_rag_fallback_for_blank_rag_answer() -> None:
    """
    Blank RAG answers should become strict document fallback.
    """

    task = _rag_task()
    validated = validate_assistant_response(
        task,
        {
            "answer": "   ",
            "response_kind": "normal",
            "fallback_used": False,
            "retrieved_chunks_count": 2,
            "citations": [
                {
                    "document_id": "document-1",
                    "document_title": "Academic Rules",
                    "original_filename": "rules.pdf",
                    "chunk_id": "chunk-1",
                    "chunk_index": 3,
                    "section_label": "Semester Freeze",
                    "page_number": 4,
                    "similarity_score": 0.91,
                    "rank": 1,
                }
            ],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["answer"] == FALLBACK_ANSWER
    assert validated["fallback_used"] is True
    assert validated["citations"] == []
    assert validated["retrieved_chunks_count"] == 2


def test_validator_clamps_similarity_scores_and_thresholds() -> None:
    """
    Citation similarity and applied threshold must stay in the 0..1 range.
    """

    task = _rag_task()
    validated = validate_assistant_response(
        task,
        {
            "answer": "Supported answer.",
            "response_kind": "normal",
            "fallback_used": False,
            "retrieved_chunks_count": 2,
            "citations": [
                {
                    "document_id": "document-1",
                    "document_title": "Academic Rules",
                    "original_filename": "rules.pdf",
                    "chunk_id": "chunk-1",
                    "chunk_index": 3,
                    "section_label": "Semester Freeze",
                    "page_number": 4,
                    "similarity_score": 1.25,
                    "rank": 1,
                },
                {
                    "document_id": "document-2",
                    "document_title": "Academic Rules",
                    "original_filename": "rules.pdf",
                    "chunk_id": "chunk-2",
                    "chunk_index": 4,
                    "section_label": "Requirements",
                    "page_number": 5,
                    "similarity_score": -0.25,
                    "rank": 2,
                },
            ],
            "applied_top_k": 4,
            "applied_similarity_threshold": 1.25,
        },
    )

    citations = validated["citations"]

    assert isinstance(citations, list)
    assert citations[0]["similarity_score"] == 1.0
    assert citations[1]["similarity_score"] == 0.0
    assert validated["applied_similarity_threshold"] == 1.0