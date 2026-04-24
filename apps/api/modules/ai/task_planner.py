"""
Assistant task planner.

Purpose:
- Convert routing and history decisions into one executable task object.
"""

from modules.ai.constants import MAX_HISTORY_CHARS_PER_MESSAGE, MAX_HISTORY_MESSAGES
from modules.ai.models import (
    AssistantIntent,
    AssistantRoutingDecision,
    AssistantTask,
    ConversationContextDecision,
)
from modules.ai.retrieval_profiles import resolve_retrieval_profile


def _build_history_block(selected_messages: list[dict[str, object]]) -> str | None:
    if not selected_messages:
        return None

    blocks: list[str] = []

    for item in selected_messages[-MAX_HISTORY_MESSAGES:]:
        role = "User" if item.get("role") == "user" else "Assistant"
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        if len(content) > MAX_HISTORY_CHARS_PER_MESSAGE:
            content = content[:MAX_HISTORY_CHARS_PER_MESSAGE].rstrip() + "..."
        blocks.append(f"{role}: {content}")

    if not blocks:
        return None

    return "\n".join(blocks)


def _resolve_effective_intent(
    routing_intent: AssistantIntent,
    history_decision: ConversationContextDecision,
) -> AssistantIntent:
    if routing_intent == "document_follow_up_candidate":
        if history_decision.use_history:
            return "document_follow_up"
        return "clarification_needed"

    return routing_intent


def _build_intent_profile(
    execution_mode: str,
    intent: AssistantIntent,
    retrieval_profile_name: str | None,
) -> str:
    if execution_mode == "rag_generation":
        return f"rag:{retrieval_profile_name or 'general_university_info'}"
    if execution_mode == "general_generation":
        return f"general:{intent}"
    if execution_mode == "app_help_response":
        return f"app_help:{intent}"
    if execution_mode == "static_response":
        return f"static:{intent}"
    return f"clarification:{intent}"


def build_assistant_task(
    query: str,
    routing_decision: AssistantRoutingDecision,
    history_decision: ConversationContextDecision,
) -> AssistantTask:
    effective_intent = _resolve_effective_intent(
        routing_decision.intent,
        history_decision,
    )
    execution_mode = routing_decision.execution_mode

    if effective_intent == "document_follow_up":
        execution_mode = "rag_generation"
    elif effective_intent == "clarification_needed":
        execution_mode = "clarification_response"

    retrieval_query: str | None = None
    retrieval_profile = None
    requires_citations = False
    requires_official_sources = False
    fallback_policy = "none"

    if execution_mode == "rag_generation":
        retrieval_query = (
            history_decision.standalone_query
            if history_decision.use_history
            else query
        )
        retrieval_profile = resolve_retrieval_profile(retrieval_query)
        requires_citations = True
        requires_official_sources = True
        fallback_policy = "strict_document_fallback"
    elif execution_mode == "general_generation":
        fallback_policy = "general_fallback"

    intent_profile = _build_intent_profile(
        execution_mode,
        effective_intent,
        retrieval_profile.name if retrieval_profile else None,
    )
    history_block = (
        _build_history_block(history_decision.selected_messages)
        if history_decision.use_history
        else None
    )

    return AssistantTask(
        query=query,
        intent=effective_intent,
        execution_mode=execution_mode,
        retrieval_query=retrieval_query,
        generation_query=query,
        retrieval_profile=retrieval_profile,
        history_block=history_block,
        fallback_policy=fallback_policy,
        requires_citations=requires_citations,
        requires_official_sources=requires_official_sources,
        intent_profile=intent_profile,
    )
