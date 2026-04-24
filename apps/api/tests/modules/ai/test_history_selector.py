# apps/api/tests/modules/ai/test_history_selector.py
"""
Tests for assistant conversation-history selection.

Purpose:
- Prove history is ignored for greeting/help/general turns.
- Prove document follow-up history is approved only after a successful RAG
  assistant answer with citations.
- Prevent old document topics from contaminating unrelated current turns.

Integration notes:
- These tests use in-memory message dictionaries only.
- These tests must not call retrieval, database, embeddings, or the LLM.
"""

import pytest

from modules.ai.history_selector import select_relevant_history


def _successful_rag_messages() -> list[dict[str, object]]:
    """
    Build a minimal successful document-grounded conversation history.

    Returns:
        list[dict[str, object]]: User question followed by successful RAG
        assistant answer metadata.
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


@pytest.mark.parametrize(
    ("query", "current_intent"),
    [
        ("Hi", "greeting"),
        ("How can you help me?", "assistant_help"),
        ("What is machine learning?", "general_question"),
        ("Where can I see my fines?", "app_navigation_help"),
        ("What are tou/", "clarification_needed"),
    ],
)
def test_history_ignored_for_non_follow_up_intents_even_after_successful_rag(
    query: str,
    current_intent: str,
) -> None:
    """
    Ensure non-follow-up intents cannot inherit previous document context.

    Args:
        query (str): Current user query.
        current_intent (str): Current-turn intent detected before history
            selection.
    """

    decision = select_relevant_history(
        query=query,
        conversation_messages=_successful_rag_messages(),
        current_intent=current_intent,
    )

    assert decision.use_history is False
    assert decision.selected_messages == []
    assert decision.standalone_query == query


def test_history_used_for_document_follow_up_after_successful_rag() -> None:
    """
    Allow document follow-up only after successful cited RAG context exists.
    """

    decision = select_relevant_history(
        query="What documents are required for it?",
        conversation_messages=_successful_rag_messages(),
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is True
    assert len(decision.selected_messages) == 2
    assert decision.selected_messages[0]["role"] == "user"
    assert decision.selected_messages[1]["role"] == "assistant"
    assert "semester freeze policy" in decision.standalone_query.lower()
    assert "what documents are required for it" in decision.standalone_query.lower()


def test_history_ignored_for_document_follow_up_after_rag_fallback() -> None:
    """
    Block follow-up context when the previous RAG answer was a fallback.
    """

    messages = [
        {
            "role": "user",
            "content": "What is the semester freeze policy?",
        },
        {
            "role": "assistant",
            "content": "Information not found in official documents.",
            "intent_profile": "rag:policy_lookup",
            "fallback_used": True,
            "retrieved_chunks_count": 0,
            "has_citations": False,
        },
    ]

    decision = select_relevant_history(
        query="What documents are required for it?",
        conversation_messages=messages,
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is False
    assert decision.selected_messages == []
    assert decision.standalone_query == "What documents are required for it?"


def test_history_ignored_for_document_follow_up_without_citations() -> None:
    """
    Block document follow-up context when prior assistant answer has no citations.
    """

    messages = [
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
            "has_citations": False,
        },
    ]

    decision = select_relevant_history(
        query="What documents are required for it?",
        conversation_messages=messages,
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is False
    assert decision.selected_messages == []
    assert decision.standalone_query == "What documents are required for it?"


def test_history_ignored_for_document_follow_up_after_general_answer() -> None:
    """
    Block document follow-up context when previous answer was general, not RAG.
    """

    messages = [
        {
            "role": "user",
            "content": "What is machine learning?",
        },
        {
            "role": "assistant",
            "content": "Machine learning is a way for computers to learn from data.",
            "intent_profile": "general:general_question",
            "fallback_used": False,
            "retrieved_chunks_count": 0,
            "has_citations": False,
        },
    ]

    decision = select_relevant_history(
        query="What documents are required for it?",
        conversation_messages=messages,
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is False
    assert decision.selected_messages == []
    assert decision.standalone_query == "What documents are required for it?"


def test_history_ignored_when_follow_up_has_no_reference_marker() -> None:
    """
    Ensure complete questions are not treated as follow-ups by history selection.
    """

    decision = select_relevant_history(
        query="What is AI?",
        conversation_messages=_successful_rag_messages(),
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is False
    assert decision.selected_messages == []
    assert decision.standalone_query == "What is AI?"


def test_standalone_query_excludes_unrelated_chatter_after_successful_rag() -> None:
    """
    Ensure unrelated messages like thanks are not added to retrieval query.
    """

    messages = [
        *_successful_rag_messages(),
        {
            "role": "user",
            "content": "Thanks",
        },
    ]

    decision = select_relevant_history(
        query="What documents are required for it?",
        conversation_messages=messages,
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is True
    assert "semester freeze policy" in decision.standalone_query.lower()
    assert "what documents are required for it" in decision.standalone_query.lower()
    assert "thanks" not in decision.standalone_query.lower()


def test_history_ignored_when_no_previous_messages_exist() -> None:
    """
    Ensure empty conversation history cannot approve a follow-up.
    """

    decision = select_relevant_history(
        query="What documents are required for it?",
        conversation_messages=[],
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is False
    assert decision.selected_messages == []
    assert decision.standalone_query == "What documents are required for it?"