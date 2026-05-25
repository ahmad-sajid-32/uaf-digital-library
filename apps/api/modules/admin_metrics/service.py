# apps/api/modules/admin_metrics/service.py
"""
Admin Metrics Module - Service Layer

Responsibilities:
- Execute the admin metrics PostgreSQL RPC.
- Set authenticated user identity in session context before RPC execution.
- Normalize jsonb return into a Python mapping for schema hydration.
- Preserve database privilege and validation errors for route-level mapping.

Notes:
- asyncpg may return json/jsonb as a str depending on codec configuration.
  This service normalizes it deterministically to Dict[str, Any].
"""

from __future__ import annotations

import json
from typing import Any, Dict

import asyncpg

from core.database import Database
from core.logging import get_logger
from modules.books.service import BooksService

logger = get_logger(__name__)


class AdminMetricsService:
    """
    Thin RPC wrapper for admin metrics reads.
    """

    @staticmethod
    def _with_ranked_book_cover_urls(payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add public cover URLs to ranked book metric rows.
        """

        for key in ("popular_books", "queue_pressure"):
            items = payload.get(key)

            if not isinstance(items, list):
                continue

            payload[key] = [
                BooksService._with_cover_public_url(dict(item))
                if isinstance(item, dict)
                else item
                for item in items
            ]

        return payload

    @staticmethod
    async def get_dashboard_metrics(
        user_id: str,
        popular_limit: int,
        queue_limit: int,
    ) -> Dict[str, Any]:
        """
        Fetch admin dashboard metrics via RPC.

        Args:
            user_id (str): Authenticated user UUID (string).
            popular_limit (int): Max popular books returned by RPC.
            queue_limit (int): Max queue pressure rows returned by RPC.

        Returns:
            Dict[str, Any]: Parsed jsonb payload as a Python dict.

        Raises:
            RuntimeError: On database errors or unexpected payload types.
        """
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                raw = await connection.fetchval(
                    "select library.get_admin_metrics($1::uuid, $2::int, $3::int)",
                    user_id,
                    popular_limit,
                    queue_limit,
                )

        except asyncpg.PostgresError as exc:
            logger.error(
                "ADMIN_METRICS: dashboard RPC failed",
                extra={
                    "user_id": user_id,
                    "popular_limit": popular_limit,
                    "queue_limit": queue_limit,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if raw is None:
            logger.error(
                "ADMIN_METRICS: dashboard RPC returned null",
                extra={
                    "user_id": user_id,
                    "popular_limit": popular_limit,
                    "queue_limit": queue_limit,
                },
            )
            raise RuntimeError("Admin metrics RPC returned null")

        # Normalize jsonb result.
        if isinstance(raw, dict):
            return AdminMetricsService._with_ranked_book_cover_urls(raw)

        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as exc:
                logger.error(
                    "ADMIN_METRICS: failed to decode jsonb string",
                    extra={
                        "user_id": user_id,
                        "error": str(exc),
                        "raw_preview": raw[:200],
                    },
                )
                raise RuntimeError("Admin metrics RPC returned invalid JSON") from exc

            if not isinstance(parsed, dict):
                logger.error(
                    "ADMIN_METRICS: decoded JSON is not an object",
                    extra={
                        "user_id": user_id,
                        "decoded_type": type(parsed).__name__,
                    },
                )
                raise RuntimeError("Admin metrics RPC returned non-object JSON")

            return AdminMetricsService._with_ranked_book_cover_urls(parsed)

        logger.error(
            "ADMIN_METRICS: unexpected RPC return type",
            extra={
                "user_id": user_id,
                "return_type": type(raw).__name__,
            },
        )
        raise RuntimeError("Admin metrics RPC returned unexpected payload type")
