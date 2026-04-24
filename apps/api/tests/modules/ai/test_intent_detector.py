# apps/api/tests/modules/ai/test_intent_detector.py
"""
Tests for deterministic assistant intent detection.

Purpose:
- Prove current-turn intent detection works without conversation history.
- Prevent broad follow-up rules from misclassifying normal general questions.
- Prevent weak document words from incorrectly triggering RAG.
- Confirm official-document questions still route to RAG.

Integration notes:
- These tests must not call retrieval, database, embeddings, or the LLM.
- Query-quality gate behavior is tested separately; this file tests the
  intent detector directly.
"""

import pytest

from modules.ai.intent_detector import detect_assistant_intent


@pytest.mark.parametrize(
    ("query", "intent", "mode"),
    [
        ("Hi", "greeting", "static_response"),
        ("Hello", "greeting", "static_response"),
        ("Thanks", "greeting", "static_response"),
        ("How can you help me?", "assistant_help", "app_help_response"),
        ("What can you do?", "assistant_help", "app_help_response"),
        ("Where can I see my fines?", "app_navigation_help", "app_help_response"),
        ("Show my borrowed books", "app_navigation_help", "app_help_response"),
        ("How do I use the catalog?", "app_navigation_help", "app_help_response"),
        ("Where is my result?", "app_navigation_help", "app_help_response"),
        ("How do I borrow a book?", "library_task_help", "app_help_response"),
        ("How does waiting list work?", "library_task_help", "app_help_response"),
        ("What is the semester freeze policy?", "document_question", "rag_generation"),
        ("What is the fee structure?", "document_question", "rag_generation"),
        ("What is the admission eligibility?", "document_question", "rag_generation"),
        ("What is the attendance rule?", "document_question", "rag_generation"),
        ("What is machine learning?", "general_question", "general_generation"),
        ("What is AI?", "general_question", "general_generation"),
        ("Explain database normalization", "general_question", "general_generation"),
        ("How do I write a document?", "general_question", "general_generation"),
        ("What is a semester?", "general_question", "general_generation"),
        ("How do I make a payment online?", "general_question", "general_generation"),
        ("it?", "document_follow_up_candidate", "clarification_response"),
        ("What about that?", "document_follow_up_candidate", "clarification_response"),
        ("How about this?", "document_follow_up_candidate", "clarification_response"),
        (
            "What documents are required for it?",
            "document_follow_up_candidate",
            "clarification_response",
        ),
        ("What are tou/", "clarification_needed", "clarification_response"),
    ],
)
def test_detect_assistant_intent(query: str, intent: str, mode: str) -> None:
    """
    Detect the expected current-turn intent and execution mode.

    Args:
        query (str): Current user query.
        intent (str): Expected assistant intent.
        mode (str): Expected execution mode.
    """

    decision = detect_assistant_intent(query)

    assert decision.intent == intent
    assert decision.execution_mode == mode


@pytest.mark.parametrize(
    "query",
    [
        "What is machine learning?",
        "What is AI?",
        "What is artificial intelligence?",
        "How does Python work?",
        "Where is the moon?",
    ],
)
def test_complete_general_questions_are_not_follow_up_candidates(query: str) -> None:
    """
    Ensure normal complete questions do not become follow-up candidates.

    Args:
        query (str): Complete general question.
    """

    decision = detect_assistant_intent(query)

    assert decision.intent == "general_question"
    assert decision.execution_mode == "general_generation"


@pytest.mark.parametrize(
    "query",
    [
        "How do I write a document?",
        "What is a semester?",
        "How do I make a payment online?",
        "What is an application form?",
    ],
)
def test_weak_document_terms_do_not_trigger_rag_without_official_context(
    query: str,
) -> None:
    """
    Ensure weak document-related words do not trigger official-document RAG.

    Args:
        query (str): Query containing weak document-like wording.
    """

    decision = detect_assistant_intent(query)

    assert decision.intent == "general_question"
    assert decision.execution_mode == "general_generation"
    assert decision.requires_citations is False
    assert decision.requires_official_sources is False


@pytest.mark.parametrize(
    "query",
    [
        "What is the semester freeze policy?",
        "Explain the university attendance rule",
        "What is the UAF fee structure?",
        "What is the withdrawal policy?",
        "Show the official notice about admission eligibility",
    ],
)
def test_official_document_questions_trigger_rag(query: str) -> None:
    """
    Ensure official policy/document questions still route to RAG.

    Args:
        query (str): Official-document-style query.
    """

    decision = detect_assistant_intent(query)

    assert decision.intent == "document_question"
    assert decision.execution_mode == "rag_generation"
    assert decision.requires_citations is True
    assert decision.requires_official_sources is True
    assert decision.retrieval_query == query


@pytest.mark.parametrize(
    "query",
    [
        "What about that?",
        "How about this?",
        "What documents are required for it?",
        "Also explain that",
        "And what about those?",
    ],
)
def test_reference_style_questions_are_follow_up_candidates(query: str) -> None:
    """
    Ensure explicit reference-style turns are marked for history approval.

    Args:
        query (str): Reference-style follow-up candidate.
    """

    decision = detect_assistant_intent(query)

    assert decision.intent == "document_follow_up_candidate"
    assert decision.execution_mode == "clarification_response"