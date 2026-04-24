# apps/api/tests/modules/ai/test_task_planner.py
"""
Tests for assistant task planning.

Purpose:
- Prove routing decisions and history decisions are converted into the correct
  executable assistant tasks.
- Verify direct document, document follow-up, general, app-help, static, and
  clarification task shapes.
- Keep task-planner behavior contract-safe before executor and pipeline tests.

Integration notes:
- These tests do not call retrieval, database, embeddings, or the LLM.
- Retrieval profiles are resolved in memory from query text and settings only.
"""

from modules.ai.models import AssistantRoutingDecision, ConversationContextDecision
from modules.ai.task_planner import build_assistant_task


def _routing_decision(
    *,
    intent: str,
    execution_mode: str,
    query: str,
    retrieval_query: str | None = None,
    requires_citations: bool = False,
    requires_official_sources: bool = False,
) -> AssistantRoutingDecision:
    """
    Build a routing decision for task-planner tests.

    Args:
        intent (str): Assistant intent.
        execution_mode (str): Initial execution mode.
        query (str): Current query.
        retrieval_query (str | None): Optional retrieval query.
        requires_citations (bool): Whether citations are required.
        requires_official_sources (bool): Whether official sources are required.

    Returns:
        AssistantRoutingDecision: Test routing decision.
    """

    return AssistantRoutingDecision(
        intent=intent,  # type: ignore[arg-type]
        execution_mode=execution_mode,  # type: ignore[arg-type]
        confidence=0.9,
        reason="test routing decision",
        use_history=False,
        history_window=0,
        standalone_query=query,
        retrieval_query=retrieval_query,
        requires_citations=requires_citations,
        requires_official_sources=requires_official_sources,
    )


def _history_decision(
    *,
    use_history: bool = False,
    selected_messages: list[dict[str, object]] | None = None,
    standalone_query: str,
    reason: str = "test history decision",
) -> ConversationContextDecision:
    """
    Build a history decision for task-planner tests.

    Args:
        use_history (bool): Whether history is approved.
        selected_messages (list[dict[str, object]] | None): Selected messages.
        standalone_query (str): Standalone query from history selector.
        reason (str): Decision reason.

    Returns:
        ConversationContextDecision: Test history decision.
    """

    return ConversationContextDecision(
        use_history=use_history,
        selected_messages=selected_messages or [],
        reason=reason,
        standalone_query=standalone_query,
    )


def test_task_planner_maps_direct_document_question_to_rag() -> None:
    """
    Direct official-document questions should become RAG tasks.
    """

    query = "What is the semester freeze policy?"
    routing = _routing_decision(
        intent="document_question",
        execution_mode="rag_generation",
        query=query,
        retrieval_query=query,
        requires_citations=True,
        requires_official_sources=True,
    )
    history = _history_decision(standalone_query=query)

    task = build_assistant_task(
        query=query,
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "document_question"
    assert task.execution_mode == "rag_generation"
    assert task.retrieval_query == query
    assert task.generation_query == query
    assert task.retrieval_profile is not None
    assert task.retrieval_profile.name == "policy_lookup"
    assert task.history_block is None
    assert task.fallback_policy == "strict_document_fallback"
    assert task.requires_citations is True
    assert task.requires_official_sources is True
    assert task.intent_profile == "rag:policy_lookup"


def test_task_planner_maps_document_follow_up_candidate_with_history_to_rag() -> None:
    """
    Approved document follow-up candidates should become RAG tasks.
    """

    query = "What documents are required for it?"
    standalone_query = (
        "What is the semester freeze policy? What documents are required for it?"
    )
    routing = _routing_decision(
        intent="document_follow_up_candidate",
        execution_mode="clarification_response",
        query=query,
    )
    history = _history_decision(
        use_history=True,
        selected_messages=[
            {"role": "user", "content": "What is the semester freeze policy?"},
            {"role": "assistant", "content": "Policy answer."},
        ],
        reason="successful RAG context matched",
        standalone_query=standalone_query,
    )

    task = build_assistant_task(
        query=query,
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "document_follow_up"
    assert task.execution_mode == "rag_generation"
    assert task.retrieval_query == standalone_query
    assert task.generation_query == query
    assert task.retrieval_profile is not None
    assert task.retrieval_profile.name == "policy_lookup"
    assert task.history_block is not None
    assert "User: What is the semester freeze policy?" in task.history_block
    assert "Assistant: Policy answer." in task.history_block
    assert task.fallback_policy == "strict_document_fallback"
    assert task.requires_citations is True
    assert task.requires_official_sources is True
    assert task.intent_profile == "rag:policy_lookup"


def test_task_planner_maps_follow_up_without_history_to_clarification() -> None:
    """
    Rejected follow-up candidates should become clarification tasks.
    """

    query = "What documents are required for it?"
    routing = _routing_decision(
        intent="document_follow_up_candidate",
        execution_mode="clarification_response",
        query=query,
    )
    history = _history_decision(
        use_history=False,
        selected_messages=[],
        reason="no relevant context",
        standalone_query=query,
    )

    task = build_assistant_task(
        query=query,
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "clarification_needed"
    assert task.execution_mode == "clarification_response"
    assert task.retrieval_query is None
    assert task.retrieval_profile is None
    assert task.history_block is None
    assert task.fallback_policy == "none"
    assert task.requires_citations is False
    assert task.requires_official_sources is False
    assert task.intent_profile == "clarification:clarification_needed"


def test_task_planner_maps_general_question_to_general_generation() -> None:
    """
    General questions should become general-generation tasks without retrieval.
    """

    query = "What is machine learning?"
    routing = _routing_decision(
        intent="general_question",
        execution_mode="general_generation",
        query=query,
    )
    history = _history_decision(standalone_query=query)

    task = build_assistant_task(
        query=query,
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "general_question"
    assert task.execution_mode == "general_generation"
    assert task.retrieval_query is None
    assert task.retrieval_profile is None
    assert task.history_block is None
    assert task.fallback_policy == "general_fallback"
    assert task.requires_citations is False
    assert task.requires_official_sources is False
    assert task.intent_profile == "general:general_question"


def test_task_planner_maps_app_navigation_help_to_app_help_response() -> None:
    """
    App navigation questions should become app-help tasks without retrieval.
    """

    query = "Where can I see my fines?"
    routing = _routing_decision(
        intent="app_navigation_help",
        execution_mode="app_help_response",
        query=query,
    )
    history = _history_decision(standalone_query=query)

    task = build_assistant_task(
        query=query,
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "app_navigation_help"
    assert task.execution_mode == "app_help_response"
    assert task.retrieval_query is None
    assert task.retrieval_profile is None
    assert task.history_block is None
    assert task.fallback_policy == "none"
    assert task.requires_citations is False
    assert task.requires_official_sources is False
    assert task.intent_profile == "app_help:app_navigation_help"


def test_task_planner_maps_greeting_to_static_response() -> None:
    """
    Greetings should become static-response tasks without retrieval.
    """

    query = "Hi"
    routing = _routing_decision(
        intent="greeting",
        execution_mode="static_response",
        query=query,
    )
    history = _history_decision(standalone_query=query)

    task = build_assistant_task(
        query=query,
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "greeting"
    assert task.execution_mode == "static_response"
    assert task.retrieval_query is None
    assert task.retrieval_profile is None
    assert task.history_block is None
    assert task.fallback_policy == "none"
    assert task.requires_citations is False
    assert task.requires_official_sources is False
    assert task.intent_profile == "static:greeting"