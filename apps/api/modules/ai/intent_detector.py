# apps/api/modules/ai/intent_detector.py
"""
Deterministic current-turn intent detector.

Purpose:
- Classify intent using only the current normalized query.
- Prevent conversation history contamination at the intent-routing boundary.
- Route obvious assistant-help, app-help, general, document, and follow-up
  candidate turns before task planning and execution.

Integration notes:
- This module must not read conversation history.
- This module must not concatenate previous user messages into the current
  query.
- Query-quality screening runs before this detector in the assistant pipeline,
  but this detector still keeps small defensive checks for direct unit tests
  and direct internal use.
"""

import re
from typing import Optional

from modules.ai.models import (
    AssistantExecutionMode,
    AssistantIntent,
    AssistantRoutingDecision,
)

GREETING_PHRASES = {
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "ok",
    "okay",
    "alright",
    "good morning",
    "good afternoon",
    "good evening",
}

ASSISTANT_HELP_PATTERNS = (
    "who are you",
    "what are you",
    "how can you help",
    "what can you do",
    "what do you do",
)

APP_NAVIGATION_KEYWORDS = {
    "assistant",
    "borrowed",
    "borrows",
    "catalog",
    "dashboard",
    "fine",
    "fines",
    "profile",
    "queue",
    "result",
    "waiting list",
}

APP_NAVIGATION_ACTIONS = {
    "access",
    "check",
    "find",
    "go",
    "open",
    "see",
    "show",
    "use",
    "view",
    "where",
}

APP_PERSONAL_SECTION_PHRASES = {
    "my fines",
    "my fine",
    "my borrows",
    "my borrowed books",
    "my queue",
    "my waiting list",
    "my result",
    "my profile",
}

LIBRARY_TASK_PHRASES = {
    "borrow a book",
    "return a book",
    "renew a book",
    "waiting list",
    "ready for pickup",
    "fines work",
    "how do i borrow",
    "how do i return",
    "how do i renew",
    "how can i borrow",
    "how can i return",
    "how can i renew",
}

STRONG_DOCUMENT_PHRASES = {
    "admission eligibility",
    "attendance rule",
    "controller of examinations",
    "discipline policy",
    "entry test",
    "fee structure",
    "hostel fee",
    "library rules",
    "official circular",
    "official document",
    "official notice",
    "registrar office",
    "semester freeze",
    "tuition fee",
    "university document",
    "withdrawal policy",
}

DOCUMENT_ACTION_TERMS = {
    "admission",
    "attendance",
    "circular",
    "discipline",
    "dues",
    "eligibility",
    "fee",
    "fees",
    "merit",
    "notice",
    "policy",
    "policies",
    "refund",
    "regulation",
    "regulations",
    "rule",
    "rules",
    "scholarship",
    "tuition",
    "withdrawal",
}

DOCUMENT_CONTEXT_TERMS = {
    "academic",
    "controller",
    "department",
    "examination",
    "examinations",
    "hostel",
    "library",
    "official",
    "registrar",
    "semester",
    "student",
    "students",
    "uaf",
    "university",
}

WEAK_DOCUMENT_TERMS = {
    "application",
    "document",
    "documents",
    "fee",
    "fees",
    "payment",
    "semester",
}

FOLLOW_UP_MARKERS = {
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


def _normalize_for_matching(query: str) -> str:
    """
    Normalize query text for deterministic matching.

    Args:
        query (str): Current user query.

    Returns:
        str: Lowercase query with collapsed whitespace and trimmed sentence
            punctuation.
    """

    lowered = query.lower()
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered.strip("?.!,")


def _tokens(query: str) -> set[str]:
    """
    Extract lowercase alphanumeric tokens.

    Args:
        query (str): Normalized lowercase query.

    Returns:
        set[str]: Token set used for whole-word checks.
    """

    return set(re.findall(r"[a-z0-9]+", query))


def _contains_phrase(query: str, phrase: str) -> bool:
    """
    Check whether a phrase appears with word boundaries.

    Args:
        query (str): Normalized lowercase query.
        phrase (str): Phrase to locate.

    Returns:
        bool: True when the phrase appears as a phrase, not as a partial word.
    """

    escaped = re.escape(phrase)
    pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
    return re.search(pattern, query) is not None


def _contains_any_phrase(query: str, phrases: set[str] | tuple[str, ...]) -> bool:
    """
    Check whether any phrase appears in the query.

    Args:
        query (str): Normalized lowercase query.
        phrases (set[str] | tuple[str, ...]): Phrases to check.

    Returns:
        bool: True when any phrase is found.
    """

    return any(_contains_phrase(query, phrase) for phrase in phrases)


def _has_any_token(query: str, terms: set[str]) -> bool:
    """
    Check whether a query contains any whole-word term.

    Args:
        query (str): Normalized lowercase query.
        terms (set[str]): Terms to check.

    Returns:
        bool: True when any term appears as a whole token.
    """

    query_tokens = _tokens(query)
    return bool(query_tokens & terms)


def _looks_like_damaged_query(query: str) -> bool:
    """
    Detect damaged input that should not be routed into generation.

    Args:
        query (str): Raw current user query.

    Returns:
        bool: True when the query appears incomplete or damaged.
    """

    stripped = query.strip()
    lowered = stripped.lower()

    if (
        "http://" in lowered
        or "https://" in lowered
        or "/api/" in lowered
        or lowered.startswith(("/", "./", "../"))
        or re.search(r"\b[a-z]:\\", stripped, flags=re.IGNORECASE)
    ):
        return False

    words = re.findall(r"[a-z0-9]+", lowered)
    if stripped.endswith(("/", "\\")) and len(words) <= 6:
        return True

    alphanumeric_count = sum(1 for char in stripped if char.isalnum())
    symbol_count = sum(
        1 for char in stripped if not char.isalnum() and not char.isspace()
    )

    if alphanumeric_count == 0:
        return True

    return symbol_count > alphanumeric_count


def _has_reference_marker(query: str) -> bool:
    """
    Decide whether the query explicitly references previous context.

    Args:
        query (str): Normalized lowercase query.

    Returns:
        bool: True when the query contains a real follow-up marker.
    """

    words = query.split()

    if any(word in FOLLOW_UP_MARKERS for word in words):
        return True

    return any(query.startswith(prefix) for prefix in FOLLOW_UP_PREFIXES)


def _looks_like_follow_up_candidate(query: str) -> bool:
    """
    Detect follow-up candidate shape.

    This intentionally does not treat every short "what/how/when/where"
    question as a follow-up. A complete question such as "What is AI?" must
    remain a general question unless it contains a reference marker.

    Args:
        query (str): Normalized lowercase query.

    Returns:
        bool: True when query explicitly depends on previous context.
    """

    return _has_reference_marker(query)


def _looks_like_app_navigation_help(query: str) -> bool:
    """
    Detect questions about where to find or use app sections.

    Args:
        query (str): Normalized lowercase query.

    Returns:
        bool: True when the user is asking how to navigate the application.
    """

    if _contains_any_phrase(query, APP_PERSONAL_SECTION_PHRASES):
        return True

    if not _has_any_token(query, APP_NAVIGATION_KEYWORDS) and not _contains_any_phrase(
        query,
        APP_NAVIGATION_KEYWORDS,
    ):
        return False

    return _has_any_token(query, APP_NAVIGATION_ACTIONS)


def _looks_like_library_task_help(query: str) -> bool:
    """
    Detect questions about using library workflows inside the app.

    Args:
        query (str): Normalized lowercase query.

    Returns:
        bool: True when the user is asking how a library task works.
    """

    return _contains_any_phrase(query, LIBRARY_TASK_PHRASES)


def _looks_like_document_question(query: str) -> bool:
    """
    Detect official-document or university-policy questions.

    Args:
        query (str): Normalized lowercase query.

    Returns:
        bool: True when the query should use strict RAG over official
            documents.
    """

    if _contains_any_phrase(query, STRONG_DOCUMENT_PHRASES):
        return True

    query_tokens = _tokens(query)
    has_action_term = bool(query_tokens & DOCUMENT_ACTION_TERMS)
    has_context_term = bool(query_tokens & DOCUMENT_CONTEXT_TERMS)
    has_weak_term = bool(query_tokens & WEAK_DOCUMENT_TERMS)

    if has_action_term and has_context_term:
        return True

    if has_weak_term and _contains_any_phrase(
        query,
        {
            "official document",
            "official documents",
            "university document",
            "university documents",
            "uaf document",
            "uaf documents",
        },
    ):
        return True

    return False


def _build_decision(
    *,
    normalized_query: str,
    intent: AssistantIntent,
    execution_mode: AssistantExecutionMode,
    confidence: float,
    reason: str,
    retrieval_query: Optional[str] = None,
    requires_citations: bool = False,
    requires_official_sources: bool = False,
) -> AssistantRoutingDecision:
    """
    Build a stable assistant routing decision.

    Args:
        normalized_query (str): Current query text carried into routing.
        intent (AssistantIntent): Detected intent.
        execution_mode (AssistantExecutionMode): Initial execution mode.
        confidence (float): Deterministic routing confidence.
        reason (str): Internal reason for the decision.
        retrieval_query (Optional[str]): Retrieval query for direct RAG turns.
        requires_citations (bool): Whether citations are required.
        requires_official_sources (bool): Whether official documents are
            required.

    Returns:
        AssistantRoutingDecision: Current-turn routing decision.
    """

    return AssistantRoutingDecision(
        intent=intent,
        execution_mode=execution_mode,
        confidence=max(0.0, min(1.0, confidence)),
        reason=reason,
        use_history=False,
        history_window=0,
        standalone_query=normalized_query,
        retrieval_query=retrieval_query,
        requires_citations=requires_citations,
        requires_official_sources=requires_official_sources,
    )


def detect_assistant_intent(query: str) -> AssistantRoutingDecision:
    """
    Detect assistant intent using only the current query.

    Args:
        query (str): Current normalized user query.

    Returns:
        AssistantRoutingDecision: Deterministic routing decision for the
            current turn.
    """

    normalized_query = _normalize_for_matching(query)

    if not normalized_query:
        return _build_decision(
            normalized_query=query,
            intent="clarification_needed",
            execution_mode="clarification_response",
            confidence=1.0,
            reason="Empty or whitespace-only query.",
        )

    if _looks_like_damaged_query(query):
        return _build_decision(
            normalized_query=query,
            intent="clarification_needed",
            execution_mode="clarification_response",
            confidence=0.9,
            reason="Query appears damaged or incomplete.",
        )

    if normalized_query in GREETING_PHRASES or normalized_query.startswith(
        ("hi ", "hello ", "hey ")
    ):
        return _build_decision(
            normalized_query=query,
            intent="greeting",
            execution_mode="static_response",
            confidence=0.99,
            reason="Greeting phrase detected.",
        )

    if any(pattern in normalized_query for pattern in ASSISTANT_HELP_PATTERNS):
        return _build_decision(
            normalized_query=query,
            intent="assistant_help",
            execution_mode="app_help_response",
            confidence=0.95,
            reason="Assistant capability/help pattern detected.",
        )

    if _looks_like_follow_up_candidate(normalized_query):
        return _build_decision(
            normalized_query=query,
            intent="document_follow_up_candidate",
            execution_mode="clarification_response",
            confidence=0.72,
            reason="Reference-style follow-up candidate detected.",
        )

    if _looks_like_app_navigation_help(normalized_query):
        return _build_decision(
            normalized_query=query,
            intent="app_navigation_help",
            execution_mode="app_help_response",
            confidence=0.9,
            reason="Application navigation request detected.",
        )

    if _looks_like_library_task_help(normalized_query):
        return _build_decision(
            normalized_query=query,
            intent="library_task_help",
            execution_mode="app_help_response",
            confidence=0.9,
            reason="Library task help request detected.",
        )

    if _looks_like_document_question(normalized_query):
        return _build_decision(
            normalized_query=query,
            intent="document_question",
            execution_mode="rag_generation",
            confidence=0.9,
            reason="Official-document or university-policy signal detected.",
            retrieval_query=query,
            requires_citations=True,
            requires_official_sources=True,
        )

    if len(normalized_query) <= 2:
        return _build_decision(
            normalized_query=query,
            intent="clarification_needed",
            execution_mode="clarification_response",
            confidence=0.85,
            reason="Very short query is too ambiguous.",
        )

    return _build_decision(
        normalized_query=query,
        intent="general_question",
        execution_mode="general_generation",
        confidence=0.8,
        reason="No document/help keyword; defaulting to general question.",
    )