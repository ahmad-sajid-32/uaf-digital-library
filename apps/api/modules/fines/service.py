# apps/api/modules/fines/service.py
"""
Service layer for the Fines Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Execute PostgreSQL fine-settlement RPCs.
- Set authenticated user identity in session context before RPC calls.
- Preserve database errors for deterministic route-level mapping.
"""

from typing import Optional
from uuid import UUID

import asyncpg

from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)


class FinesService:
    """
    Thin RPC wrapper for fine settlement endpoints.
    """

    @staticmethod
    async def pay_fine(user_id: str, fine_id: UUID) -> None:
        """
        Mark a pending fine as paid via PostgreSQL RPC.
        """

        await FinesService._execute_void_rpc(
            user_id=user_id,
            fine_id=fine_id,
            action="pay",
            query="select library.pay_fine($1::uuid)",
            parameters=(fine_id,),
        )

    @staticmethod
    async def waive_fine(user_id: str, fine_id: UUID, reason: Optional[str]) -> None:
        """
        Mark a pending fine as waived via PostgreSQL RPC.
        """

        await FinesService._execute_void_rpc(
            user_id=user_id,
            fine_id=fine_id,
            action="waive",
            query="select library.waive_fine($1::uuid, $2::text)",
            parameters=(fine_id, reason),
        )

    @staticmethod
    async def _execute_void_rpc(
        user_id: str,
        fine_id: UUID,
        action: str,
        query: str,
        parameters: tuple[object, ...],
    ) -> None:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )
                await connection.execute(query, *parameters)
        except asyncpg.PostgresError as exc:
            logger.error(
                "FINES: settlement RPC failed",
                extra={
                    "user_id": user_id,
                    "fine_id": str(fine_id),
                    "action": action,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
