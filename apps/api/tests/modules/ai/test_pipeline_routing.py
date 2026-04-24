# apps/api/tests/modules/ai/test_pipeline_routing.py
"""
Tests for assistant pipeline routing.

Purpose:
- Prove the full assistant pipeline routes turns to the correct execution mode.
- Ensure non-RAG turns never call document retrieval.
- Ensure document turns call retrieval only when routing and history rules allow it.
- Verify document follow-up works only after a successful cited RAG answer.

Integration notes:
- These tests must not call real LLM, retrieval RPC, embeddings, Supabase, or
  external network services.
- Retrieval and generation are monkeypatched at service boundaries.
"""

import asyncio
from typing import Any

from modules.ai import pipeline as assistant_pipeline
from modules.ai.constants import FALLBACK_ANSWER, GENERAL_FALLBACK_ANSWER


USER_ID = "00000000-0000-0000-0000-000000000001"


def _successful_rag_history() -> list[dict[str, object]]:
    """
    Build recent history representing a successful cited RAG answer.

    Returns:
        list[dict[str, object]]: Minimal conversation history with metadata
        required by the history selector.
    """

    return [
        {
            "role": "user",
            "content": "What is the semester freeze policy?",
        },
        {
            "role": "assistant",
            "content": "Policy answer.",
            "intent_profile": "rag:policy_lookup",
            "fallback_used": False,
            "retrieved_chunks_count": 2,
            "has_citations": True,
        },
    ]


def _rag_fallback_history() -> list[dict[str, object]]:
    """
    Build recent history representing a failed/fallback RAG answer.

    Returns:
        list[dict[str, object]]: Minimal conversation history where prior RAG
        must not be used for follow-up.
    """

    return [
        {
            "role": "user",
            "content": "What is the semester freeze policy?",
        },
        {
            "role": "assistant",
            "content": FALLBACK_ANSWER,
            "intent_profile": "rag:policy_lookup",
            "fallback_used": True,
            "retrieved_chunks_count": 0,
            "has_citations": False,
        },
    ]


def _fake_document_chunk(
    *,
    chunk_id: str = "660e8400-e29b-41d4-a716-446655440000",
    chunk_index: int = 3,
    section_label: str = "Semester Freeze Policy",
    content: str = "Students may apply for semester freeze before midterm.",
) -> dict[str, object]:
    """
    Build one fake citation-ready retrieval chunk.

    Args:
        chunk_id (str): Fake chunk ID.
        chunk_index (int): Fake chunk index.
        section_label (str): Fake section label.
        content (str): Fake chunk content.

    Returns:
        dict[str, object]: Retrieval result shaped like the real RPC row.
    """

    return {
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "document_title": "Semester Rules 2026",
        "original_filename": "semester-rules.pdf",
        "chunk_id": chunk_id,
        "chunk_index": chunk_index,
        "section_label": section_label,
        "page_number": 7,
        "similarity_score": 0.84,
        "content_hash": "abc",
        "content": content,
    }


def _patch_retrieval_to_fail(monkeypatch: Any) -> None:
    """
    Patch retrieval so the test fails if RAG is called.

    Args:
        monkeypatch (Any): Pytest monkeypatch fixture.
    """

    async def fail_retrieval(**kwargs: Any) -> list[dict[str, object]]:
        raise AssertionError("retrieval should not run for this pipeline case")

    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fail_retrieval,
    )


def _patch_generation_to_fail(monkeypatch: Any) -> None:
    """
    Patch generation so the test fails if provider generation is called.

    Args:
        monkeypatch (Any): Pytest monkeypatch fixture.
    """

    async def fail_generation(**kwargs: Any) -> str:
        raise AssertionError("generation should not run for this pipeline case")

    monkeypatch.setattr(
        "services.chat_generation_service.ChatGenerationService.generate_answer",
        fail_generation,
    )


def _run_pipeline(
    *,
    query: str,
    conversation_messages: list[dict[str, object]] | None = None,
    request_id: str = "req-test",
) -> dict[str, object]:
    """
    Run the assistant pipeline synchronously for tests.

    Args:
        query (str): Current user query.
        conversation_messages (list[dict[str, object]] | None): Recent history.
        request_id (str): Fake request ID.

    Returns:
        dict[str, object]: Generated-turn result.
    """

    return asyncio.run(
        assistant_pipeline.run_assistant_pipeline(
            user_id=USER_ID,
            request_id=request_id,
            query=query,
            conversation_messages=conversation_messages or [],
        )
    )


def test_pipeline_greeting_after_document_history_does_not_call_retrieval(
    monkeypatch: Any,
) -> None:
    """
    Greeting after document history must stay static and non-RAG.
    """

    _patch_retrieval_to_fail(monkeypatch)
    _patch_generation_to_fail(monkeypatch)

    result = _run_pipeline(
        query="Hi",
        conversation_messages=_successful_rag_history(),
        request_id="req-greet",
    )

    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert result["fallback_used"] is False
    assert str(result["intent_profile"]).startswith("static:")


def test_pipeline_assistant_help_after_document_history_does_not_call_retrieval(
    monkeypatch: Any,
) -> None:
    """
    Assistant-help queries must not inherit previous document context.
    """

    _patch_retrieval_to_fail(monkeypatch)
    _patch_generation_to_fail(monkeypatch)

    result = _run_pipeline(
        query="How can you help me?",
        conversation_messages=_successful_rag_history(),
        request_id="req-help",
    )

    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert result["fallback_used"] is False
    assert str(result["intent_profile"]) == "app_help:assistant_help"


def test_pipeline_general_question_after_document_history_does_not_call_retrieval(
    monkeypatch: Any,
) -> None:
    """
    General questions must not become document follow-ups after RAG history.
    """

    _patch_retrieval_to_fail(monkeypatch)

    async def fake_generate_answer(**kwargs: Any) -> str:
        assert kwargs["mode"] == "general"
        return "Machine learning is a way for computers to learn patterns from data."

    monkeypatch.setattr(
        "services.chat_generation_service.ChatGenerationService.generate_answer",
        fake_generate_answer,
    )

    result = _run_pipeline(
        query="What is machine learning?",
        conversation_messages=_successful_rag_history(),
        request_id="req-general",
    )

    assert result["answer"] == (
        "Machine learning is a way for computers to learn patterns from data."
    )
    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert result["fallback_used"] is False
    assert result["intent_profile"] == "general:general_question"


def test_pipeline_app_navigation_help_does_not_call_retrieval(
    monkeypatch: Any,
) -> None:
    """
    App-navigation help should be deterministic and non-RAG.
    """

    _patch_retrieval_to_fail(monkeypatch)
    _patch_generation_to_fail(monkeypatch)

    result = _run_pipeline(
        query="Where can I see my fines?",
        conversation_messages=_successful_rag_history(),
        request_id="req-app-help",
    )

    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert result["fallback_used"] is False
    assert result["intent_profile"] == "app_help:app_navigation_help"
    assert "Fines" in str(result["answer"])


def test_pipeline_vague_or_damaged_input_stays_non_rag(monkeypatch: Any) -> None:
    """
    Damaged input should be caught by the query-quality gate before retrieval.
    """

    _patch_retrieval_to_fail(monkeypatch)
    _patch_generation_to_fail(monkeypatch)

    result = _run_pipeline(
        query="What are tou/",
        conversation_messages=_successful_rag_history(),
        request_id="req-clarify",
    )

    assert result["answer"] == GENERAL_FALLBACK_ANSWER
    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert result["fallback_used"] is True
    assert str(result["intent_profile"]).startswith("clarification:")


def test_pipeline_document_query_runs_rag(monkeypatch: Any) -> None:
    """
    Direct document-policy questions should run retrieval and grounded generation.
    """

    async def fake_retrieval(**kwargs: Any) -> list[dict[str, object]]:
        assert "semester freeze policy" in kwargs["query"].lower()
        return [_fake_document_chunk()]

    async def fake_generate_answer(**kwargs: Any) -> str:
        assert kwargs["mode"] == "grounded"
        assert "Official Context" not in str(kwargs.get("context_block") or "")
        return "Students may apply for semester freeze before midterm."

    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fake_retrieval,
    )
    monkeypatch.setattr(
        "services.chat_generation_service.ChatGenerationService.generate_answer",
        fake_generate_answer,
    )

    result = _run_pipeline(
        query="What is the semester freeze policy?",
        conversation_messages=[],
        request_id="req-rag",
    )

    assert result["answer"] == "Students may apply for semester freeze before midterm."
    assert result["retrieved_chunks_count"] == 1
    assert len(result["citations"]) == 1
    assert result["fallback_used"] is False
    assert str(result["intent_profile"]).startswith("rag:")


def test_pipeline_document_followup_uses_history_after_successful_rag(
    monkeypatch: Any,
) -> None:
    """
    Valid document follow-up should use prior successful cited RAG context.
    """

    async def fake_retrieval(**kwargs: Any) -> list[dict[str, object]]:
        retrieval_query = str(kwargs["query"]).lower()

        assert "semester freeze policy" in retrieval_query
        assert "what documents are required for it" in retrieval_query

        return [
            _fake_document_chunk(
                chunk_id="660e8400-e29b-41d4-a716-446655440001",
                chunk_index=4,
                section_label="Required Documents",
                content="Required documents for semester freeze are listed in the policy.",
            )
        ]

    async def fake_generate_answer(**kwargs: Any) -> str:
        assert kwargs["mode"] == "grounded"
        assert "Policy answer." in str(kwargs.get("conversation_history_block") or "")
        return "Required documents are listed in the policy document."

    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fake_retrieval,
    )
    monkeypatch.setattr(
        "services.chat_generation_service.ChatGenerationService.generate_answer",
        fake_generate_answer,
    )

    result = _run_pipeline(
        query="What documents are required for it?",
        conversation_messages=_successful_rag_history(),
        request_id="req-followup",
    )

    assert result["answer"] == "Required documents are listed in the policy document."
    assert result["retrieved_chunks_count"] == 1
    assert len(result["citations"]) == 1
    assert result["fallback_used"] is False
    assert str(result["intent_profile"]).startswith("rag:")


def test_pipeline_document_followup_after_rag_fallback_does_not_call_retrieval(
    monkeypatch: Any,
) -> None:
    """
    Follow-up after failed/fallback RAG must ask for clarification, not retrieve.
    """

    _patch_retrieval_to_fail(monkeypatch)
    _patch_generation_to_fail(monkeypatch)

    result = _run_pipeline(
        query="What documents are required for it?",
        conversation_messages=_rag_fallback_history(),
        request_id="req-followup-fallback",
    )

    assert result["answer"] == GENERAL_FALLBACK_ANSWER
    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert result["fallback_used"] is True
    assert str(result["intent_profile"]).startswith("clarification:")


def test_pipeline_document_followup_without_metadata_does_not_call_retrieval(
    monkeypatch: Any,
) -> None:
    """
    Plain assistant text without RAG metadata must not approve follow-up context.
    """

    _patch_retrieval_to_fail(monkeypatch)
    _patch_generation_to_fail(monkeypatch)

    result = _run_pipeline(
        query="What documents are required for it?",
        conversation_messages=[
            {"role": "user", "content": "What is the semester freeze policy?"},
            {"role": "assistant", "content": "Policy answer."},
        ],
        request_id="req-followup-no-metadata",
    )

    assert result["answer"] == GENERAL_FALLBACK_ANSWER
    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert result["fallback_used"] is True
    assert str(result["intent_profile"]).startswith("clarification:")


def test_pipeline_rag_with_no_chunks_returns_strict_document_fallback(
    monkeypatch: Any,
) -> None:
    """
    RAG with no retrieved chunks should return the strict document fallback.
    """

    async def fake_retrieval(**kwargs: Any) -> list[dict[str, object]]:
        return []

    _patch_generation_to_fail(monkeypatch)
    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fake_retrieval,
    )

    result = _run_pipeline(
        query="What is the semester freeze policy?",
        conversation_messages=[],
        request_id="req-rag-empty",
    )

    assert result["answer"] == FALLBACK_ANSWER
    assert result["fallback_used"] is True
    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert str(result["intent_profile"]).startswith("rag:")