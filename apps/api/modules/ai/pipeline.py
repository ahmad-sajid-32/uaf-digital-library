# apps/api/modules/ai/pipeline.py
"""
Assistant pipeline orchestrator.

Purpose:
- Run query quality screening, current-turn intent routing, history selection,
  task planning, execution, and response validation as separate layers.
- Preserve the existing generated-turn shape consumed by AssistantService.
- Keep full user query text out of structured logs.

Integration notes:
- Query quality runs before intent detection.
- Intent detection must classify only the current query.
- History selection may approve context only after intent detection.
- Public `/api/ai/*` request and response contracts remain unchanged.
"""

from typing import Any, Optional

from core.logging import get_logger
from modules.ai.executor import execute_assistant_task
from modules.ai.history_selector import select_relevant_history
from modules.ai.intent_detector import detect_assistant_intent
from modules.ai.models import AssistantRoutingDecision, AssistantTask
from modules.ai.query_quality import assess_query_quality
from modules.ai.response_validator import validate_assistant_response
from modules.ai.task_planner import build_assistant_task

logger = get_logger(__name__)


def _safe_int(value: object, *, default: int = 0) -> int:
    """
    Convert a value to a non-negative integer for logging.

    Args:
        value (object): Raw value.
        default (int): Fallback value when conversion fails.

    Returns:
        int: Non-negative integer.
    """

    try:
        numeric = int(value)
    except (TypeError, ValueError):
        numeric = default

    return max(0, numeric)


def _safe_bool(value: object) -> bool:
    """
    Convert a value to bool for structured logging.

    Args:
        value (object): Raw value.

    Returns:
        bool: Boolean value.
    """

    return bool(value)


def _build_clarification_routing_decision(
    *,
    normalized_query: str,
    reason: str,
) -> AssistantRoutingDecision:
    """
    Build routing decision for query-quality failures.

    Args:
        normalized_query (str): Normalized user query.
        reason (str): Query-quality failure reason.

    Returns:
        AssistantRoutingDecision: Clarification routing decision.
    """

    return AssistantRoutingDecision(
        intent="clarification_needed",
        execution_mode="clarification_response",
        confidence=1.0,
        reason=f"Query quality gate: {reason}",
        use_history=False,
        history_window=0,
        standalone_query=normalized_query,
        retrieval_query=None,
        requires_citations=False,
        requires_official_sources=False,
    )


def _build_log_fields(
    *,
    request_id: Optional[str],
    user_id: str,
    query: str,
    task: AssistantTask,
    retrieved_chunks_count: int,
    fallback_used: bool,
    history_used: bool,
    quality_reason: str,
    routing_reason: str,
    routing_confidence: float,
    history_reason: str,
) -> dict[str, Any]:
    """
    Build safe structured logging fields for one assistant turn.

    Args:
        request_id (Optional[str]): Request ID from middleware.
        user_id (str): Authenticated user ID.
        query (str): Normalized user query. Only length is logged.
        task (AssistantTask): Final assistant task.
        retrieved_chunks_count (int): Final retrieved chunk count.
        fallback_used (bool): Whether fallback behavior was used.
        history_used (bool): Whether history was used.
        quality_reason (str): Query-quality decision reason.
        routing_reason (str): Intent routing reason.
        routing_confidence (float): Routing confidence score.
        history_reason (str): History selector reason.

    Returns:
        dict[str, Any]: Structured log fields without full query text.
    """

    return {
        "request_id": request_id,
        "user_id": user_id,
        "query_length": len(query),
        "intent": task.intent,
        "execution_mode": task.execution_mode,
        "intent_profile": task.intent_profile,
        "routing_confidence": max(0.0, min(1.0, routing_confidence)),
        "quality_reason": quality_reason,
        "routing_reason": routing_reason,
        "history_used": history_used,
        "history_reason": history_reason,
        "fallback_used": fallback_used,
        "retrieved_chunks_count": retrieved_chunks_count,
        "applied_top_k": task.retrieval_profile.top_k if task.retrieval_profile else 0,
        "applied_similarity_threshold": (
            task.retrieval_profile.similarity_threshold
            if task.retrieval_profile
            else 0.0
        ),
    }


async def run_assistant_pipeline(
    *,
    user_id: str,
    request_id: Optional[str],
    query: str,
    conversation_messages: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Run one assistant turn through the layered assistant pipeline.

    Args:
        user_id (str): Authenticated user ID.
        request_id (Optional[str]): Request ID from middleware.
        query (str): Raw or already-normalized user query.
        conversation_messages (list[dict[str, Any]]): Recent conversation
            messages supplied by AssistantService.

    Returns:
        dict[str, Any]: Generated-turn shape consumed by AssistantService.
    """

    quality_decision = assess_query_quality(query)
    normalized_query = quality_decision.normalized_query

    if quality_decision.needs_clarification or not quality_decision.is_valid:
        routing_decision = _build_clarification_routing_decision(
            normalized_query=normalized_query,
            reason=quality_decision.reason,
        )
    else:
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

    retrieved_chunks_count = _safe_int(validated_result.get("retrieved_chunks_count"))
    fallback_used = _safe_bool(validated_result.get("fallback_used"))

    logger.info(
        "AI: assistant pipeline completed",
        extra=_build_log_fields(
            request_id=request_id,
            user_id=user_id,
            query=normalized_query,
            task=task,
            retrieved_chunks_count=retrieved_chunks_count,
            fallback_used=fallback_used,
            history_used=history_decision.use_history,
            quality_reason=quality_decision.reason,
            routing_reason=routing_decision.reason,
            routing_confidence=routing_decision.confidence,
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