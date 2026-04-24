# apps/api/modules/ai/query_quality.py
"""
Query quality gate for the AI assistant pipeline.

Purpose:
- Validate and normalize the current user query before intent detection.
- Prevent typo-heavy, empty, damaged, or under-specified input from being
  incorrectly routed into RAG, follow-up handling, or general generation.
- Keep this layer deterministic and dependency-free so routing remains stable.

Integration notes:
- This file does not classify assistant intent.
- This file does not inspect conversation history.
- Follow-up candidates such as "What about that?" are allowed through this
  gate; the history selector decides later whether context is available.
"""

import re

from modules.ai.models import QueryQualityDecision

MIN_NON_GREETING_QUERY_LENGTH = 3

CONVERSATIONAL_SHORT_PHRASES = {
    "hi",
    "hello",
    "hey",
    "ok",
    "okay",
    "thanks",
    "thank you",
}

VAGUE_EXACT_QUERIES = {
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
    "which",
    "tell me",
    "explain",
    "details",
    "more",
    "this",
    "that",
    "it",
    "same",
    "above",
}

VAGUE_PREFIXES_WITHOUT_OBJECT = (
    "tell me about",
    "explain about",
    "give details",
    "more about",
)

REFERENCE_FOLLOW_UP_PREFIXES = (
    "what about",
    "how about",
    "and ",
    "also ",
)

REFERENCE_TERMS = {
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

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "can",
    "do",
    "does",
    "for",
    "from",
    "give",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "of",
    "on",
    "or",
    "please",
    "tell",
    "that",
    "the",
    "their",
    "this",
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


def normalize_query_text(query: str) -> str:
    """
    Normalize raw assistant query text without changing its meaning.

    Args:
        query (str): Raw user query.

    Returns:
        str: Whitespace-collapsed query text.
    """

    return re.sub(r"\s+", " ", query or "").strip()


def _normalize_for_matching(query: str) -> str:
    """
    Normalize query text for deterministic quality checks.

    Args:
        query (str): Normalized user query.

    Returns:
        str: Lowercase query text with trailing sentence punctuation removed.
    """

    lowered = query.lower()
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered.strip("?.!,")


def _is_short_conversational_query(lowered_query: str) -> bool:
    """
    Check whether a short query is an intentional conversational phrase.

    Args:
        lowered_query (str): Lowercase normalized query.

    Returns:
        bool: True when the query is a valid short greeting/acknowledgement.
    """

    return lowered_query in CONVERSATIONAL_SHORT_PHRASES


def _looks_like_reference_follow_up(lowered_query: str) -> bool:
    """
    Detect whether the query is shaped like a possible follow-up.

    This does not approve history usage. It only prevents this quality gate
    from blocking possible follow-up questions before the history selector runs.

    Args:
        lowered_query (str): Lowercase normalized query.

    Returns:
        bool: True when the query may depend on previous context.
    """

    words = lowered_query.split()

    if any(lowered_query.startswith(prefix) for prefix in REFERENCE_FOLLOW_UP_PREFIXES):
        return True

    return any(word in REFERENCE_TERMS for word in words)


def _looks_like_route_path_or_url(query: str) -> bool:
    """
    Detect valid technical path/URL-looking input so slash usage is not
    incorrectly treated as damaged text.

    Args:
        query (str): Normalized user query.

    Returns:
        bool: True when the query appears to include a real path, URL, or route.
    """

    lowered = query.lower()

    return bool(
        "http://" in lowered
        or "https://" in lowered
        or "/api/" in lowered
        or lowered.startswith(("/", "./", "../"))
        or re.search(r"\b[a-z]:\\", query, flags=re.IGNORECASE)
    )


def _looks_like_damaged_query(query: str) -> bool:
    """
    Detect typo-like or damaged input that should not be routed.

    Args:
        query (str): Normalized user query.

    Returns:
        bool: True when the query appears damaged or incomplete.
    """

    if _looks_like_route_path_or_url(query):
        return False

    lowered = query.lower()
    words = re.findall(r"[a-z0-9]+", lowered)

    if query.endswith(("/", "\\")) and len(words) <= 6:
        return True

    alphanumeric_count = sum(1 for char in query if char.isalnum())
    symbol_count = sum(1 for char in query if not char.isalnum() and not char.isspace())

    if alphanumeric_count == 0:
        return True

    if symbol_count > alphanumeric_count:
        return True

    if "�" in query:
        return True

    return False


def _significant_tokens(lowered_query: str) -> set[str]:
    """
    Extract meaningful tokens for under-specification checks.

    Args:
        lowered_query (str): Lowercase normalized query.

    Returns:
        set[str]: Significant non-stopword tokens.
    """

    raw_tokens = re.findall(r"[a-z0-9]+", lowered_query)

    return {
        token
        for token in raw_tokens
        if len(token) > 1 and token not in STOP_WORDS
    }


def _is_vague_query(lowered_query: str) -> bool:
    """
    Detect vague input that has no usable object.

    Args:
        lowered_query (str): Lowercase normalized query.

    Returns:
        bool: True when the query should return clarification.
    """

    if lowered_query in VAGUE_EXACT_QUERIES:
        return True

    if any(lowered_query == prefix for prefix in VAGUE_PREFIXES_WITHOUT_OBJECT):
        return True

    if lowered_query in {"tell me about it", "explain it", "more about it"}:
        return False

    significant_tokens = _significant_tokens(lowered_query)

    if not significant_tokens and not _looks_like_reference_follow_up(lowered_query):
        return True

    return False


def assess_query_quality(query: str) -> QueryQualityDecision:
    """
    Assess whether a user query is clear enough for assistant routing.

    Args:
        query (str): Raw user query.

    Returns:
        QueryQualityDecision: Normalized query and deterministic quality result.
    """

    normalized_query = normalize_query_text(query)
    lowered_query = _normalize_for_matching(normalized_query)

    if not normalized_query:
        return QueryQualityDecision(
            normalized_query="",
            is_valid=False,
            needs_clarification=True,
            reason="Empty or whitespace-only query.",
        )

    if _is_short_conversational_query(lowered_query):
        return QueryQualityDecision(
            normalized_query=normalized_query,
            is_valid=True,
            needs_clarification=False,
            reason="Valid short conversational query.",
        )

    if len(normalized_query) < MIN_NON_GREETING_QUERY_LENGTH:
        return QueryQualityDecision(
            normalized_query=normalized_query,
            is_valid=False,
            needs_clarification=True,
            reason="Query is too short to route safely.",
        )

    if _looks_like_damaged_query(normalized_query):
        return QueryQualityDecision(
            normalized_query=normalized_query,
            is_valid=False,
            needs_clarification=True,
            reason="Query appears damaged or incomplete.",
        )

    if _is_vague_query(lowered_query):
        return QueryQualityDecision(
            normalized_query=normalized_query,
            is_valid=False,
            needs_clarification=True,
            reason="Query is too vague to answer safely.",
        )

    return QueryQualityDecision(
        normalized_query=normalized_query,
        is_valid=True,
        needs_clarification=False,
        reason="Query passed quality checks.",
    )