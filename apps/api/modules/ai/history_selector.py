# apps/api/modules/ai/history_selector.py
"""
Conversation-history relevance selector.

Purpose:
- Decide if previous conversation messages may influence the current turn.
- Prevent unrelated previous topics from contaminating current intent handling.
- Allow document follow-up only when recent history contains a successful
  document-grounded assistant answer with citations.
- Build search-friendly standalone retrieval queries for approved document
  follow-ups.

Integration notes:
- `AssistantService._fetch_recent_messages(...)` must provide assistant
  metadata fields used here:
  `intent_profile`, `fallback_used`, `retrieved_chunks_count`, and
  `has_citations`.
- This module must not convert greeting/help/general turns into document turns.
- Prior assistant text is used only to confirm that a cited RAG answer exists;
  it is not treated as an official source.
"""

import re
from typing import Any, Optional

from modules.ai.constants import MAX_HISTORY_SELECTION_MESSAGES
from modules.ai.models import AssistantIntent, ConversationContextDecision

MAX_STANDALONE_QUERY_TERMS = 24

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

SEARCH_STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "ask",
    "at",
    "be",
    "by",
    "can",
    "could",
    "do",
    "does",
    "for",
    "from",
    "give",
    "has",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "mention",
    "mentions",
    "of",
    "on",
    "or",
    "please",
    "say",
    "says",
    "show",
    "tell",
    "that",
    "the",
    "their",
    "them",
    "then",
    "these",
    "this",
    "those",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "you",
    "your",
}

REFERENCE_SEARCH_TERMS = FOLLOW_UP_TERMS | {
    "about",
    "same",
}

KNOWN_DOMAIN_PHRASES = (
    "semester freeze",
    "admission eligibility",
    "attendance rule",
    "discipline policy",
    "withdrawal policy",
    "fee structure",
    "tuition fee",
    "hostel fee",
    "refund rule",
    "waiting list",
    "pickup notice",
    "ready for pickup",
    "duplicate request",
    "student id",
    "student id card",
    "application form",
    "supporting evidence",
    "registrar office",
    "fee section",
    "automatic approval",
    "special approval",
    "late application",
    "midterm examination",
)

FOLLOW_UP_EXPANSION_RULES: tuple[tuple[tuple[str, ...], tuple[str, ...]], ...] = (
    (
        (
            "document required",
            "documents required",
            "required document",
            "required documents",
            "what documents",
            "which documents",
        ),
        (
            "required",
            "documents",
            "application",
            "form",
            "supporting",
            "evidence",
            "student",
            "id",
            "card",
            "recommendation",
        ),
    ),
    (
        (
            "automatic approval",
            "automatically approved",
            "approval automatic",
            "mention automatic",
            "mention approval",
        ),
        (
            "automatic",
            "approval",
            "approved",
            "registrar",
            "office",
            "special",
            "exception",
        ),
    ),
    (
        (
            "late application",
            "late applications",
            "after midterm",
            "after the midterm",
            "midterm",
        ),
        (
            "late",
            "application",
            "applications",
            "after",
            "midterm",
            "special",
            "approval",
            "registrar",
            "office",
            "exception",
        ),
    ),
    (
        (
            "deadline",
            "last date",
            "due date",
            "how long",
            "when should",
            "when can",
        ),
        (
            "deadline",
            "date",
            "period",
            "before",
            "after",
            "midterm",
            "working",
            "days",
        ),
    ),
    (
        (
            "fee",
            "fees",
            "refund",
            "refunded",
            "payment",
            "dues",
        ),
        (
            "fee",
            "fees",
            "refund",
            "payment",
            "dues",
            "section",
            "approval",
        ),
    ),
    (
        (
            "waiting list",
            "queue",
            "pickup",
            "duplicate",
            "same book",
        ),
        (
            "waiting",
            "list",
            "queue",
            "pickup",
            "duplicate",
            "request",
            "book",
            "borrowed",
            "reserved",
            "available",
        ),
    ),
)


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


def _contains_phrase(text: str, phrase: str) -> bool:
    """
    Check whether a phrase appears with word boundaries.

    Args:
        text (str): Normalized text.
        phrase (str): Phrase to find.

    Returns:
        bool: True when the phrase appears as a complete phrase.
    """

    escaped = re.escape(phrase)
    pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
    return re.search(pattern, text) is not None


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


def _append_unique(parts: list[str], value: str) -> None:
    """
    Append a search term if it is meaningful and not already present.

    Args:
        parts (list[str]): Mutable search term list.
        value (str): Candidate search term.
    """

    normalized = re.sub(r"\s+", " ", value or "").strip().lower().strip("?.!,")
    if not normalized:
        return

    if normalized in SEARCH_STOP_WORDS or normalized in REFERENCE_SEARCH_TERMS:
        return

    if normalized not in parts:
        parts.append(normalized)


def _extract_known_phrases(*values: str) -> list[str]:
    """
    Extract known domain phrases from one or more text values.

    Args:
        *values (str): Text values to scan.

    Returns:
        list[str]: Known phrases found in input text, preserving configured
        phrase order.
    """

    combined = _normalize_text(" ".join(values))

    return [
        phrase
        for phrase in KNOWN_DOMAIN_PHRASES
        if _contains_phrase(combined, phrase)
    ]


def _extract_search_tokens(value: str) -> list[str]:
    """
    Extract useful search tokens from a question.

    Args:
        value (str): User question text.

    Returns:
        list[str]: Search-safe tokens with stop/reference words removed.
    """

    normalized = _normalize_text(value)
    raw_tokens = re.findall(r"[a-z0-9]+", normalized)
    tokens: list[str] = []

    for token in raw_tokens:
        if len(token) <= 1:
            continue

        if token in SEARCH_STOP_WORDS or token in REFERENCE_SEARCH_TERMS:
            continue

        _append_unique(tokens, token)

    return tokens


def _resolve_follow_up_expansion_terms(current_query: str) -> list[str]:
    """
    Resolve targeted search expansion terms for common follow-up shapes.

    Args:
        current_query (str): Current follow-up query.

    Returns:
        list[str]: Expansion terms that make text-search retrieval more likely
        to find the relevant official chunk.
    """

    normalized = _normalize_text(current_query)
    expansion_terms: list[str] = []

    for triggers, terms in FOLLOW_UP_EXPANSION_RULES:
        if not any(_contains_phrase(normalized, trigger) for trigger in triggers):
            continue

        for term in terms:
            _append_unique(expansion_terms, term)

    return expansion_terms


def _build_standalone_query(
    *,
    current_query: str,
    prior_document_query: str,
) -> str:
    """
    Build a focused retrieval query for approved document follow-ups.

    The old approach joined the previous question and the current follow-up as
    one sentence. That was readable for humans but weak for the current
    text-search RPC. This function instead keeps the prior topic and adds
    search terms from the follow-up.

    Example:
        Prior: "What is the semester freeze policy?"
        Current: "What documents are required for it?"
        Output: "semester freeze policy documents required application form
        supporting evidence student id card recommendation"

    Args:
        current_query (str): Current follow-up query.
        prior_document_query (str): Latest relevant document-topic user query.

    Returns:
        str: Compact standalone retrieval query.
    """

    terms: list[str] = []

    for phrase in _extract_known_phrases(prior_document_query, current_query):
        _append_unique(terms, phrase)

    for token in _extract_search_tokens(prior_document_query):
        _append_unique(terms, token)

    for token in _extract_search_tokens(current_query):
        _append_unique(terms, token)

    for term in _resolve_follow_up_expansion_terms(current_query):
        _append_unique(terms, term)

    if terms:
        return " ".join(terms[:MAX_STANDALONE_QUERY_TERMS])

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