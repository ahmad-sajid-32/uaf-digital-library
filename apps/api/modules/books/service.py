# apps/api/modules/books/service.py
"""
Books Module - Service Layer

Responsibilities:
- Execute PostgreSQL RPC calls for public catalog, staff inventory reads,
  selected-book queue status, book management, and book-cover metadata updates.
- Upload and delete book-cover objects through Supabase Storage using the
  service-role key.
- Inject request user identity into the database session context where needed.
- Preserve database validation messages for route-layer mapping.
- Emit structured service-level logs.

Architectural Constraints:
- No authorization rules in Python.
- No raw table mutation logic outside RPC calls.
- PostgreSQL remains the source of truth for mutation policy.
- Supabase Storage stores the binary cover file; PostgreSQL stores only stable
  cover metadata and object paths.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import quote
from uuid import UUID

import asyncpg
import httpx
from fastapi import UploadFile

from core.config import settings
from core.database import Database
from core.logging import get_logger
from modules.books.schemas import (
    CreateBookRequest,
    StaffBooksListQueryParams,
    UpdateBookRequest,
)

logger = get_logger(__name__)


class BooksService:
    """
    Service class responsible for book catalog and management operations.
    """

    BOOK_COVER_BUCKET_NAME = "book-covers"
    BOOK_COVER_MAX_SIZE_BYTES = 2_097_152
    BOOK_COVER_ALLOWED_MIME_TYPES = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
    BOOK_COVER_EXTENSION_BY_MIME_TYPE = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }

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

        items: List[Dict[str, Any]] = [
            BooksService._with_cover_public_url(dict(row)) for row in rows
        ]
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

        result = BooksService._with_cover_public_url(dict(row))

        logger.info(
            "BOOKS: single book fetch completed",
            extra={"book_id": str(book_id)},
        )

        return result

    @staticmethod
    async def get_staff_books(
        user_id: str,
        query: StaffBooksListQueryParams,
    ) -> Dict[str, Any]:
        """
        Retrieve paginated staff inventory rows through PostgreSQL RPC.
        """

        logger.info(
            "BOOKS: fetching staff inventory",
            extra={
                "user_id": user_id,
                "limit": query.limit,
                "offset": query.offset,
            },
        )

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                raw = await connection.fetchval(
                    """
                    select library.get_staff_books(
                        $1::uuid,
                        $2::integer,
                        $3::integer
                    )
                    """,
                    user_id,
                    query.limit,
                    query.offset,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: staff inventory RPC failed",
                extra={
                    "user_id": user_id,
                    "limit": query.limit,
                    "offset": query.offset,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
        except Exception as exc:
            logger.error(
                "BOOKS: staff inventory failed unexpectedly",
                extra={
                    "user_id": user_id,
                    "limit": query.limit,
                    "offset": query.offset,
                    "error": str(exc),
                },
            )
            raise RuntimeError("Failed to fetch staff inventory") from exc

        result = BooksService._normalize_jsonb_mapping(
            raw,
            null_message="Staff inventory RPC returned null",
            invalid_json_message="Staff inventory RPC returned invalid JSON",
            invalid_shape_message="Staff inventory RPC returned non-object JSON",
            unexpected_type_message="Staff inventory RPC returned unexpected payload type",
            log_context={
                "user_id": user_id,
                "limit": query.limit,
                "offset": query.offset,
            },
        )

        items = result.get("items")
        if isinstance(items, list):
            result["items"] = [
                BooksService._with_cover_public_url(item)
                for item in items
                if isinstance(item, dict)
            ]

        return result

    @staticmethod
    async def get_staff_book_by_id(
        user_id: str,
        book_id: UUID,
    ) -> Dict[str, Any]:
        """
        Retrieve a single staff inventory book by UUID through PostgreSQL RPC.
        """

        logger.info(
            "BOOKS: fetching staff book detail",
            extra={"user_id": user_id, "book_id": str(book_id)},
        )

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                row = await connection.fetchrow(
                    """
                    select *
                    from library.get_staff_book_by_id($1::uuid, $2::uuid)
                    """,
                    user_id,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: staff book detail RPC failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
        except Exception as exc:
            logger.error(
                "BOOKS: staff book detail failed unexpectedly",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "error": str(exc),
                },
            )
            raise RuntimeError("Failed to fetch staff book") from exc

        if row is None:
            raise RuntimeError("Book not found")

        return BooksService._with_cover_public_url(dict(row))

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
        Delete a book through PostgreSQL RPC and best-effort remove its cover file.
        """

        existing_book = await BooksService.get_staff_book_by_id(user_id, book_id)
        existing_cover_path = existing_book.get("cover_image_path")

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

        if isinstance(existing_cover_path, str) and existing_cover_path.strip():
            try:
                await BooksService._delete_storage_object(existing_cover_path)
            except RuntimeError as exc:
                logger.warning(
                    "BOOKS: cover cleanup failed after book delete",
                    extra={
                        "user_id": user_id,
                        "book_id": str(book_id),
                        "cover_image_path": existing_cover_path,
                        "error": str(exc),
                    },
                )

    @staticmethod
    async def upload_book_cover(
        user_id: str,
        book_id: UUID,
        file: UploadFile,
        cover_image_alt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Upload or replace a book cover image.

        Flow:
        1. Verify the book is staff-visible through the existing staff detail RPC.
        2. Validate file MIME type and size.
        3. Upload the object to the public `book-covers` bucket.
        4. Persist cover metadata through `library.set_book_cover_metadata`.
        5. Best-effort remove the previous cover if the object path changed.

        Args:
            user_id (str): Authenticated staff/admin user UUID from request state.
            book_id (UUID): Book UUID that owns the cover image.
            file (UploadFile): Uploaded JPEG, PNG, or WEBP cover image.
            cover_image_alt (Optional[str]): Optional human-readable alt text.

        Returns:
            Dict[str, Any]: Cover metadata including the public cover URL.

        Raises:
            RuntimeError: On invalid file, failed storage upload, failed metadata
                persistence, or failed authorization/book lookup.
        """

        existing_book = await BooksService.get_staff_book_by_id(user_id, book_id)
        previous_cover_path = existing_book.get("cover_image_path")

        content = await file.read()
        mime_type = BooksService._validate_cover_upload(file=file, content=content)
        object_path = BooksService._build_cover_object_path(book_id, mime_type)
        normalized_alt = BooksService._normalize_cover_alt(
            cover_image_alt=cover_image_alt,
            fallback_title=str(existing_book.get("title") or "book"),
        )

        await BooksService._upload_storage_object(
            object_path=object_path,
            content=content,
            mime_type=mime_type,
        )

        try:
            metadata = await BooksService._set_book_cover_metadata(
                user_id=user_id,
                book_id=book_id,
                cover_image_path=object_path,
                cover_image_alt=normalized_alt,
                cover_image_mime_type=mime_type,
                cover_image_size_bytes=len(content),
            )
        except RuntimeError:
            await BooksService._delete_storage_object_after_failed_metadata(
                user_id=user_id,
                book_id=book_id,
                object_path=object_path,
            )
            raise

        if (
            isinstance(previous_cover_path, str)
            and previous_cover_path.strip()
            and previous_cover_path != object_path
        ):
            try:
                await BooksService._delete_storage_object(previous_cover_path)
            except RuntimeError as exc:
                logger.warning(
                    "BOOKS: previous cover cleanup failed after replacement",
                    extra={
                        "user_id": user_id,
                        "book_id": str(book_id),
                        "previous_cover_image_path": previous_cover_path,
                        "error": str(exc),
                    },
                )

        logger.info(
            "BOOKS: cover upload completed",
            extra={
                "user_id": user_id,
                "book_id": str(book_id),
                "cover_image_path": object_path,
                "cover_image_mime_type": mime_type,
                "cover_image_size_bytes": len(content),
            },
        )

        return BooksService._with_cover_public_url(metadata)

    @staticmethod
    async def delete_book_cover(user_id: str, book_id: UUID) -> Dict[str, Any]:
        """
        Delete a book cover image and clear its metadata through PostgreSQL RPC.

        Args:
            user_id (str): Authenticated staff/admin user UUID from request state.
            book_id (UUID): Book UUID whose cover image should be removed.

        Returns:
            Dict[str, Any]: Cleared cover metadata and previous cover URL/path.

        Raises:
            RuntimeError: On failed authorization, missing book, storage failure,
                or metadata-clearing failure.
        """

        existing_book = await BooksService.get_staff_book_by_id(user_id, book_id)
        previous_cover_path = existing_book.get("cover_image_path")

        if isinstance(previous_cover_path, str) and previous_cover_path.strip():
            await BooksService._delete_storage_object(previous_cover_path)

        metadata = await BooksService._clear_book_cover_metadata(
            user_id=user_id,
            book_id=book_id,
        )

        logger.info(
            "BOOKS: cover delete completed",
            extra={
                "user_id": user_id,
                "book_id": str(book_id),
                "previous_cover_image_path": previous_cover_path,
            },
        )

        return BooksService._with_previous_cover_public_url(
            BooksService._with_cover_public_url(metadata)
        )

    @staticmethod
    async def _set_book_cover_metadata(
        *,
        user_id: str,
        book_id: UUID,
        cover_image_path: str,
        cover_image_alt: str,
        cover_image_mime_type: str,
        cover_image_size_bytes: int,
    ) -> Dict[str, Any]:
        """
        Persist uploaded cover metadata through PostgreSQL RPC.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                row = await connection.fetchrow(
                    """
                    select *
                    from library.set_book_cover_metadata(
                        $1::uuid,
                        $2::uuid,
                        $3::text,
                        $4::text,
                        $5::text,
                        $6::integer
                    )
                    """,
                    user_id,
                    book_id,
                    cover_image_path,
                    cover_image_alt,
                    cover_image_mime_type,
                    cover_image_size_bytes,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: set cover metadata RPC failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "cover_image_path": cover_image_path,
                    "cover_image_mime_type": cover_image_mime_type,
                    "cover_image_size_bytes": cover_image_size_bytes,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Cover metadata update failed")

        return dict(row)

    @staticmethod
    async def _clear_book_cover_metadata(
        *,
        user_id: str,
        book_id: UUID,
    ) -> Dict[str, Any]:
        """
        Clear cover metadata through PostgreSQL RPC.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                row = await connection.fetchrow(
                    """
                    select *
                    from library.clear_book_cover_metadata(
                        $1::uuid,
                        $2::uuid
                    )
                    """,
                    user_id,
                    book_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "BOOKS: clear cover metadata RPC failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Cover metadata clear failed")

        return dict(row)

    @staticmethod
    async def _upload_storage_object(
        *,
        object_path: str,
        content: bytes,
        mime_type: str,
    ) -> None:
        """
        Upload a public book-cover object to Supabase Storage.
        """

        endpoint = BooksService._build_storage_object_endpoint(object_path)
        headers = BooksService._storage_headers(content_type=mime_type)
        headers["x-upsert"] = "true"

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                endpoint,
                headers=headers,
                content=content,
            )

        if response.is_error:
            logger.error(
                "BOOKS: cover storage upload failed",
                extra={
                    "bucket_name": BooksService.BOOK_COVER_BUCKET_NAME,
                    "cover_image_path": object_path,
                    "status_code": response.status_code,
                    "error": response.text[:500],
                },
            )
            raise RuntimeError("Book cover storage upload failed")

    @staticmethod
    async def _delete_storage_object(object_path: str) -> bool:
        """
        Delete a public book-cover object from Supabase Storage if it exists.
        """

        endpoint = BooksService._build_storage_object_endpoint(object_path)

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.delete(
                endpoint,
                headers=BooksService._storage_headers(),
            )

        if response.status_code == 404:
            logger.warning(
                "BOOKS: cover storage object already missing during delete",
                extra={
                    "bucket_name": BooksService.BOOK_COVER_BUCKET_NAME,
                    "cover_image_path": object_path,
                },
            )
            return False

        if response.is_error:
            logger.error(
                "BOOKS: cover storage delete failed",
                extra={
                    "bucket_name": BooksService.BOOK_COVER_BUCKET_NAME,
                    "cover_image_path": object_path,
                    "status_code": response.status_code,
                    "error": response.text[:500],
                },
            )
            raise RuntimeError("Book cover storage delete failed")

        return True

    @staticmethod
    async def _delete_storage_object_after_failed_metadata(
        *,
        user_id: str,
        book_id: UUID,
        object_path: str,
    ) -> None:
        """
        Best-effort cleanup for a cover object uploaded before metadata failed.
        """

        try:
            await BooksService._delete_storage_object(object_path)
        except RuntimeError as exc:
            logger.warning(
                "BOOKS: cover rollback cleanup failed",
                extra={
                    "user_id": user_id,
                    "book_id": str(book_id),
                    "cover_image_path": object_path,
                    "error": str(exc),
                },
            )

    @staticmethod
    def _validate_cover_upload(*, file: UploadFile, content: bytes) -> str:
        """
        Validate uploaded cover transport properties.
        """

        mime_type = (file.content_type or "").strip().lower()

        if mime_type not in BooksService.BOOK_COVER_ALLOWED_MIME_TYPES:
            raise RuntimeError("Invalid cover image MIME type")

        if not content:
            raise RuntimeError("Cover image file is required")

        if len(content) > BooksService.BOOK_COVER_MAX_SIZE_BYTES:
            raise RuntimeError("Cover image file is too large")

        return mime_type

    @staticmethod
    def _normalize_cover_alt(
        *,
        cover_image_alt: Optional[str],
        fallback_title: str,
    ) -> str:
        """
        Normalize cover alt text with a deterministic fallback.
        """

        if cover_image_alt and cover_image_alt.strip():
            return " ".join(cover_image_alt.strip().split())[:255]

        normalized_title = " ".join(fallback_title.strip().split()) or "book"
        return f"Cover image for {normalized_title}"[:255]

    @staticmethod
    def _build_cover_object_path(book_id: UUID, mime_type: str) -> str:
        """
        Build the canonical object path for a book cover.
        """

        extension = BooksService.BOOK_COVER_EXTENSION_BY_MIME_TYPE.get(mime_type)

        if not extension:
            raise RuntimeError("Invalid cover image MIME type")

        return f"books/{book_id}/cover.{extension}"

    @staticmethod
    def _build_storage_object_endpoint(object_path: str) -> str:
        """
        Build the Supabase Storage object API endpoint for a cover object.
        """

        encoded_path = BooksService._encode_object_path(object_path)
        return (
            f"{BooksService._storage_base_url()}/object/"
            f"{quote(BooksService.BOOK_COVER_BUCKET_NAME, safe='')}/{encoded_path}"
        )

    @staticmethod
    def _build_cover_public_url(object_path: Optional[str]) -> Optional[str]:
        """
        Build the public URL for a stored cover object path.
        """

        if not object_path:
            return None

        encoded_path = BooksService._encode_object_path(object_path)
        return (
            f"{BooksService._storage_base_url()}/object/public/"
            f"{quote(BooksService.BOOK_COVER_BUCKET_NAME, safe='')}/{encoded_path}"
        )

    @staticmethod
    def _with_cover_public_url(item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add public cover URL to any book/cover metadata mapping.
        """

        item["cover_image_url"] = BooksService._build_cover_public_url(
            item.get("cover_image_path")
        )
        return item

    @staticmethod
    def _with_previous_cover_public_url(item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add public URL for previous cover path returned by clear metadata RPC.
        """

        item["previous_cover_image_url"] = BooksService._build_cover_public_url(
            item.get("previous_cover_image_path")
        )
        return item

    @staticmethod
    def _storage_headers(content_type: Optional[str] = None) -> Dict[str, str]:
        """
        Build Supabase Storage service-role headers.
        """

        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }

        if content_type:
            headers["Content-Type"] = content_type

        return headers

    @staticmethod
    def _storage_base_url() -> str:
        """
        Return Supabase Storage API base URL.
        """

        return f"{settings.supabase_project_url.rstrip('/')}/storage/v1"

    @staticmethod
    def _encode_object_path(object_path: str) -> str:
        """
        URL-encode each object-path segment without flattening slashes.
        """

        return "/".join(quote(segment, safe="") for segment in object_path.split("/"))

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
        """
        Normalize a json/jsonb RPC payload into a Python mapping.
        """

        if raw is None:
            logger.error(
                "BOOKS: jsonb RPC returned null",
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
                    "BOOKS: failed to decode jsonb RPC payload",
                    extra={
                        **log_context,
                        "error": str(exc),
                        "raw_preview": raw[:200],
                    },
                )
                raise RuntimeError(invalid_json_message) from exc

            if not isinstance(parsed, dict):
                logger.error(
                    "BOOKS: decoded jsonb payload is not an object",
                    extra={
                        **log_context,
                        "decoded_type": type(parsed).__name__,
                    },
                )
                raise RuntimeError(invalid_shape_message)

            return parsed

        logger.error(
            "BOOKS: unexpected jsonb RPC return type",
            extra={
                **log_context,
                "return_type": type(raw).__name__,
            },
        )
        raise RuntimeError(unexpected_type_message)