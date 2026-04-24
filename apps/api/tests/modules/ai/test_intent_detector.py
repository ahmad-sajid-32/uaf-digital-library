import pytest

from modules.ai.intent_detector import detect_assistant_intent


@pytest.mark.parametrize(
    ("query", "intent", "mode"),
    [
        ("Hi", "greeting", "static_response"),
        ("How can you help me?", "assistant_help", "app_help_response"),
        ("Where can I see my fines?", "app_navigation_help", "app_help_response"),
        ("What is the semester freeze policy?", "document_question", "rag_generation"),
        ("What is machine learning?", "general_question", "general_generation"),
        ("it?", "document_follow_up_candidate", "clarification_response"),
        (
            "What documents are required for it?",
            "document_follow_up_candidate",
            "clarification_response",
        ),
    ],
)
def test_detect_assistant_intent(query: str, intent: str, mode: str) -> None:
    decision = detect_assistant_intent(query)
    assert decision.intent == intent
    assert decision.execution_mode == mode
