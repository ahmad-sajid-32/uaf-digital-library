"""
Deterministic current-turn intent detector.

Purpose:
- Classify intent using only the current normalized query.
- Prevent history contamination at the intent-routing boundary.
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
    "fines",
    "fine",
    "borrowed",
    "borrows",
    "queue",
    "waiting list",
    "result",
    "catalog",
    "profile",
    "dashboard",
    "assistant",
}

LIBRARY_TASK_KEYWORDS = {
    "borrow a book",
    "return a book",
    "renew a book",
    "waiting list",
    "ready for pickup",
    "fines work",
    "how do i borrow",
    "how do i return",
    "how do i renew",
}

DOCUMENT_KEYWORDS = {
    "policy",
    "freeze",
    "semester freeze",
    "rule",
    "regulation",
    "attendance",
    "semester",
    "withdrawal",
    "discipline",
    "fee",
    "tuition",
    "dues",
    "charges",
    "payment",
    "refund",
    "scholarship",
    "hostel fee",
    "admission",
    "application",
    "merit",
    "eligibility",
    "entry test",
    "registrar",
    "controller of examinations",
    "notice",
    "circular",
    "official document",
    "document",
}

FOLLOW_UP_MARKERS = {
    "it",
    "that",
    "this",
    "these",
    "those",
    "them",
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


def _normalize_for_matching(query: str) -> str:
    lowered = query.lower()
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered.strip("?.!,")


def _contains_any(query: str, keywords: set[str]) -> bool:
    return any(keyword in query for keyword in keywords)


def _looks_like_follow_up_candidate(query: str) -> bool:
    words = query.split()

    if any(word in FOLLOW_UP_MARKERS for word in words):
        return True

    if any(query.startswith(prefix) for prefix in FOLLOW_UP_PREFIXES):
        return True

    if len(words) <= 5 and words and words[0] in {"what", "how", "when", "where"}:
        return True

    return False


def _has_reference_marker(query: str) -> bool:
    words = query.split()

    if any(word in FOLLOW_UP_MARKERS for word in words):
        return True

    if any(query.startswith(prefix) for prefix in FOLLOW_UP_PREFIXES):
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
    return AssistantRoutingDecision(
        intent=intent,
        execution_mode=execution_mode,
        confidence=confidence,
        reason=reason,
        use_history=False,
        history_window=0,
        standalone_query=normalized_query,
        retrieval_query=retrieval_query,
        requires_citations=requires_citations,
        requires_official_sources=requires_official_sources,
    )


def detect_assistant_intent(query: str) -> AssistantRoutingDecision:
    normalized_query = _normalize_for_matching(query)

    if not normalized_query:
        return _build_decision(
            normalized_query=query,
            intent="clarification_needed",
            execution_mode="clarification_response",
            confidence=1.0,
            reason="Empty or whitespace-only query.",
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

    if _looks_like_follow_up_candidate(normalized_query) and _has_reference_marker(
        normalized_query
    ):
        return _build_decision(
            normalized_query=query,
            intent="document_follow_up_candidate",
            execution_mode="clarification_response",
            confidence=0.7,
            reason="Reference-style follow-up candidate detected.",
        )

    if _contains_any(normalized_query, DOCUMENT_KEYWORDS):
        return _build_decision(
            normalized_query=query,
            intent="document_question",
            execution_mode="rag_generation",
            confidence=0.92,
            reason="Document-policy keyword detected.",
            retrieval_query=query,
            requires_citations=True,
            requires_official_sources=True,
        )

    if _contains_any(normalized_query, APP_NAVIGATION_KEYWORDS):
        return _build_decision(
            normalized_query=query,
            intent="app_navigation_help",
            execution_mode="app_help_response",
            confidence=0.9,
            reason="Application navigation keyword detected.",
        )

    if _contains_any(normalized_query, LIBRARY_TASK_KEYWORDS):
        return _build_decision(
            normalized_query=query,
            intent="library_task_help",
            execution_mode="app_help_response",
            confidence=0.9,
            reason="Library task keyword detected.",
        )

    if _looks_like_follow_up_candidate(normalized_query):
        return _build_decision(
            normalized_query=query,
            intent="document_follow_up_candidate",
            execution_mode="clarification_response",
            confidence=0.6,
            reason="Follow-up style query requires context check.",
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
