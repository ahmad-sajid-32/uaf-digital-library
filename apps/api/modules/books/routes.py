# apps/api/modules/books/routes.py
"""
Books Module - Routes

Responsibilities:
- Expose public catalog listing endpoint.
- Expose authenticated book management endpoints.
- Validate request data.
- Call service layer only.
- Map preserved database validation messages to HTTP responses.

Architectural Constraints:
- No business logic.
- No raw SQL.
- No authorization rules in Python.
- All database operations go through BooksService -> RPC.
"""

import time

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from modules.books.schemas import (
    BOOK_DETAIL_SUCCESS_EXAMPLE,
    BOOK_QUEUE_STATUS_SUCCESS_EXAMPLE,
    BOOKS_LIST_SUCCESS_EXAMPLE,
    BookDetailData,
    BookDetailResponse,
    BookQueueStatusData,
    BookQueueStatusResponse,
    BookIdResponse,
    BookIdData,
    BooksListResponse,
    BooksListData,
    CREATE_BOOK_SUCCESS_EXAMPLE,
    CreateBookRequest,
    DELETE_BOOK_SUCCESS_EXAMPLE,
    EmptyData,
    SimpleMessageResponse,
    UPDATE_BOOK_SUCCESS_EXAMPLE,
    UpdateBookRequest,
)
from modules.books.service import BooksService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(
    prefix="/api/books",
    tags=["Books"],
)


def _require_user_id(request: Request) -> str:
    """
    Extract authenticated user ID from request context.
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
    Map known PostgreSQL validation messages to HTTP status codes.
    """

    if "Insufficient privileges" in message:
        return status.HTTP_403_FORBIDDEN

    if "Book not found" in message:
        return status.HTTP_404_NOT_FOUND

    if (
        "Book has borrowing history; deletion blocked" in message
        or "Book has active queue; deletion blocked" in message
    ):
        return status.HTTP_409_CONFLICT

    return status.HTTP_400_BAD_REQUEST


@router.get(
    "",
    response_model=BooksListResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Public catalog retrieved successfully",
            "content": {
                "application/json": {
                    "example": BOOKS_LIST_SUCCESS_EXAMPLE
                }
            },
        },
        400: {"description": "Invalid request parameters"},
        500: {"description": "Internal server error"},
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
        description="Number of records to fetch (max 100).",
    ),
) -> BooksListResponse:
    """
    Public catalog endpoint.
    """

    logger.info(
        "BOOKS: GET /api/books",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "cursor_created_at": str(cursor_created_at),
            "cursor_id": str(cursor_id),
            "limit": limit,
        },
    )

    result = await BooksService.get_public_catalog(
        cursor_created_at=cursor_created_at,
        cursor_id=cursor_id,
        limit=limit,
        user_id=getattr(request.state, "user_id", None),
        role=getattr(request.state, "role", None),
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
                    "example": BOOK_DETAIL_SUCCESS_EXAMPLE
                }
            },
        },
        404: {"description": "Book not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_book_by_id(
    request: Request,
    book_id: UUID,
) -> BookDetailResponse:
    """
    Retrieve a single book by UUID.
    """

    logger.info(
        "BOOKS: GET /api/books/{book_id}",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "book_id": str(book_id),
        },
    )

    try:
        result = await BooksService.get_book_by_id(
            book_id=book_id,
            user_id=getattr(request.state, "user_id", None),
            role=getattr(request.state, "role", None),
        )
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_books_runtime_error_status(message)
        logger.error(
            "BOOKS: get single book failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "book_id": str(book_id),
                "error": message,
                "status_code": http_status,
            },
        )
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        logger.error(
            "BOOKS: get single book failed unexpectedly",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "book_id": str(book_id),
                "error": str(exc),
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

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
                    "example": BOOK_QUEUE_STATUS_SUCCESS_EXAMPLE
                }
            },
        },
        404: {"description": "Book not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_book_queue_status(
    request: Request,
    book_id: UUID,
) -> BookQueueStatusResponse:
    """
    Retrieve public-safe queue status for a single book by UUID.
    """

    logger.info(
        "BOOKS: GET /api/books/{book_id}/queue",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "book_id": str(book_id),
        },
    )

    try:
        result = await BooksService.get_book_queue_status(book_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_books_runtime_error_status(message)
        logger.error(
            "BOOKS: get book queue status failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "book_id": str(book_id),
                "error": message,
                "status_code": http_status,
            },
        )
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        logger.error(
            "BOOKS: get book queue status failed unexpectedly",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "book_id": str(book_id),
                "error": str(exc),
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

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
                    "example": CREATE_BOOK_SUCCESS_EXAMPLE
                }
            },
        },
    },
)
async def create_book(
    request: Request,
    payload: CreateBookRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> BookIdResponse:
    """
    Create a new book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)

    logger.info(
        "BOOKS: create book request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "title": payload.title,
            "category": payload.category,
        },
    )

    try:
        book_id = await BooksService.create_book(user_id, payload)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_books_runtime_error_status(message)
        logger.error(
            "BOOKS: create book failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "error": message,
                "status_code": http_status,
            },
        )
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        logger.error(
            "BOOKS: create book failed unexpectedly",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "error": str(exc),
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: create book success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
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
                    "example": UPDATE_BOOK_SUCCESS_EXAMPLE
                }
            },
        },
    },
)
async def update_book(
    request: Request,
    book_id: UUID,
    payload: UpdateBookRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Update an existing book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)

    logger.info(
        "BOOKS: update book request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
        },
    )

    try:
        await BooksService.update_book(user_id, book_id, payload)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_books_runtime_error_status(message)
        logger.error(
            "BOOKS: update book failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "error": message,
                "status_code": http_status,
            },
        )
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        logger.error(
            "BOOKS: update book failed unexpectedly",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "error": str(exc),
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: update book success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
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
                    "example": DELETE_BOOK_SUCCESS_EXAMPLE
                }
            },
        },
    },
)
async def delete_book(
    request: Request,
    book_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Delete a book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)

    logger.info(
        "BOOKS: delete book request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
        },
    )

    try:
        await BooksService.delete_book(user_id, book_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_books_runtime_error_status(message)
        logger.error(
            "BOOKS: delete book failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "error": message,
                "status_code": http_status,
            },
        )
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        logger.error(
            "BOOKS: delete book failed unexpectedly",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "book_id": str(book_id),
                "error": str(exc),
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

    logger.info(
        "BOOKS: delete book success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": str(book_id),
        },
    )

    return SimpleMessageResponse(
        status=200,
        message="Book deleted successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
