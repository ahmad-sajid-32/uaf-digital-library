from modules.ai.history_selector import select_relevant_history


def test_history_ignored_for_greeting_even_after_document_turn() -> None:
    messages = [
        {"role": "user", "content": "What is the semester freeze policy?"},
        {"role": "assistant", "content": "Policy answer."},
    ]

    decision = select_relevant_history(
        query="Hi",
        conversation_messages=messages,
        current_intent="greeting",
    )

    assert decision.use_history is False
    assert decision.selected_messages == []
    assert decision.standalone_query == "Hi"


def test_history_used_for_document_follow_up_candidate() -> None:
    messages = [
        {"role": "user", "content": "What is the semester freeze policy?"},
        {"role": "assistant", "content": "Policy answer."},
    ]

    decision = select_relevant_history(
        query="What documents are required for it?",
        conversation_messages=messages,
        current_intent="document_follow_up_candidate",
    )

    assert decision.use_history is True
    assert len(decision.selected_messages) == 2
    assert "semester freeze policy" in decision.standalone_query.lower()
