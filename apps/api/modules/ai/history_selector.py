"""
Conversation-history relevance selector.

Purpose:
- Decide if history should influence the current turn.
- Prevent unrelated previous topics from contaminating current intent handling.
"""

import re
from typing import Any

from modules.ai.constants import MAX_HISTORY_SELECTION_MESSAGES
from modules.ai.intent_detector import detect_assistant_intent
from modules.ai.models import AssistantIntent, ConversationContextDecision

FOLLOW_UP_TERMS = {
    "it",
    "that",
    "this",
    "these",
    "those",
    "same",
    "above",
    "also",
    "then",
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
    return re.sub(r"\s+", " ", value or "").strip().lower().strip("?.!,")


def _looks_like_follow_up_query(query: str) -> bool:
    normalized = _normalize_text(query)
    words = normalized.split()

    if any(word in FOLLOW_UP_TERMS for word in words):
        return True

    if any(normalized.startswith(prefix) for prefix in FOLLOW_UP_PREFIXES):
        return True

    if len(words) <= 5 and words and words[0] in {"what", "how", "when", "where"}:
        return True

    return False


def _extract_recent_messages(
    conversation_messages: list[dict[str, Any]],
    *,
    limit: int,
) -> list[dict[str, Any]]:
    if not conversation_messages:
        return []

    return conversation_messages[-limit:]


def _extract_recent_user_messages(
    conversation_messages: list[dict[str, Any]],
    *,
    limit: int,
) -> list[str]:
    user_messages = [
        str(item.get("content") or "").strip()
        for item in conversation_messages
        if item.get("role") == "user" and str(item.get("content") or "").strip()
    ]
    if not user_messages:
        return []
    return user_messages[-limit:]


def _is_document_topic_family(query: str) -> bool:
    previous_intent = detect_assistant_intent(query).intent
    return previous_intent in {"document_question", "document_follow_up_candidate", "document_follow_up"}


def _build_standalone_query(
    query: str,
    user_history: list[str],
) -> str:
    combined = " ".join([*user_history, query]).strip()
    return re.sub(r"\s+", " ", combined)


def select_relevant_history(
    query: str,
    conversation_messages: list[dict[str, Any]],
    current_intent: AssistantIntent,
) -> ConversationContextDecision:
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

    if current_intent not in {"document_follow_up_candidate", "library_task_help"}:
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
            reason="Current query does not look like a follow-up.",
            standalone_query=normalized_query,
        )

    recent_user_messages = _extract_recent_user_messages(
        conversation_messages,
        limit=2,
    )

    if not recent_user_messages:
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason="No recent user turns to resolve follow-up context.",
            standalone_query=normalized_query,
        )

    latest_user_turn = recent_user_messages[-1]

    if not _is_document_topic_family(latest_user_turn):
        return ConversationContextDecision(
            use_history=False,
            selected_messages=[],
            reason="Recent topic family does not match document follow-up routing.",
            standalone_query=normalized_query,
        )

    selected_messages = _extract_recent_messages(
        conversation_messages,
        limit=MAX_HISTORY_SELECTION_MESSAGES,
    )
    standalone_query = _build_standalone_query(
        normalized_query,
        recent_user_messages,
    )

    return ConversationContextDecision(
        use_history=True,
        selected_messages=selected_messages,
        reason="Document follow-up context matched recent user topic family.",
        standalone_query=standalone_query,
    )
