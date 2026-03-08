# apps/api/modules/queue/service.py
"""
Queue Service Layer for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Execute PostgreSQL RPC calls for queue actions.
- Log structured database-facing events.
- Preserve database validation messages for route-layer mapping.

Architectural Constraints:
- No route logic.
- No queue business rules.
- No direct table queries beyond calling RPC functions.
- PostgreSQL remains the source of truth for queue policy.
"""

from uuid import UUID

import asyncpg

from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)


class QueueService:
    """
    Thin RPC wrapper for queue operations.
    """

    @staticmethod
    async def join_queue(user_id: str, book_id: UUID) -> None:
        """
        Join a waiting queue through PostgreSQL RPC.

        Args:
            user_id (str): Authenticated user UUID from request context.
            book_id (UUID): Target book UUID.

        Raises:
            RuntimeError: Preserved PostgreSQL validation message.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select library.join_queue($1::uuid, $2::uuid);",
                    user_id,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "QUEUE: join queue RPC failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    async def cancel_queue(user_id: str, book_id: UUID) -> None:
        """
        Cancel an active queue entry through PostgreSQL RPC.

        Args:
            user_id (str): Authenticated user UUID from request context.
            book_id (UUID): Target book UUID.

        Raises:
            RuntimeError: Preserved PostgreSQL validation message.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select library.cancel_queue($1::uuid, $2::uuid);",
                    user_id,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "QUEUE: cancel queue RPC failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
