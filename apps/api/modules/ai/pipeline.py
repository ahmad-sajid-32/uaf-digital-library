"""
Assistant pipeline orchestrator.

Purpose:
- Run normalized intent-routing, history selection, task planning, execution,
  and response validation as separate layers.
"""

from typing import Any, Optional

from core.logging import get_logger
from modules.ai.history_selector import select_relevant_history
from modules.ai.intent_detector import detect_assistant_intent
from modules.ai.models import AssistantTask
from modules.ai.response_validator import validate_assistant_response
from modules.ai.task_planner import build_assistant_task
from modules.ai.executor import execute_assistant_task
from services.retrieval_service import RetrievalService

logger = get_logger(__name__)


def _build_log_fields(
    *,
    request_id: Optional[str],
    user_id: str,
    query: str,
    task: AssistantTask,
    retrieved_chunks_count: int,
    history_used: bool,
    routing_reason: str,
    history_reason: str,
) -> dict[str, Any]:
    return {
        "request_id": request_id,
        "user_id": user_id,
        "query_length": len(query),
        "intent": task.intent,
        "execution_mode": task.execution_mode,
        "intent_profile": task.intent_profile,
        "history_used": history_used,
        "routing_reason": routing_reason,
        "history_reason": history_reason,
        "retrieved_chunks_count": retrieved_chunks_count,
        "applied_top_k": task.retrieval_profile.top_k if task.retrieval_profile else 0,
        "applied_similarity_threshold": (
            task.retrieval_profile.similarity_threshold if task.retrieval_profile else 0.0
        ),
    }


async def run_assistant_pipeline(
    *,
    user_id: str,
    request_id: Optional[str],
    query: str,
    conversation_messages: list[dict[str, Any]],
) -> dict[str, Any]:
    normalized_query = RetrievalService.normalize_assistant_query(query)
    routing_decision = detect_assistant_intent(normalized_query)
    history_decision = select_relevant_history(
        query=normalized_query,
        conversation_messages=conversation_messages,
        current_intent=routing_decision.intent,
    )
    task = build_assistant_task(
        query=normalized_query,
        routing_decision=routing_decision,
        history_decision=history_decision,
    )
    execution_result = await execute_assistant_task(
        user_id=user_id,
        request_id=request_id,
        task=task,
    )
    validated_result = validate_assistant_response(task, execution_result)

    logger.info(
        "AI: assistant pipeline completed",
        extra=_build_log_fields(
            request_id=request_id,
            user_id=user_id,
            query=normalized_query,
            task=task,
            retrieved_chunks_count=int(validated_result["retrieved_chunks_count"]),
            history_used=history_decision.use_history,
            routing_reason=routing_decision.reason,
            history_reason=history_decision.reason,
        ),
    )

    return {
        "query": normalized_query,
        "answer": validated_result["answer"],
        "fallback_used": validated_result["fallback_used"],
        "retrieved_chunks_count": validated_result["retrieved_chunks_count"],
        "citations": validated_result["citations"],
        "intent_profile": task.intent_profile,
        "applied_top_k": validated_result["applied_top_k"],
        "applied_similarity_threshold": validated_result["applied_similarity_threshold"],
    }
