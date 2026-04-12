# apps/api/modules/librarian_metrics/service.py
"""
Service layer for the Librarian Metrics Module of the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Execute the librarian dashboard PostgreSQL read function.
- Reuse existing backend document lifecycle enrichment for document attention.
- Compose the final read-only operational dashboard payload without moving
  domain logic into the frontend.

Architectural Constraints:
- No HTTP route logic.
- No frontend formatting logic.
- No duplicate document lifecycle rules in Python when existing backend truth
  already exposes them through the documents service.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List

import asyncpg

from core.database import Database
from core.logging import get_logger
from modules.documents.service import DocumentsService

logger = get_logger(__name__)

DOCUMENT_ATTENTION_LIMIT = 5


class LibrarianMetricsService:
    """
    Thin read-model orchestration for librarian dashboard metrics.
    """

    @staticmethod
    async def get_dashboard_metrics(user_id: str) -> Dict[str, Any]:
        """
        Fetch the librarian dashboard metrics payload.

        Args:
            user_id (str): Authenticated librarian UUID as a string.

        Returns:
            Dict[str, Any]: Normalized dashboard payload.

        Raises:
            RuntimeError: On database failure, privilege failure, or invalid
                backend payload shape.
        """
        base_metrics = await LibrarianMetricsService._get_base_metrics(user_id)
        document_attention = await LibrarianMetricsService._get_document_attention(
            user_id
        )

        return {
            **base_metrics,
            "documents_requiring_action_count": document_attention["count"],
            "document_attention": document_attention["items"],
        }

    @staticmethod
    async def _get_base_metrics(user_id: str) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                raw = await connection.fetchval(
                    """
                    select library.get_librarian_dashboard_metrics($1::uuid)
                    """,
                    user_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "LIBRARIAN_METRICS: dashboard RPC failed",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return LibrarianMetricsService._normalize_jsonb_mapping(
            raw,
            null_message="Librarian metrics RPC returned null",
            invalid_json_message="Librarian metrics RPC returned invalid JSON",
            invalid_shape_message="Librarian metrics RPC returned non-object JSON",
            unexpected_type_message=(
                "Librarian metrics RPC returned unexpected payload type"
            ),
            log_context={"user_id": user_id},
        )

    @staticmethod
    async def _get_document_attention(user_id: str) -> Dict[str, Any]:
        documents = await DocumentsService.list_documents(user_id)
        actionable_documents = [
            item
            for item in documents
            if bool(
                item.get("can_finalize")
                or item.get("can_retry_finalize")
                or item.get("requires_reupload")
            )
        ]
        actionable_documents.sort(
            key=LibrarianMetricsService._get_document_attention_sort_key
        )

        return {
            "count": len(actionable_documents),
            "items": [
                {
                    "document_id": item["id"],
                    "title": item["title"],
                    "processing_status": item["processing_status"],
                    "can_finalize": item["can_finalize"],
                    "can_retry_finalize": item["can_retry_finalize"],
                    "requires_reupload": item["requires_reupload"],
                    "lifecycle_note": item["lifecycle_note"],
                }
                for item in actionable_documents[:DOCUMENT_ATTENTION_LIMIT]
            ],
        }

    @staticmethod
    def _get_document_attention_sort_key(item: Dict[str, Any]) -> tuple[int, float, str]:
        if item.get("requires_reupload"):
            priority = 0
        elif item.get("can_retry_finalize"):
            priority = 1
        else:
            priority = 2

        updated_at = item.get("updated_at") or item.get("created_at")
        updated_timestamp = (
            updated_at.timestamp() if isinstance(updated_at, datetime) else 0.0
        )

        return (priority, -updated_timestamp, str(item.get("id", "")))

    @staticmethod
    def _normalize_jsonb_mapping(
        raw: Any,
        *,
        null_message: str,
        invalid_json_message: str,
        invalid_shape_message: str,
        unexpected_type_message: str,
        log_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        if raw is None:
            logger.error(
                "LIBRARIAN_METRICS: jsonb RPC returned null",
                extra=log_context,
            )
            raise RuntimeError(null_message)

        if isinstance(raw, dict):
            return raw

        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as exc:
                logger.error(
                    "LIBRARIAN_METRICS: failed to decode jsonb RPC payload",
                    extra={
                        **log_context,
                        "error": str(exc),
                        "raw_preview": raw[:200],
                    },
                )
                raise RuntimeError(invalid_json_message) from exc

            if not isinstance(parsed, dict):
                logger.error(
                    "LIBRARIAN_METRICS: decoded jsonb payload is not an object",
                    extra={
                        **log_context,
                        "decoded_type": type(parsed).__name__,
                    },
                )
                raise RuntimeError(invalid_shape_message)

            return parsed

        logger.error(
            "LIBRARIAN_METRICS: unexpected jsonb RPC return type",
            extra={
                **log_context,
                "return_type": type(raw).__name__,
            },
        )
        raise RuntimeError(unexpected_type_message)
