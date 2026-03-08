# apps/api/modules/admin_fines/service.py
"""
Service layer for the Admin Fine History Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Execute PostgreSQL fine history read RPCs for librarian/admin users.
- Set authenticated user identity in session context before RPC calls.
- Preserve database errors for deterministic route-level mapping.
"""

from typing import Any, Dict, List, Optional
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
        limit: int,
        offset: int,
    ) -> List[Dict[str, Any]]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )
                rows = await connection.fetch(
                    "select * from library.get_admin_fines($1::library.fine_status_enum, $2::int, $3::int)",
                    status,
                    limit,
                    offset,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "ADMIN_FINES: get fines RPC failed",
                extra={
                    "user_id": user_id,
                    "status_filter": status,
                    "limit": limit,
                    "offset": offset,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return [dict(row) for row in rows]

    @staticmethod
    async def get_fine_detail(user_id: str, fine_id: UUID) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
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
