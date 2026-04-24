# apps/api/modules/ai/task_planner.py
"""
Assistant task planner.

Purpose:
- Convert routing and history decisions into one executable assistant task.
- Keep retrieval, generation, fallback, and citation requirements explicit.
- Preserve the existing generated-turn contract consumed by AssistantService.

Integration notes:
- Intent detection happens before this file.
- History approval happens before this file.
- This planner does not execute retrieval or generation.
- This planner does not change the public `/api/ai/*` contract.
"""

from modules.ai.constants import MAX_HISTORY_CHARS_PER_MESSAGE, MAX_HISTORY_MESSAGES
from modules.ai.models import (
    AssistantExecutionMode,
    AssistantFallbackPolicy,
    AssistantIntent,
    AssistantRoutingDecision,
    AssistantTask,
    ConversationContextDecision,
)
from modules.ai.retrieval_profiles import resolve_retrieval_profile


def _build_history_block(selected_messages: list[dict[str, object]]) -> str | None:
    """
    Build a compact conversation-history block for generation.

    The history block is only built when the history selector has already
    approved history use. It must stay compact so unrelated conversation text
    does not dominate the answer prompt.

    Args:
        selected_messages (list[dict[str, object]]): Messages selected by the
            history selector.

    Returns:
        str | None: Prompt-ready history block, or None when no useful history
        is available.
    """

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
    """
    Resolve the final intent after history selection.

    Follow-up candidates are not automatically approved. They become real
    document follow-ups only when the history selector confirms a successful
    prior RAG answer with citations.

    Args:
        routing_intent (AssistantIntent): Intent from current-turn detection.
        history_decision (ConversationContextDecision): History selection result.

    Returns:
        AssistantIntent: Final effective intent for task execution.
    """

    if routing_intent == "document_follow_up_candidate":
        if history_decision.use_history:
            return "document_follow_up"

        return "clarification_needed"

    return routing_intent


def _resolve_execution_mode(
    *,
    routing_execution_mode: AssistantExecutionMode,
    effective_intent: AssistantIntent,
) -> AssistantExecutionMode:
    """
    Resolve the final execution mode for an assistant task.

    Args:
        routing_execution_mode (AssistantExecutionMode): Initial execution mode
            from the intent detector.
        effective_intent (AssistantIntent): Final intent after history selection.

    Returns:
        AssistantExecutionMode: Final mode used by the executor.
    """

    if effective_intent == "document_follow_up":
        return "rag_generation"

    if effective_intent == "clarification_needed":
        return "clarification_response"

    return routing_execution_mode


def _build_intent_profile(
    execution_mode: AssistantExecutionMode,
    intent: AssistantIntent,
    retrieval_profile_name: str | None,
) -> str:
    """
    Build compatibility routing metadata for persisted assistant messages.

    The database currently stores `intent_profile` as text. Until a richer
    metadata schema is approved, this field encodes both mode and intent/profile.

    Args:
        execution_mode (AssistantExecutionMode): Final execution mode.
        intent (AssistantIntent): Final assistant intent.
        retrieval_profile_name (str | None): Retrieval profile name for RAG.

    Returns:
        str: Compatibility intent profile string.
    """

    if execution_mode == "rag_generation":
        return f"rag:{retrieval_profile_name or 'general_university_info'}"

    if execution_mode == "general_generation":
        return f"general:{intent}"

    if execution_mode == "app_help_response":
        return f"app_help:{intent}"

    if execution_mode == "static_response":
        return f"static:{intent}"

    return f"clarification:{intent}"


def _resolve_retrieval_query(
    *,
    query: str,
    execution_mode: AssistantExecutionMode,
    history_decision: ConversationContextDecision,
) -> str | None:
    """
    Resolve the query used for document retrieval.

    Direct document questions use the current query. Approved document follow-up
    questions use the standalone query built by the history selector.

    Args:
        query (str): Current normalized user query.
        execution_mode (AssistantExecutionMode): Final execution mode.
        history_decision (ConversationContextDecision): History selection result.

    Returns:
        str | None: Retrieval query for RAG, otherwise None.
    """

    if execution_mode != "rag_generation":
        return None

    if history_decision.use_history:
        return history_decision.standalone_query

    return query


def build_assistant_task(
    query: str,
    routing_decision: AssistantRoutingDecision,
    history_decision: ConversationContextDecision,
) -> AssistantTask:
    """
    Build an executable assistant task.

    Args:
        query (str): Current normalized user query.
        routing_decision (AssistantRoutingDecision): Current-turn routing
            decision.
        history_decision (ConversationContextDecision): History relevance
            decision.

    Returns:
        AssistantTask: Final task consumed by the executor.
    """

    effective_intent = _resolve_effective_intent(
        routing_decision.intent,
        history_decision,
    )
    execution_mode = _resolve_execution_mode(
        routing_execution_mode=routing_decision.execution_mode,
        effective_intent=effective_intent,
    )

    retrieval_query = _resolve_retrieval_query(
        query=query,
        execution_mode=execution_mode,
        history_decision=history_decision,
    )
    retrieval_profile = (
        resolve_retrieval_profile(retrieval_query)
        if retrieval_query is not None
        else None
    )

    requires_citations = execution_mode == "rag_generation"
    requires_official_sources = execution_mode == "rag_generation"

    fallback_policy: AssistantFallbackPolicy = "none"
    if execution_mode == "rag_generation":
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