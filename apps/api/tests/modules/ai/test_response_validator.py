from modules.ai.models import AssistantTask
from modules.ai.response_validator import validate_assistant_response


def _base_task(execution_mode: str) -> AssistantTask:
    return AssistantTask(
        query="test",
        intent="general_question",
        execution_mode=execution_mode,  # type: ignore[arg-type]
        retrieval_query=None,
        generation_query="test",
        retrieval_profile=None,
        history_block=None,
        fallback_policy="none",
        requires_citations=False,
        requires_official_sources=False,
        intent_profile="general:general_question",
    )


def test_validator_removes_citations_for_non_rag_modes() -> None:
    task = _base_task("general_generation")
    validated = validate_assistant_response(
        task,
        {
            "answer": "General answer",
            "fallback_used": False,
            "retrieved_chunks_count": 4,
            "citations": [{"rank": 1, "similarity_score": 0.99}],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["citations"] == []
    assert validated["retrieved_chunks_count"] == 0
    assert validated["applied_top_k"] == 0


def test_validator_forces_rag_fallback_when_citations_missing() -> None:
    task = AssistantTask(
        query="What is semester freeze policy?",
        intent="document_question",
        execution_mode="rag_generation",
        retrieval_query="What is semester freeze policy?",
        generation_query="What is semester freeze policy?",
        retrieval_profile=None,
        history_block=None,
        fallback_policy="strict_document_fallback",
        requires_citations=True,
        requires_official_sources=True,
        intent_profile="rag:policy_lookup",
    )

    validated = validate_assistant_response(
        task,
        {
            "answer": "Generated answer without citations",
            "fallback_used": False,
            "retrieved_chunks_count": 2,
            "citations": [],
            "applied_top_k": 4,
            "applied_similarity_threshold": 0.65,
        },
    )

    assert validated["answer"] == "Information not found in official documents."
    assert validated["fallback_used"] is True
    assert validated["citations"] == []
