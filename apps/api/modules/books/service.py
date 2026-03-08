# apps/api/modules/books/service.py
"""
Books Module - Service Layer

Responsibilities:
- Execute PostgreSQL RPC calls for public catalog and book management.
- Inject request user identity into the database session context.
- Preserve database validation messages for route-layer mapping.
- Emit structured service-level logs.

Architectural Constraints:
- No business logic.
- No raw table mutation logic outside RPC calls.
- No authorization rules in Python.
- PostgreSQL remains the source of truth for mutation policy.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

import asyncpg

from core.database import Database
from core.logging import get_logger
from modules.books.schemas import CreateBookRequest, UpdateBookRequest

logger = get_logger(__name__)


class BooksService:
    """
    Service class responsible for book catalog and management operations.
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

    @staticmethod
    async def get_book_by_id(
        book_id: UUID,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve a single book by UUID through PostgreSQL RPC.
        """

        logger.info(
            "BOOKS: fetching single book",
            extra={"book_id": str(book_id)},
        )

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
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

                row = await connection.fetchrow(
                    """
                    select *
                    from library.get_book_by_id($1::uuid)
                    """,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: get single book RPC failed",
                extra={
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
        except Exception as exc:
            logger.error(
                "BOOKS: get single book failed unexpectedly",
                extra={"book_id": str(book_id), "error": str(exc)},
            )
            raise RuntimeError("Failed to fetch book") from exc

        if row is None:
            raise RuntimeError("Book not found")

        result = dict(row)

        logger.info(
            "BOOKS: single book fetch completed",
            extra={"book_id": str(book_id)},
        )

        return result

    @staticmethod
    async def get_book_queue_status(book_id: UUID) -> Dict[str, Any]:
        """
        Retrieve public-safe queue status for a single book through PostgreSQL RPC.
        """

        logger.info(
            "BOOKS: fetching book queue status",
            extra={"book_id": str(book_id)},
        )

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                row = await connection.fetchrow(
                    """
                    select *
                    from library.get_book_queue_status($1::uuid)
                    """,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: get book queue status RPC failed",
                extra={
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
        except Exception as exc:
            logger.error(
                "BOOKS: get book queue status failed unexpectedly",
                extra={"book_id": str(book_id), "error": str(exc)},
            )
            raise RuntimeError("Failed to fetch book queue status") from exc

        if row is None:
            raise RuntimeError("Book not found")

        return dict(row)

    @staticmethod
    async def create_book(user_id: str, payload: CreateBookRequest) -> UUID:
        """
        Create a book through PostgreSQL RPC.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                book_id = await connection.fetchval(
                    """
                    select library.create_book(
                        $1::uuid,
                        $2::text,
                        $3::text,
                        $4::library.book_category_enum,
                        $5::numeric,
                        $6::numeric,
                        $7::int
                    );
                    """,
                    user_id,
                    payload.title,
                    payload.author,
                    payload.category,
                    payload.replacement_cost,
                    payload.fine_per_day_rate,
                    payload.override_borrow_duration_days,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: create book RPC failed",
                extra={
                    "user_id": user_id,
                    "title": payload.title,
                    "category": payload.category,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return book_id

    @staticmethod
    async def update_book(
        user_id: str,
        book_id: UUID,
        payload: UpdateBookRequest,
    ) -> None:
        """
        Update a book through PostgreSQL RPC.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                await connection.execute(
                    """
                    select library.update_book(
                        $1::uuid,
                        $2::uuid,
                        $3::text,
                        $4::text,
                        $5::library.book_category_enum,
                        $6::library.book_status_enum,
                        $7::numeric,
                        $8::numeric,
                        $9::int
                    );
                    """,
                    user_id,
                    book_id,
                    payload.title,
                    payload.author,
                    payload.category,
                    payload.status,
                    payload.replacement_cost,
                    payload.fine_per_day_rate,
                    payload.override_borrow_duration_days,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: update book RPC failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    async def delete_book(user_id: str, book_id: UUID) -> None:
        """
        Delete a book through PostgreSQL RPC.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                await connection.execute(
                    """
                    select library.delete_book(
                        $1::uuid,
                        $2::uuid
                    );
                    """,
                    user_id,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: delete book RPC failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
