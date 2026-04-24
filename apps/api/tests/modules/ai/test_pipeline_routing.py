import asyncio

from modules.ai import pipeline as assistant_pipeline


def test_pipeline_greeting_does_not_call_retrieval(monkeypatch) -> None:
    async def fail_retrieval(**kwargs):
        raise AssertionError("retrieval should not run for greeting")

    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fail_retrieval,
    )

    result = asyncio.run(
        assistant_pipeline.run_assistant_pipeline(
            user_id="00000000-0000-0000-0000-000000000001",
            request_id="req-greet",
            query="Hi",
            conversation_messages=[
                {"role": "user", "content": "What is semester freeze policy?"},
                {"role": "assistant", "content": "Policy answer"},
            ],
        )
    )

    assert result["retrieved_chunks_count"] == 0
    assert result["citations"] == []
    assert str(result["intent_profile"]).startswith("static:")


def test_pipeline_document_query_runs_rag(monkeypatch) -> None:
    async def fake_retrieval(**kwargs):
        return [
            {
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "document_title": "Semester Rules 2026",
                "original_filename": "semester-rules.pdf",
                "chunk_id": "660e8400-e29b-41d4-a716-446655440000",
                "chunk_index": 3,
                "section_label": "Semester Freeze Policy",
                "page_number": 7,
                "similarity_score": 0.84,
                "content_hash": "abc",
                "content": "Students may apply for semester freeze before midterm.",
            }
        ]

    async def fake_generate_answer(**kwargs):
        assert kwargs["mode"] == "grounded"
        return "Students may apply for semester freeze before midterm."

    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fake_retrieval,
    )
    monkeypatch.setattr(
        "services.chat_generation_service.ChatGenerationService.generate_answer",
        fake_generate_answer,
    )

    result = asyncio.run(
        assistant_pipeline.run_assistant_pipeline(
            user_id="00000000-0000-0000-0000-000000000001",
            request_id="req-rag",
            query="What is the semester freeze policy?",
            conversation_messages=[],
        )
    )

    assert result["retrieved_chunks_count"] == 1
    assert len(result["citations"]) == 1
    assert str(result["intent_profile"]).startswith("rag:")


def test_pipeline_followup_without_context_stays_non_rag(monkeypatch) -> None:
    async def fail_retrieval(**kwargs):
        raise AssertionError("retrieval should not run for unclear follow-up")

    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fail_retrieval,
    )

    result = asyncio.run(
        assistant_pipeline.run_assistant_pipeline(
            user_id="00000000-0000-0000-0000-000000000001",
            request_id="req-clarify",
            query="What are tou/",
            conversation_messages=[
                {"role": "user", "content": "What is the semester freeze policy?"},
                {"role": "assistant", "content": "Policy answer"},
                {"role": "user", "content": "Hi"},
            ],
        )
    )

    assert result["retrieved_chunks_count"] == 0
    assert str(result["intent_profile"]).startswith("clarification:")


def test_pipeline_document_followup_uses_history_when_relevant(monkeypatch) -> None:
    async def fake_retrieval(**kwargs):
        assert "semester freeze policy" in kwargs["query"].lower()
        return [
            {
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "document_title": "Semester Rules 2026",
                "original_filename": "semester-rules.pdf",
                "chunk_id": "660e8400-e29b-41d4-a716-446655440000",
                "chunk_index": 4,
                "section_label": "Required Documents",
                "page_number": 8,
                "similarity_score": 0.8,
                "content_hash": "def",
                "content": "Required documents for semester freeze include ...",
            }
        ]

    async def fake_generate_answer(**kwargs):
        assert kwargs["mode"] == "grounded"
        return "Required documents are listed in the policy document."

    monkeypatch.setattr(
        "services.retrieval_service.RetrievalService.search_university_document_chunks",
        fake_retrieval,
    )
    monkeypatch.setattr(
        "services.chat_generation_service.ChatGenerationService.generate_answer",
        fake_generate_answer,
    )

    result = asyncio.run(
        assistant_pipeline.run_assistant_pipeline(
            user_id="00000000-0000-0000-0000-000000000001",
            request_id="req-followup",
            query="What documents are required for it?",
            conversation_messages=[
                {"role": "user", "content": "What is the semester freeze policy?"},
                {"role": "assistant", "content": "Policy answer"},
            ],
        )
    )

    assert result["retrieved_chunks_count"] == 1
    assert str(result["intent_profile"]).startswith("rag:")
