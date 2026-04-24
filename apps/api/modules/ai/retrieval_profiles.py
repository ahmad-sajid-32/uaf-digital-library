# apps/api/modules/ai/retrieval_profiles.py
"""
Retrieval profile resolver for assistant RAG tasks.

Purpose:
- Keep profile-specific retrieval tuning out of the main AI service wrapper.
- Resolve document-question retrieval profiles from a normalized query.
- Provide profile-specific rerank hints for the retrieval service without
  changing the public `/api/ai/*` contract.

Integration notes:
- This module does not execute retrieval.
- This module does not call the LLM.
- This module must remain safe if used by tests without database access.
"""

import re

from core.config import settings
from modules.ai.models import RetrievalProfile

MAX_SPECIFIC_PROFILE_TOP_K = 8
MIN_RELAXED_SIMILARITY_THRESHOLD = 0.60

POLICY_PHRASES = {
    "attendance rule",
    "discipline policy",
    "library rules",
    "semester freeze",
    "withdrawal policy",
}

POLICY_TERMS = {
    "attendance",
    "discipline",
    "freeze",
    "policy",
    "policies",
    "regulation",
    "regulations",
    "rule",
    "rules",
    "semester",
    "withdrawal",
}

FEE_PHRASES = {
    "fee structure",
    "financial aid",
    "hostel fee",
    "tuition fee",
}

FEE_TERMS = {
    "charges",
    "dues",
    "fee",
    "fees",
    "hostel",
    "payment",
    "refund",
    "scholarship",
    "tuition",
}

ADMISSION_PHRASES = {
    "admission eligibility",
    "admission form",
    "admission office",
    "entry test",
    "merit list",
}

ADMISSION_TERMS = {
    "admission",
    "admissions",
    "admitted",
    "application",
    "apply",
    "eligibility",
    "merit",
}

DEPARTMENT_MAP = (
    ("controller of examinations", "Controller of Examinations"),
    ("admissions office", "Admission Office"),
    ("admission office", "Admission Office"),
    ("registrar office", "Registrar Office"),
    ("financial aid", "Financial Aid Office"),
    ("fee section", "Fee Section"),
    ("controller", "Controller of Examinations"),
    ("registrar", "Registrar Office"),
)

DEPARTMENT_NOTICE_MARKERS = {
    "announcement",
    "circular",
    "contact",
    "notice",
    "office hours",
    "office timing",
}

PROFILE_RERANK_HINTS: dict[str, tuple[str, ...]] = {
    "policy_lookup": (
        "policy",
        "rule",
        "regulation",
        "semester freeze",
        "attendance",
        "withdrawal",
        "discipline",
        "eligibility",
    ),
    "fee_lookup": (
        "fee",
        "fees",
        "dues",
        "tuition",
        "refund",
        "scholarship",
        "hostel",
        "payment",
    ),
    "admission_lookup": (
        "admission",
        "application",
        "eligibility",
        "merit",
        "entry test",
        "admitted",
    ),
    "department_specific_notice": (
        "notice",
        "circular",
        "announcement",
        "office timing",
        "office hours",
        "contact",
        "registrar",
        "controller",
    ),
    "general_university_info": (
        "university",
        "student",
        "academic",
        "department",
        "document",
        "notice",
    ),
}


def _normalize_query(query_text: str) -> str:
    """
    Normalize query text for profile matching.

    Args:
        query_text (str): Raw or normalized retrieval query.

    Returns:
        str: Lowercase, whitespace-collapsed query text.
    """

    lowered = (query_text or "").lower()
    return re.sub(r"\s+", " ", lowered).strip()


def _tokens(query_text: str) -> set[str]:
    """
    Extract lowercase alphanumeric tokens.

    Args:
        query_text (str): Normalized query text.

    Returns:
        set[str]: Token set used for whole-word matching.
    """

    return set(re.findall(r"[a-z0-9]+", query_text))


def _contains_phrase(query_text: str, phrase: str) -> bool:
    """
    Check whether a phrase appears with word boundaries.

    Args:
        query_text (str): Normalized query text.
        phrase (str): Phrase to match.

    Returns:
        bool: True when the phrase appears as a full phrase.
    """

    escaped = re.escape(phrase)
    pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
    return re.search(pattern, query_text) is not None


def _contains_any_phrase(query_text: str, phrases: set[str]) -> bool:
    """
    Check whether any phrase exists in the query.

    Args:
        query_text (str): Normalized query text.
        phrases (set[str]): Phrase set.

    Returns:
        bool: True when any phrase matches.
    """

    return any(_contains_phrase(query_text, phrase) for phrase in phrases)


def _has_any_token(query_text: str, terms: set[str]) -> bool:
    """
    Check whether any term exists as a full token.

    Args:
        query_text (str): Normalized query text.
        terms (set[str]): Token terms.

    Returns:
        bool: True when at least one term is present.
    """

    return bool(_tokens(query_text) & terms)


def _specific_profile_top_k(extra_candidates: int = 2) -> int:
    """
    Resolve top-k for specific retrieval profiles.

    Specific document-question profiles benefit from a few extra candidates
    before retrieval-service reranking. The final cap keeps context size
    controlled.

    Args:
        extra_candidates (int): Number of extra candidates above default top-k.

    Returns:
        int: Bounded top-k value.
    """

    return min(
        int(settings.document_retrieval_default_top_k) + extra_candidates,
        MAX_SPECIFIC_PROFILE_TOP_K,
    )


def _relaxed_threshold(offset: float = 0.05) -> float:
    """
    Resolve a slightly relaxed retrieval threshold for broad document categories.

    Args:
        offset (float): Amount to subtract from configured threshold.

    Returns:
        float: Safe relaxed threshold.
    """

    default_threshold = float(settings.document_retrieval_similarity_threshold)
    return max(MIN_RELAXED_SIMILARITY_THRESHOLD, default_threshold - offset)


def _default_threshold() -> float:
    """
    Resolve configured default retrieval threshold.

    Returns:
        float: Default retrieval similarity threshold.
    """

    return float(settings.document_retrieval_similarity_threshold)


def _resolve_department(query_text: str) -> str | None:
    """
    Resolve department metadata filter from a notice-style query.

    Args:
        query_text (str): Normalized query text.

    Returns:
        str | None: Department name when a known department phrase is present.
    """

    for phrase, department in DEPARTMENT_MAP:
        if _contains_phrase(query_text, phrase):
            return department

    return None


def get_retrieval_profile_hints(profile_name: str) -> tuple[str, ...]:
    """
    Return profile-specific rerank hints for retrieval scoring.

    Args:
        profile_name (str): Retrieval profile name.

    Returns:
        tuple[str, ...]: Terms and phrases useful for lightweight reranking.
    """

    return PROFILE_RERANK_HINTS.get(profile_name, PROFILE_RERANK_HINTS["general_university_info"])


def resolve_retrieval_profile(query_text: str) -> RetrievalProfile:
    """
    Resolve the retrieval profile for a document-grounded assistant task.

    Args:
        query_text (str): Retrieval query produced by task planning.

    Returns:
        RetrievalProfile: Profile-specific retrieval settings.
    """

    normalized_query = _normalize_query(query_text)

    department = _resolve_department(normalized_query)
    if department and _contains_any_phrase(normalized_query, DEPARTMENT_NOTICE_MARKERS):
        return RetrievalProfile(
            name="department_specific_notice",
            top_k=_specific_profile_top_k(),
            similarity_threshold=_default_threshold(),
            department=department,
        )

    if _contains_any_phrase(normalized_query, POLICY_PHRASES) or _has_any_token(
        normalized_query,
        POLICY_TERMS,
    ):
        return RetrievalProfile(
            name="policy_lookup",
            top_k=_specific_profile_top_k(),
            similarity_threshold=_default_threshold(),
        )

    if _contains_any_phrase(normalized_query, FEE_PHRASES) or _has_any_token(
        normalized_query,
        FEE_TERMS,
    ):
        return RetrievalProfile(
            name="fee_lookup",
            top_k=_specific_profile_top_k(),
            similarity_threshold=_relaxed_threshold(),
        )

    if _contains_any_phrase(normalized_query, ADMISSION_PHRASES) or _has_any_token(
        normalized_query,
        ADMISSION_TERMS,
    ):
        return RetrievalProfile(
            name="admission_lookup",
            top_k=_specific_profile_top_k(),
            similarity_threshold=_relaxed_threshold(),
        )

    return RetrievalProfile(
        name="general_university_info",
        top_k=int(settings.document_retrieval_default_top_k),
        similarity_threshold=_default_threshold(),
    )