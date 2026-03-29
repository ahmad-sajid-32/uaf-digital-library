# apps/api/modules/admin_fines/service.py
"""
Service layer for the Admin Fine History Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Execute PostgreSQL fine history read RPCs for librarian/admin users.
- Set authenticated user identity in session context before RPC calls.
- Preserve database errors for deterministic route-level mapping.
"""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

import asyncpg

from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)


class AdminFinesService:
    """
    Thin RPC wrapper for admin/librarian fine history endpoints.
    """

    @staticmethod
    async def get_fines(
        user_id: str,
        status: Optional[str],
        search: Optional[str],
        created_from: datetime | None,
        created_to: datetime | None,
        resolved_from: datetime | None,
        resolved_to: datetime | None,
        limit: int,
        offset: int,
    ) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        user_id,
                    )
                    rows = await connection.fetch(
                        """
                        select *
                        from library.get_admin_fines(
                            $1::library.fine_status_enum,
                            $2::text,
                            $3::timestamptz,
                            $4::timestamptz,
                            $5::timestamptz,
                            $6::timestamptz,
                            $7::int,
                            $8::int
                        )
                        """,
                        status,
                        search,
                        created_from,
                        created_to,
                        resolved_from,
                        resolved_to,
                        limit,
                        offset,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "ADMIN_FINES: get fines RPC failed",
                extra={
                    "user_id": user_id,
                    "status_filter": status,
                    "search_applied": bool(search),
                    "created_from": (
                        created_from.isoformat() if created_from is not None else None
                    ),
                    "created_to": (
                        created_to.isoformat() if created_to is not None else None
                    ),
                    "resolved_from": (
                        resolved_from.isoformat()
                        if resolved_from is not None
                        else None
                    ),
                    "resolved_to": (
                        resolved_to.isoformat() if resolved_to is not None else None
                    ),
                    "limit": limit,
                    "offset": offset,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        items: list[Dict[str, Any]] = []
        total = 0

        for row in rows:
            item = dict(row)
            total = int(item.pop("total_count", 0) or 0)
            items.append(item)

        return {
            "items": items,
            "total": total,
        }

    @staticmethod
    async def get_fine_detail(user_id: str, fine_id: UUID) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        user_id,
                    )
                    row = await connection.fetchrow(
                        "select * from library.get_admin_fine_detail($1::uuid)",
                        fine_id,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "ADMIN_FINES: get fine detail RPC failed",
                extra={
                    "user_id": user_id,
                    "fine_id": str(fine_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Fine not found")

        return dict(row)
