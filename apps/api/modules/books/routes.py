# apps/api/modules/books/routes.py
"""
Routes for the Books Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose the public catalog routes without leaking staff-only inventory data.
- Expose dedicated staff inventory reads through admin-prefixed routes.
- Keep mutation/business logic out of FastAPI and inside PostgreSQL RPCs.
- Apply route-sensitive rate limiting and truthful HTTP error mapping.
"""

import time
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import RateLimitTier, enforce_rate_limit
from modules.books.schemas import (
    BOOK_DETAIL_SUCCESS_EXAMPLE,
    BOOK_QUEUE_STATUS_SUCCESS_EXAMPLE,
    BOOKS_LIST_SUCCESS_EXAMPLE,
    CREATE_BOOK_SUCCESS_EXAMPLE,
    DELETE_BOOK_SUCCESS_EXAMPLE,
    STAFF_BOOK_DETAIL_SUCCESS_EXAMPLE,
    STAFF_BOOKS_LIST_SUCCESS_EXAMPLE,
    UPDATE_BOOK_SUCCESS_EXAMPLE,
    BookDetailData,
    BookDetailResponse,
    BookIdData,
    BookIdResponse,
    BookQueueStatusData,
    BookQueueStatusResponse,
    BooksListData,
    BooksListResponse,
    CreateBookRequest,
    EmptyData,
    SimpleMessageResponse,
    StaffBookDetailData,
    StaffBookDetailResponse,
    StaffBooksListData,
    StaffBooksListQueryParams,
    StaffBooksListResponse,
    UpdateBookRequest,
)
from modules.books.service import BooksService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/books", tags=["Books"])
admin_router = APIRouter(prefix="/api/admin/books", tags=["Books Inventory"])

PUBLIC_LIST_ERROR_RESPONSES = {
    400: {"description": "Invalid request parameters"},
    500: {"description": "Internal Server Error"},
}

PUBLIC_DETAIL_ERROR_RESPONSES = {
    404: {"description": "Book not found"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

QUEUE_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    404: {"description": "Book not found"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

STAFF_LIST_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    422: {"description": "Validation Error"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

STAFF_DETAIL_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Book not found"},
    422: {"description": "Validation Error"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

CREATE_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    422: {"description": "Validation Error"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

UPDATE_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Book not found"},
    422: {"description": "Validation Error"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

DELETE_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Book not found"},
    409: {"description": "Book deletion is blocked by active or historical state"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}


def _require_user_id(request: Request) -> str:
    """
    Extract the authenticated user ID from request state.
    """

    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user_id


def _resolve_books_runtime_error_status(message: str) -> int:
    """
    Map deterministic PostgreSQL/runtime failures to truthful HTTP responses.
    """

    normalized = message.lower()

    if "authentication required" in normalized:
        return status.HTTP_401_UNAUTHORIZED

    if "insufficient privileges" in normalized or "user profile not found" in normalized:
        return status.HTTP_403_FORBIDDEN

    if "book not found" in normalized:
        return status.HTTP_404_NOT_FOUND

    if (
        "book has borrowing history; deletion blocked" in normalized
        or "book has active queue; deletion blocked" in normalized
    ):
        return status.HTTP_409_CONFLICT

    if (
        "title is required" in normalized
        or "author is required" in normalized
        or "invalid replacement cost" in normalized
        or "invalid fine per day rate" in normalized
        or "invalid override borrow duration" in normalized
        or "invalid status transition" in normalized
        or "invalid input value for enum" in normalized
    ):
        return status.HTTP_422_UNPROCESSABLE_ENTITY

    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _enforce_books_rate_limit(
    request: Request,
    *,
    tier: RateLimitTier,
    user_id: str | None = None,
    subject_hint: str | None = None,
) -> None:
    """
    Apply route-sensitive throttling for the books surface.
    """

    await enforce_rate_limit(
        request=request,
        tier=tier,
        user_id=user_id,
        subject_hint=subject_hint,
    )


@router.get(
    "",
    response_model=BooksListResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Public catalog retrieved successfully",
            "content": {
                "application/json": {
                    "example": BOOKS_LIST_SUCCESS_EXAMPLE,
                }
            },
        },
        **PUBLIC_LIST_ERROR_RESPONSES,
    },
)
async def get_public_books(
    request: Request,
    cursor_created_at: Optional[datetime] = Query(
        None,
        description="Composite cursor timestamp for pagination.",
    ),
    cursor_id: Optional[UUID] = Query(
        None,
        description="Composite cursor UUID for pagination.",
    ),
    limit: int = Query(
        20,
        ge=1,
        le=100,
        description="Number of catalog rows to fetch (max 100).",
    ),
) -> BooksListResponse:
    """
    Retrieve the public catalog list.
    """

    logger.info(
        "BOOKS: public catalog request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "cursor_created_at": (
                cursor_created_at.isoformat() if cursor_created_at else None
            ),
            "cursor_id": str(cursor_id) if cursor_id else None,
            "limit": limit,
            "outcome": "request",
        },
    )

    try:
        result = await BooksService.get_public_catalog(
            cursor_created_at=cursor_created_at,
            cursor_id=cursor_id,
            limit=limit,
            user_id=getattr(request.state, "user_id", None),
            role=getattr(request.state, "role", None),
        )
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: public catalog failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "cursor_created_at": (
                    cursor_created_at.isoformat() if cursor_created_at else None
                ),
                "cursor_id": str(cursor_id) if cursor_id else None,
                "limit": limit,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: public catalog success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "returned_items": len(result["items"]),
            "next_cursor_id": (
                str(result["next_cursor_id"]) if result["next_cursor_id"] else None
            ),
            "outcome": "success",
        },
    )

    return BooksListResponse(
        status=200,
        message="Public catalog retrieved successfully",
        data=BooksListData(**result),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/{book_id}",
    response_model=BookDetailResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book retrieved successfully",
            "content": {
                "application/json": {
                    "example": BOOK_DETAIL_SUCCESS_EXAMPLE,
                }
            },
        },
        **PUBLIC_DETAIL_ERROR_RESPONSES,
    },
)
async def get_book_by_id(
    request: Request,
    book_id: UUID,
) -> BookDetailResponse:
    """
    Retrieve one public-safe book detail record.
    """

    rate_limit_tier: RateLimitTier = "book_public_detail"
    await _enforce_books_rate_limit(
        request,
        tier=rate_limit_tier,
        subject_hint=str(book_id),
    )

    logger.info(
        "BOOKS: public detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await BooksService.get_book_by_id(book_id=book_id)
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: public detail failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "book_id": str(book_id),
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: public detail success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return BookDetailResponse(
        status=200,
        message="Book retrieved successfully",
        data=BookDetailData(book=result),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/{book_id}/queue",
    response_model=BookQueueStatusResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book queue status retrieved successfully",
            "content": {
                "application/json": {
                    "example": BOOK_QUEUE_STATUS_SUCCESS_EXAMPLE,
                }
            },
        },
        **QUEUE_ERROR_RESPONSES,
    },
)
async def get_book_queue_status(
    request: Request,
    book_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> BookQueueStatusResponse:
    """
    Retrieve authenticated queue visibility for one selected book.
    """

    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "book_queue_read"

    await _enforce_books_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(book_id),
    )

    logger.info(
        "BOOKS: queue detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await BooksService.get_book_queue_status(book_id)
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: queue detail failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: queue detail success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return BookQueueStatusResponse(
        status=200,
        message="Book queue status retrieved successfully",
        data=BookQueueStatusData(queue=result),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "",
    response_model=BookIdResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book created successfully",
            "content": {
                "application/json": {
                    "example": CREATE_BOOK_SUCCESS_EXAMPLE,
                }
            },
        },
        **CREATE_ERROR_RESPONSES,
    },
)
async def create_book(
    request: Request,
    payload: CreateBookRequest,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> BookIdResponse:
    """
    Create one new book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "book_mutation"

    await _enforce_books_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=payload.title,
    )

    logger.info(
        "BOOKS: create request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "title": payload.title,
            "category": payload.category,
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        book_id = await BooksService.create_book(user_id, payload)
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: create failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "title": payload.title,
                "category": payload.category,
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: create success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return BookIdResponse(
        status=200,
        message="Book created successfully",
        data=BookIdData(book_id=book_id),
        timestamp_ms=int(time.time() * 1000),
    )


@router.patch(
    "/{book_id}",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book updated successfully",
            "content": {
                "application/json": {
                    "example": UPDATE_BOOK_SUCCESS_EXAMPLE,
                }
            },
        },
        **UPDATE_ERROR_RESPONSES,
    },
)
async def update_book(
    request: Request,
    book_id: UUID,
    payload: UpdateBookRequest,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Update one existing book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "book_mutation"

    await _enforce_books_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(book_id),
    )

    logger.info(
        "BOOKS: update request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        await BooksService.update_book(user_id, book_id, payload)
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: update failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: update success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return SimpleMessageResponse(
        status=200,
        message="Book updated successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.delete(
    "/{book_id}",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book deleted successfully",
            "content": {
                "application/json": {
                    "example": DELETE_BOOK_SUCCESS_EXAMPLE,
                }
            },
        },
        **DELETE_ERROR_RESPONSES,
    },
)
async def delete_book(
    request: Request,
    book_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Delete one book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "book_mutation"

    await _enforce_books_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(book_id),
    )

    logger.info(
        "BOOKS: delete request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        await BooksService.delete_book(user_id, book_id)
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: delete failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: delete success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return SimpleMessageResponse(
        status=200,
        message="Book deleted successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@admin_router.get(
    "",
    response_model=StaffBooksListResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Staff inventory retrieved successfully",
            "content": {
                "application/json": {
                    "example": STAFF_BOOKS_LIST_SUCCESS_EXAMPLE,
                }
            },
        },
        **STAFF_LIST_ERROR_RESPONSES,
    },
)
async def get_staff_books(
    request: Request,
    query: StaffBooksListQueryParams = Depends(),
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StaffBooksListResponse:
    """
    Retrieve the dedicated staff inventory directory.
    """

    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "book_staff_read"
    subject_hint = f"limit:{query.limit}|offset:{query.offset}"

    await _enforce_books_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=subject_hint,
    )

    logger.info(
        "BOOKS: staff inventory request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "limit": query.limit,
            "offset": query.offset,
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await BooksService.get_staff_books(user_id, query)
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: staff inventory failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "limit": query.limit,
                "offset": query.offset,
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: staff inventory success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "returned_items": len(result["items"]),
            "total": result["total"],
            "limit": result["limit"],
            "offset": result["offset"],
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return StaffBooksListResponse(
        status=200,
        message="Staff inventory retrieved successfully",
        data=StaffBooksListData(**result),
        timestamp_ms=int(time.time() * 1000),
    )


@admin_router.get(
    "/{book_id}",
    response_model=StaffBookDetailResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Staff book retrieved successfully",
            "content": {
                "application/json": {
                    "example": STAFF_BOOK_DETAIL_SUCCESS_EXAMPLE,
                }
            },
        },
        **STAFF_DETAIL_ERROR_RESPONSES,
    },
)
async def get_staff_book_by_id(
    request: Request,
    book_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StaffBookDetailResponse:
    """
    Retrieve one staff inventory detail record.
    """

    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "book_staff_read"

    await _enforce_books_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(book_id),
    )

    logger.info(
        "BOOKS: staff detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await BooksService.get_staff_book_by_id(user_id, book_id)
    except RuntimeError as exc:
        http_status = _resolve_books_runtime_error_status(str(exc))
        logger.error(
            "BOOKS: staff detail failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: staff detail success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return StaffBookDetailResponse(
        status=200,
        message="Staff book retrieved successfully",
        data=StaffBookDetailData(book=result),
        timestamp_ms=int(time.time() * 1000),
    )
