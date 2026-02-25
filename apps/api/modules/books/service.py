# apps/api/modules/books/service.py
"""
Books Module - Service Layer

Responsibilities:
- Execute RPC call: library.get_public_catalog
- Apply cursor-based pagination parameters
- Inject RLS session context (if authenticated request)
- Construct next cursor response
- Perform structured logging

Architectural Constraints:
- No raw SQL SELECT queries.
- No business logic.
- All database operations go through RPC.
- Service layer is pure orchestration.

This module is database-facing only.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime

import asyncpg

from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)


class BooksService:
    """
    Service class responsible for catalog retrieval.
    """

    @staticmethod
    async def get_public_catalog(
        cursor_created_at: Optional[datetime],
        cursor_id: Optional[UUID],
        limit: int,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve paginated public catalog via RPC.

        Args:
            cursor_created_at (Optional[datetime]):
                Composite cursor timestamp.
            cursor_id (Optional[UUID]):
                Composite cursor UUID.
            limit (int):
                Maximum records requested.
            user_id (Optional[str]):
                Authenticated user ID (if available).
            role (Optional[str]):
                Authenticated role (if available).

        Returns:
            Dict[str, Any]:
                {
                    "items": [...],
                    "next_cursor_created_at": datetime | None,
                    "next_cursor_id": UUID | None
                }

        Raises:
            RuntimeError: If database operation fails.
        """

        logger.info(
            "BOOKS: fetching public catalog",
            extra={
                "cursor_created_at": str(cursor_created_at),
                "cursor_id": str(cursor_id),
                "limit": limit,
            },
        )

        pool = Database.get_pool()

        async with pool.acquire() as connection:  

            # Inject RLS session context if authenticated
            if user_id:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

            if role:
                await connection.execute(
                    "select set_config('request.jwt.claim.role', $1, true)",
                    role,
                )

            try:
                rows = await connection.fetch(
                    """
                    select *
                    from library.get_public_catalog(
                        $1::timestamptz,
                        $2::uuid,
                        $3::integer
                    )
                    """,
                    cursor_created_at,
                    cursor_id,
                    limit,
                )

            except Exception as exc:
                logger.error(
                    "BOOKS: RPC execution failed",
                    extra={"error": str(exc)},
                )
                raise RuntimeError("Failed to fetch public catalog") from exc

        items: List[Dict[str, Any]] = [dict(row) for row in rows]

        # Determine next cursor (if page full)
        next_cursor_created_at: Optional[datetime] = None
        next_cursor_id: Optional[UUID] = None

        if items:
            last_item = items[-1]
            next_cursor_created_at = last_item["created_at"]
            next_cursor_id = last_item["id"]

        logger.info(
            "BOOKS: catalog fetch completed",
            extra={
                "items_returned": len(items),
                "next_cursor_id": str(next_cursor_id),
            },
        )

        return {
            "items": items,
            "next_cursor_created_at": next_cursor_created_at,
            "next_cursor_id": next_cursor_id,
        }