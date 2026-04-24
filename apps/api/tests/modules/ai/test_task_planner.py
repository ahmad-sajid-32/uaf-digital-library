from modules.ai.models import AssistantRoutingDecision, ConversationContextDecision
from modules.ai.task_planner import build_assistant_task


def test_task_planner_maps_document_follow_up_candidate_with_history_to_rag() -> None:
    routing = AssistantRoutingDecision(
        intent="document_follow_up_candidate",
        execution_mode="clarification_response",
        confidence=0.6,
        reason="follow-up candidate",
        use_history=False,
        history_window=0,
        standalone_query="What documents are required for it?",
        retrieval_query=None,
        requires_citations=False,
        requires_official_sources=False,
    )
    history = ConversationContextDecision(
        use_history=True,
        selected_messages=[
            {"role": "user", "content": "What is the semester freeze policy?"},
            {"role": "assistant", "content": "Policy answer."},
        ],
        reason="topic match",
        standalone_query="What is the semester freeze policy? What documents are required for it?",
    )

    task = build_assistant_task(
        query="What documents are required for it?",
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "document_follow_up"
    assert task.execution_mode == "rag_generation"
    assert task.retrieval_query is not None
    assert task.requires_citations is True
    assert task.retrieval_profile is not None


def test_task_planner_maps_follow_up_without_history_to_clarification() -> None:
    routing = AssistantRoutingDecision(
        intent="document_follow_up_candidate",
        execution_mode="clarification_response",
        confidence=0.6,
        reason="follow-up candidate",
        use_history=False,
        history_window=0,
        standalone_query="what are tou/",
        retrieval_query=None,
        requires_citations=False,
        requires_official_sources=False,
    )
    history = ConversationContextDecision(
        use_history=False,
        selected_messages=[],
        reason="no relevant context",
        standalone_query="what are tou/",
    )

    task = build_assistant_task(
        query="what are tou/",
        routing_decision=routing,
        history_decision=history,
    )

    assert task.intent == "clarification_needed"
    assert task.execution_mode == "clarification_response"
    assert task.retrieval_query is None
