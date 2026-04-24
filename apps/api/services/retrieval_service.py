# apps/api/services/retrieval_service.py
"""
Retrieval mechanics service for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Normalize retrieval and assistant queries.
- Execute PostgreSQL text search through a retrieval RPC.
- Fetch extra candidates before app-side reranking.
- Apply lightweight profile-aware app-side reranking for better chunk relevance.
- Return citation-ready chunk rows only.

Integration notes:
- This service still uses the existing text-search RPC.
- This file does not introduce vector/semantic retrieval.
- This file does not change the `/api/ai/*` contract.
- Full hybrid semantic retrieval remains a separate future module.
"""

import re
import time
from typing import Any, Dict, List, Optional

import asyncpg

from core.config import settings
from core.database import Database
from core.logging import get_logger
from modules.ai.retrieval_profiles import (
    get_retrieval_profile_hints,
    resolve_retrieval_profile,
)

logger = get_logger(__name__)

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
    "show",
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

GENERIC_SECTION_PENALTIES = {
    "about",
    "contact",
    "contents",
    "copyright",
    "foreword",
    "index",
    "introduction",
    "overview",
    "preface",
    "references",
}

GENERIC_CONTENT_PENALTIES = {
    "all rights reserved",
    "copyright",
    "table of contents",
}

TARGET_TERM_HINTS = {
    "admission": {"admission", "eligibility", "application", "merit", "entry test"},
    "admitted": {"admission", "eligibility", "merit", "selected", "candidate"},
    "application": {"application", "apply", "form", "submit", "required"},
    "approval": {"approve", "approval", "authority", "registrar"},
    "approve": {"approve", "approval", "authority", "registrar"},
    "attendance": {"attendance", "class", "lecture", "percentage", "shortage"},
    "deadline": {"deadline", "before", "date", "period", "last date"},
    "discipline": {"discipline", "misconduct", "penalty", "committee"},
    "documents": {"required", "documents", "form", "evidence", "id"},
    "dues": {"dues", "fee", "payment", "clearance"},
    "eligibility": {"eligibility", "eligible", "requirement", "criteria"},
    "fee": {"fee", "dues", "tuition", "payment", "refund"},
    "fees": {"fee", "dues", "tuition", "payment", "refund"},
    "freeze": {"freeze", "semester", "inactive", "permission"},
    "hostel": {"hostel", "accommodation", "dues", "room"},
    "merit": {"merit", "admission", "list", "criteria"},
    "payment": {"payment", "fee", "dues", "challan"},
    "refund": {"refund", "tuition", "fee", "return"},
    "required": {"required", "documents", "form", "evidence", "id"},
    "rule": {"rule", "regulation", "policy", "allowed", "not allowed"},
    "rules": {"rule", "regulation", "policy", "allowed", "not allowed"},
    "scholarship": {"scholarship", "financial aid", "award", "eligible"},
    "semester": {"semester", "freeze", "academic", "term"},
    "tuition": {"refund", "tuition", "fee", "dues"},
    "withdrawal": {"withdrawal", "drop", "semester", "application"},
}

IMPORTANT_PHRASES = {
    "admission eligibility",
    "attendance rule",
    "controller of examinations",
    "entry test",
    "fee structure",
    "financial aid",
    "hostel fee",
    "library rules",
    "merit list",
    "official notice",
    "registrar office",
    "semester freeze",
    "tuition fee",
    "withdrawal policy",
}

MAX_FETCH_MULTIPLIER = 3
MIN_EXTRA_FETCH_CANDIDATES = 5


class RetrievalService:
    """
    Stateless retrieval helper for official university documents.
    """

    @staticmethod
    def normalize_query(query: str) -> str:
        """
        Normalize a query used by direct retrieval endpoints.

        Args:
            query (str): Raw query text.

        Returns:
            str: Whitespace-collapsed query.

        Raises:
            RuntimeError: If query is too short.
        """

        normalized = re.sub(r"\s+", " ", query or "").strip()

        if len(normalized) < 3:
            raise RuntimeError("Invalid input")

        return normalized

    @staticmethod
    def normalize_assistant_query(query: str) -> str:
        """
        Normalize an assistant query while allowing short greetings.

        Args:
            query (str): Raw assistant query.

        Returns:
            str: Whitespace-collapsed query.

        Raises:
            RuntimeError: If query is empty.
        """

        normalized = re.sub(r"\s+", " ", query or "").strip()

        if not normalized:
            raise RuntimeError("Invalid input")

        return normalized

    @staticmethod
    async def search_university_document_chunks(
        user_id: str,
        request_id: Optional[str],
        query: str,
        top_k: int,
        similarity_threshold: float,
        document_type: Optional[str],
        audience_scope: Optional[str],
        department: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        Search official university document chunks and rerank the results.

        Args:
            user_id (str): Authenticated user ID.
            request_id (Optional[str]): Request ID for structured logs.
            query (str): Retrieval query.
            top_k (int): Number of final chunks needed by the caller.
            similarity_threshold (float): RPC similarity threshold.
            document_type (Optional[str]): Optional document type filter.
            audience_scope (Optional[str]): Optional audience filter.
            department (Optional[str]): Optional department filter.

        Returns:
            List[Dict[str, Any]]: Reranked citation-ready chunk rows.

        Raises:
            RuntimeError: If the retrieval RPC fails.
        """

        started_at = time.perf_counter()
        requested_top_k = RetrievalService._clamp_top_k(top_k)
        fetch_top_k = RetrievalService._resolve_fetch_top_k(requested_top_k)
        normalized_query = RetrievalService.normalize_assistant_query(query)
        inferred_profile = resolve_retrieval_profile(normalized_query)
        profile_hints = get_retrieval_profile_hints(inferred_profile.name)

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )
                rows = await connection.fetch(
                    """
                    select *
                    from library.search_university_document_chunks_text(
                        $1::text,
                        $2::integer,
                        $3::double precision,
                        $4::text,
                        $5::text,
                        $6::text
                    )
                    """,
                    normalized_query,
                    fetch_top_k,
                    similarity_threshold,
                    document_type,
                    audience_scope,
                    department,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: retrieval rpc failed",
                extra={
                    "request_id": request_id,
                    "user_id": user_id,
                    "query_length": len(normalized_query),
                    "requested_top_k": requested_top_k,
                    "fetch_top_k": fetch_top_k,
                    "similarity_threshold": similarity_threshold,
                    "document_type": document_type,
                    "audience_scope": audience_scope,
                    "department": department,
                    "profile_name": inferred_profile.name,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Retrieval RPC failed") from exc

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        results = [dict(row) for row in rows]
        reranked_results = RetrievalService._rerank_results(
            query=normalized_query,
            items=results,
            profile_hints=profile_hints,
        )[:requested_top_k]

        logger.info(
            "AI: retrieval query completed",
            extra={
                "request_id": request_id,
                "user_id": user_id,
                "query_length": len(normalized_query),
                "requested_top_k": requested_top_k,
                "fetch_top_k": fetch_top_k,
                "similarity_threshold": similarity_threshold,
                "document_type": document_type,
                "audience_scope": audience_scope,
                "department": department,
                "profile_name": inferred_profile.name,
                "matches_returned_before_rerank": len(results),
                "matches_returned_after_rerank": len(reranked_results),
                "latency_ms": latency_ms,
            },
        )

        return reranked_results

    @staticmethod
    def _clamp_top_k(top_k: int) -> int:
        """
        Clamp requested top-k into a safe retrieval range.

        Args:
            top_k (int): Requested top-k.

        Returns:
            int: Bounded top-k.
        """

        try:
            requested = int(top_k)
        except (TypeError, ValueError):
            requested = int(settings.document_retrieval_default_top_k)

        return max(1, min(requested, int(settings.document_retrieval_max_top_k)))

    @staticmethod
    def _resolve_fetch_top_k(requested_top_k: int) -> int:
        """
        Resolve how many candidates to fetch before reranking.

        Fetching more candidates improves app-side reranking while preserving
        the final output size expected by the caller.

        Args:
            requested_top_k (int): Final number of requested chunks.

        Returns:
            int: Candidate count sent to the RPC.
        """

        candidate_count = max(
            requested_top_k * MAX_FETCH_MULTIPLIER,
            requested_top_k + MIN_EXTRA_FETCH_CANDIDATES,
            requested_top_k,
        )

        return min(candidate_count, int(settings.document_retrieval_max_top_k))

    @staticmethod
    def _rerank_results(
        *,
        query: str,
        items: List[Dict[str, Any]],
        profile_hints: tuple[str, ...],
    ) -> List[Dict[str, Any]]:
        """
        Rerank raw retrieval results using lightweight query/profile signals.

        Args:
            query (str): Retrieval query.
            items (List[Dict[str, Any]]): Raw RPC result rows.
            profile_hints (tuple[str, ...]): Profile-specific scoring hints.

        Returns:
            List[Dict[str, Any]]: Reranked rows.
        """

        if not items:
            return items

        scored_items: list[tuple[float, Dict[str, Any]]] = []

        for item in items:
            final_score = RetrievalService._score_result(
                query=query,
                item=item,
                profile_hints=profile_hints,
            )
            scored_items.append((final_score, item))

        scored_items.sort(
            key=lambda pair: (
                pair[0],
                RetrievalService._safe_float(pair[1].get("similarity_score")),
            ),
            reverse=True,
        )

        return [item for _, item in scored_items]

    @staticmethod
    def _score_result(
        *,
        query: str,
        item: Dict[str, Any],
        profile_hints: tuple[str, ...],
    ) -> float:
        """
        Score one retrieval result for app-side reranking.

        Args:
            query (str): Retrieval query.
            item (Dict[str, Any]): Raw result row.
            profile_hints (tuple[str, ...]): Profile-specific hint terms.

        Returns:
            float: Reranking score.
        """

        base_similarity = RetrievalService._safe_float(item.get("similarity_score"))
        query_tokens = RetrievalService._significant_tokens(query)
        query_phrases = RetrievalService._important_phrases(query)

        section_text = str(item.get("section_label") or "").lower()
        title_text = str(item.get("document_title") or "").lower()
        filename_text = str(item.get("original_filename") or "").lower()
        content_text = str(item.get("content") or "").lower()

        section_tokens = RetrievalService._significant_tokens(section_text)
        title_tokens = RetrievalService._significant_tokens(title_text)
        filename_tokens = RetrievalService._significant_tokens(filename_text)
        content_tokens = RetrievalService._significant_tokens(content_text)

        section_overlap = len(query_tokens & section_tokens)
        title_overlap = len(query_tokens & title_tokens)
        filename_overlap = len(query_tokens & filename_tokens)
        content_overlap = len(query_tokens & content_tokens)

        score = base_similarity
        score += min(section_overlap * 0.16, 0.72)
        score += min(title_overlap * 0.11, 0.44)
        score += min(filename_overlap * 0.08, 0.24)
        score += min(content_overlap * 0.035, 0.55)

        score += RetrievalService._phrase_boost(
            phrases=query_phrases,
            section_text=section_text,
            title_text=title_text,
            filename_text=filename_text,
            content_text=content_text,
        )
        score += RetrievalService._target_term_boost(
            query=query,
            section_text=section_text,
            title_text=title_text,
            content_text=content_text,
        )
        score += RetrievalService._profile_hint_boost(
            profile_hints=profile_hints,
            section_text=section_text,
            title_text=title_text,
            filename_text=filename_text,
            content_text=content_text,
        )
        score += RetrievalService._generic_penalty(
            query=query,
            section_text=section_text,
            content_text=content_text,
        )

        if not section_text.strip():
            score -= 0.03

        return score

    @staticmethod
    def _safe_float(value: object) -> float:
        """
        Convert a value to float safely.

        Args:
            value (object): Raw value.

        Returns:
            float: Parsed float, or 0.0 on failure.
        """

        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _important_phrases(text: str) -> set[str]:
        """
        Extract important known phrases from text.

        Args:
            text (str): Source text.

        Returns:
            set[str]: Important phrases present in the text.
        """

        lowered = (text or "").lower()
        return {
            phrase
            for phrase in IMPORTANT_PHRASES
            if RetrievalService._contains_phrase(lowered, phrase)
        }

    @staticmethod
    def _contains_phrase(text: str, phrase: str) -> bool:
        """
        Check whether a phrase appears with word boundaries.

        Args:
            text (str): Source text.
            phrase (str): Phrase to find.

        Returns:
            bool: True when the phrase is present as a phrase.
        """

        escaped = re.escape(phrase)
        pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
        return re.search(pattern, text) is not None

    @staticmethod
    def _phrase_boost(
        *,
        phrases: set[str],
        section_text: str,
        title_text: str,
        filename_text: str,
        content_text: str,
    ) -> float:
        """
        Score phrase matches across section, title, filename, and content.

        Args:
            phrases (set[str]): Important phrases found in the query.
            section_text (str): Section label text.
            title_text (str): Document title text.
            filename_text (str): Original filename text.
            content_text (str): Chunk content text.

        Returns:
            float: Phrase match boost.
        """

        boost = 0.0

        for phrase in phrases:
            if RetrievalService._contains_phrase(section_text, phrase):
                boost += 0.36
            if RetrievalService._contains_phrase(title_text, phrase):
                boost += 0.28
            if RetrievalService._contains_phrase(filename_text, phrase):
                boost += 0.18
            if RetrievalService._contains_phrase(content_text, phrase):
                boost += 0.16

        return min(boost, 0.90)

    @staticmethod
    def _target_term_boost(
        *,
        query: str,
        section_text: str,
        title_text: str,
        content_text: str,
    ) -> float:
        """
        Apply task-specific target term boosts.

        Args:
            query (str): Retrieval query.
            section_text (str): Section label text.
            title_text (str): Document title text.
            content_text (str): Chunk content text.

        Returns:
            float: Target-term boost.
        """

        boost = 0.0
        lowered_query = query.lower()

        for query_term, target_terms in TARGET_TERM_HINTS.items():
            if not RetrievalService._contains_phrase(lowered_query, query_term):
                continue

            for target in target_terms:
                if RetrievalService._contains_phrase(section_text, target):
                    boost += 0.20
                elif RetrievalService._contains_phrase(title_text, target):
                    boost += 0.16
                elif RetrievalService._contains_phrase(content_text, target):
                    boost += 0.09

        return min(boost, 0.75)

    @staticmethod
    def _profile_hint_boost(
        *,
        profile_hints: tuple[str, ...],
        section_text: str,
        title_text: str,
        filename_text: str,
        content_text: str,
    ) -> float:
        """
        Apply retrieval-profile-specific hint boosts.

        Args:
            profile_hints (tuple[str, ...]): Hint terms from retrieval profile.
            section_text (str): Section label text.
            title_text (str): Document title text.
            filename_text (str): Original filename text.
            content_text (str): Chunk content text.

        Returns:
            float: Profile hint boost.
        """

        boost = 0.0

        for hint in profile_hints:
            normalized_hint = hint.lower().strip()
            if not normalized_hint:
                continue

            if RetrievalService._contains_phrase(section_text, normalized_hint):
                boost += 0.11
            elif RetrievalService._contains_phrase(title_text, normalized_hint):
                boost += 0.09
            elif RetrievalService._contains_phrase(filename_text, normalized_hint):
                boost += 0.06
            elif RetrievalService._contains_phrase(content_text, normalized_hint):
                boost += 0.04

        return min(boost, 0.45)

    @staticmethod
    def _generic_penalty(
        *,
        query: str,
        section_text: str,
        content_text: str,
    ) -> float:
        """
        Penalize generic chunks when the query does not ask for generic content.

        Args:
            query (str): Retrieval query.
            section_text (str): Section label text.
            content_text (str): Chunk content text.

        Returns:
            float: Negative score adjustment.
        """

        penalty = 0.0
        lowered_query = query.lower()

        if "contact" in section_text and "contact" not in lowered_query:
            penalty -= 0.30

        if any(generic in section_text for generic in GENERIC_SECTION_PENALTIES):
            penalty -= 0.10

        if any(generic in content_text for generic in GENERIC_CONTENT_PENALTIES):
            penalty -= 0.10

        return penalty

    @staticmethod
    def _normalize_token(token: str) -> str:
        """
        Normalize one token for lightweight matching.

        Args:
            token (str): Raw token.

        Returns:
            str: Normalized token.
        """

        if len(token) > 4 and token.endswith("ies"):
            return f"{token[:-3]}y"

        if len(token) > 4 and token.endswith("es"):
            return token[:-2]

        if len(token) > 3 and token.endswith("s"):
            return token[:-1]

        return token

    @staticmethod
    def _significant_tokens(text: str) -> set[str]:
        """
        Extract normalized significant tokens from text.

        Args:
            text (str): Source text.

        Returns:
            set[str]: Meaningful normalized tokens.
        """

        raw_tokens = re.findall(r"[a-z0-9]+", (text or "").lower())

        return {
            RetrievalService._normalize_token(token)
            for token in raw_tokens
            if len(token) > 2 and token not in STOP_WORDS
        }