# apps/api/modules/borrow/service.py
"""
Borrow Service Layer for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Execute PostgreSQL RPC calls for borrow lifecycle actions.
- Set authenticated session identity for database-side authorization.
- Log structured database failures with preserved context.

Architectural Constraints:
- No business logic.
- No borrowing policy in Python.
- No direct table queries.
- PostgreSQL RPC remains the source of truth.
"""

from typing import Optional
from uuid import UUID

import asyncpg

from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)


class BorrowService:
    """
    Thin RPC wrapper for borrow lifecycle operations.
    """

    @staticmethod
    async def borrow_book(
        user_id: str,
        book_id: UUID,
        request_id: Optional[str] = None,
    ) -> None:
        """
        Borrow a book through PostgreSQL RPC.

        Args:
            user_id (str): Authenticated user UUID from request context.
            book_id (UUID): Target book UUID.
            request_id (Optional[str]): Request correlation identifier.

        Raises:
            RuntimeError: Preserved PostgreSQL validation message.
        """

        await BorrowService._execute_rpc(
            action="borrow",
            query="select library.borrow_book($1::uuid, $2::uuid);",
            user_id=user_id,
            book_id=book_id,
            request_id=request_id,
        )

    @staticmethod
    async def return_book(
        user_id: str,
        book_id: UUID,
        request_id: Optional[str] = None,
    ) -> None:
        """
        Return a book through PostgreSQL RPC.

        Args:
            user_id (str): Authenticated user UUID from request context.
            book_id (UUID): Target book UUID.
            request_id (Optional[str]): Request correlation identifier.

        Raises:
            RuntimeError: Preserved PostgreSQL validation message.
        """

        await BorrowService._execute_rpc(
            action="return",
            query="select library.return_book($1::uuid, $2::uuid);",
            user_id=user_id,
            book_id=book_id,
            request_id=request_id,
        )

    @staticmethod
    async def renew_book(
        user_id: str,
        book_id: UUID,
        request_id: Optional[str] = None,
    ) -> None:
        """
        Renew a book through PostgreSQL RPC.

        Args:
            user_id (str): Authenticated user UUID from request context.
            book_id (UUID): Target book UUID.
            request_id (Optional[str]): Request correlation identifier.

        Raises:
            RuntimeError: Preserved PostgreSQL validation message.
        """

        await BorrowService._execute_rpc(
            action="renew",
            query="select library.renew_book($1::uuid, $2::uuid);",
            user_id=user_id,
            book_id=book_id,
            request_id=request_id,
        )

    @staticmethod
    async def _execute_rpc(
        action: str,
        query: str,
        user_id: str,
        book_id: UUID,
        request_id: Optional[str],
    ) -> None:
        """
        Execute a borrow lifecycle RPC with request identity set for RLS.

        Args:
            action (str): Logical action name for logging.
            query (str): SQL RPC invocation query.
            user_id (str): Authenticated user UUID.
            book_id (UUID): Target book UUID.
            request_id (Optional[str]): Request correlation identifier.

        Raises:
            RuntimeError: Preserved PostgreSQL validation message.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )
                await connection.execute(
                    query,
                    user_id,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                f"BORROW: {action} RPC failed",
                extra={
                    "request_id": request_id,
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
