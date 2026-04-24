# apps/api/modules/ai/history_selector.py
"""
Conversation-history relevance selector.

Purpose:
- Decide if previous conversation messages may influence the current turn.
- Prevent unrelated previous topics from contaminating current intent handling.
- Allow document follow-up only when recent history contains a successful
  document-grounded assistant answer with citations.

Integration notes:
- `AssistantService._fetch_recent_messages(...)` must provide assistant
  metadata fields used here:
  `intent_profile`, `fallback_used`, `retrieved_chunks_count`, and
  `has_citations`.
- This module must not convert greeting/help/general turns into document turns.
"""

import re
from typing import Any, Optional

from modules.ai.constants import MAX_HISTORY_SELECTION_MESSAGES
from modules.ai.models import AssistantIntent, ConversationContextDecision

FOLLOW_UP_TERMS = {
    "above",
    "also",
    "it",
    "same",
    "that",
    "them",
    "then",
    "these",
    "this",
    "those",
}

FOLLOW_UP_PREFIXES = (
    "what about",
    "how about",
    "and ",
    "also ",
)

NEVER_USE_HISTORY_FOR: set[AssistantIntent] = {
    "greeting",
    "assistant_help",
    "general_question",
    "app_navigation_help",
    "clarification_needed",
    "unsupported",
}


def _normalize_text(value: str) -> str:
    """
    Normalize text for deterministic history checks.

    Args:
        value (str): Raw text value.

    Returns:
        str: Lowercase, whitespace-collapsed text with trailing punctuation
            removed.
    """

    return re.sub(r"\s+", " ", value or "").strip().lower().strip("?.!,")


def _looks_like_follow_up_query(query: str) -> bool:
    """
    Detect whether the current query explicitly refers to previous context.

    This intentionally does not treat every short "what/how/when/where"
    question as a follow-up. A complete question such as "What is AI?" must
    stay independent unless it contains a reference marker.

    Args:
        query (str): Current user query.

    Returns:
        bool: True when the query contains explicit follow-up wording.
    """

    normalized = _normalize_text(query)
    words = normalized.split()

    if any(word in FOLLOW_UP_TERMS for word in words):
        return True

    return any(normalized.startswith(prefix) for prefix in FOLLOW_UP_PREFIXES)


def _extract_recent_messages(
    conversation_messages: list[dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    """
    Return the newest messages while preserving chronological order.

    Args:
        conversation_messages (list[dict[str, Any]]): Chronological
            conversation messages.
        limit (int): Maximum number of messages to keep.

    Returns:
        list[dict[str, Any]]: Recent messages in chronological order.
    """

    if not conversation_messages:
        return []

    return conversation_messages[-limit:]


def _message_role(message: dict[str, Any]) -> str:
    """
    Resolve message role safely.

    Args:
        message (dict[str, Any]): Conversation message row.

    Returns:
        str: Normalized role value.
    """

    return str(message.get("role") or "").strip().lower()


def _message_content(message: dict[str, Any]) -> str:
    """
    Resolve message content safely.

    Args:
        message (dict[str, Any]): Conversation message row.

    Returns:
        str: Stripped message content.
    """

    return str(message.get("content") or "").strip()


def _is_successful_rag_assistant_message(message: dict[str, Any]) -> bool:
    """
    Check whether an assistant message is a successful document-grounded answer.

    A document follow-up should only use prior context when the prior assistant
    answer was actually generated from official document chunks and cited.

    Args:
        message (dict[str, Any]): Conversation message row.

    Returns:
        bool: True when the message represents a successful RAG answer.
    """

    if _message_role(message) != "assistant":
        return False

    intent_profile = str(message.get("intent_profile") or "")
    if not intent_profile.startswith("rag:"):
        return False

    if bool(message.get("fallback_used")):
        return False

    try:
        retrieved_chunks_count = int(message.get("retrieved_chunks_count") or 0)
    except (TypeError, ValueError):
        retrieved_chunks_count = 0

    if retrieved_chunks_count <= 0:
        return False

    return bool(message.get("has_citations"))


def _find_previous_user_message(
    conversation_messages: list[dict[str, Any]],
    *,
    before_index: int,
) -> Optional[dict[str, Any]]:
    """
    Find the nearest user message before a specific message index.

    Args:
        conversation_messages (list[dict[str, Any]]): Chronological messages.
        before_index (int): Index before which to search.

    Returns:
        Optional[dict[str, Any]]: Previous user message if found.
    """

    for index in range(before_index - 1, -1, -1):
        message = conversation_messages[index]
        if _message_role(message) == "user" and _message_content(message):
            return message

    return None


def _find_latest_successful_rag_context(
    conversation_messages: list[dict[str, Any]],
) -> Optional[tuple[dict[str, Any], dict[str, Any]]]:
    """
    Locate the latest successful RAG assistant answer and its user question.

    Args:
        conversation_messages (list[dict[str, Any]]): Chronological messages.

    Returns:
        Optional[tuple[dict[str, Any], dict[str, Any]]]: The relevant prior
        user message and assistant message if found.
    """

    for index in range(len(conversation_messages) - 1, -1, -1):
        assistant_message = conversation_messages[index]

        if not _is_successful_rag_assistant_message(assistant_message):
            continue

        user_message = _find_previous_user_message(
            conversation_messages,
            before_index=index,
        )

        if user_message is None:
            continue

        return user_message, assistant_message

    return None


def _build_standalone_query(
    *,
    current_query: str,
    prior_document_query: str,
) -> str:
    """
    Build a focused retrieval query for approved document follow-ups.

    Args:
        current_query (str): Current follow-up query.
        prior_document_query (str): Latest relevant document-topic user query.

    Returns:
        str: Compact standalone retrieval query.
    """

    combined = f"{prior_document_query} {current_query}".strip()
    return re.sub(r"\s+", " ", combined)


def select_relevant_history(
    query: str,
    conversation_messages: list[dict[str, Any]],
    current_intent: AssistantIntent,
) -> ConversationContextDecision:
    """
    Select relevant conversation history for the current assistant turn.

    Args:
        query (str): Current normalized user query.
        conversation_messages (list[dict[str, Any]]): Recent conversation
            messages in chronological order.
        current_intent (AssistantIntent): Current-turn intent from the intent
            detector.

    Returns:
        ConversationContextDecision: Whether history may be used and the
        standalone query to use for approved follow-up retrieval.
    """

    normalized_query = query.strip()

    if not conversation_messages:
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason="No previous conversation messages available.",
            standalone_query=normalized_query,
        )

    if current_intent in NEVER_USE_HISTORY_FOR:
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason=f"History disabled for intent: {current_intent}.",
            standalone_query=normalized_query,
        )

    if current_intent != "document_follow_up_candidate":
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason=f"History not needed for intent: {current_intent}.",
            standalone_query=normalized_query,
        )

    if not _looks_like_follow_up_query(normalized_query):
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason="Current query does not contain an explicit follow-up reference.",
            standalone_query=normalized_query,
        )

    rag_context = _find_latest_successful_rag_context(conversation_messages)

    if rag_context is None:
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason="No successful document-grounded assistant answer with citations found.",
            standalone_query=normalized_query,
        )

    prior_user_message, prior_assistant_message = rag_context
    prior_document_query = _message_content(prior_user_message)

    if not prior_document_query:
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason="Relevant prior document question is empty.",
            standalone_query=normalized_query,
        )

    selected_messages = _extract_recent_messages(
        [prior_user_message, prior_assistant_message],
        limit=MAX_HISTORY_SELECTION_MESSAGES,
    )
    standalone_query = _build_standalone_query(
        current_query=normalized_query,
        prior_document_query=prior_document_query,
    )

    return ConversationContextDecision(
        use_history=True,
        selected_messages=selected_messages,
        reason="Document follow-up matched a previous successful RAG answer with citations.",
        standalone_query=standalone_query,
    )