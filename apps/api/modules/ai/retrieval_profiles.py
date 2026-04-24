"""
Retrieval profile resolver for assistant RAG tasks.

Purpose:
- Keep profile-specific retrieval tuning out of the main AI service wrapper.
"""

from core.config import settings
from modules.ai.models import RetrievalProfile


def resolve_retrieval_profile(query_text: str) -> RetrievalProfile:
    lowered = query_text.lower()
    default_threshold = settings.document_retrieval_similarity_threshold

    if any(
        keyword in lowered
        for keyword in (
            "policy",
            "freeze",
            "semester freeze",
            "rule",
            "regulation",
            "attendance",
            "semester",
            "withdrawal",
            "discipline",
        )
    ):
        return RetrievalProfile(
            name="policy_lookup",
            top_k=min(settings.document_retrieval_default_top_k + 1, 8),
            similarity_threshold=default_threshold,
        )

    if any(
        keyword in lowered
        for keyword in (
            "fee",
            "tuition",
            "dues",
            "charges",
            "payment",
            "refund",
            "scholarship",
            "hostel fee",
        )
    ):
        return RetrievalProfile(
            name="fee_lookup",
            top_k=min(settings.document_retrieval_default_top_k + 1, 8),
            similarity_threshold=max(0.60, default_threshold - 0.05),
        )

    if any(
        keyword in lowered
        for keyword in (
            "admission",
            "apply",
            "application",
            "merit",
            "eligibility",
            "entry test",
            "admitted",
        )
    ):
        return RetrievalProfile(
            name="admission_lookup",
            top_k=min(settings.document_retrieval_default_top_k + 1, 8),
            similarity_threshold=max(0.60, default_threshold - 0.05),
        )

    department_map = {
        "registrar": "Registrar Office",
        "registrar office": "Registrar Office",
        "admission office": "Admission Office",
        "admissions office": "Admission Office",
        "controller of examinations": "Controller of Examinations",
        "controller": "Controller of Examinations",
        "financial aid": "Financial Aid Office",
        "fee section": "Fee Section",
    }

    department_notice_markers = (
        "notice",
        "circular",
        "announcement",
        "office timing",
        "office hours",
        "contact",
    )

    if any(marker in lowered for marker in department_notice_markers):
        for needle, department in department_map.items():
            if needle in lowered:
                return RetrievalProfile(
                    name="department_specific_notice",
                    top_k=min(settings.document_retrieval_default_top_k + 1, 8),
                    similarity_threshold=default_threshold,
                    department=department,
                )

    return RetrievalProfile(
        name="general_university_info",
        top_k=settings.document_retrieval_default_top_k,
        similarity_threshold=default_threshold,
    )
