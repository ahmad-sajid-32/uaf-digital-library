# apps/api/modules/borrow/routes.py
"""
Borrow Module - Routes

Responsibilities:
- Expose authenticated borrow lifecycle endpoints.
- Validate request bodies.
- Call borrow service layer only.
- Map preserved database validation messages to HTTP responses.
- Emit structured logs for request start, success, and failure.

Architectural Constraints:
- No business logic.
- No borrowing policy enforcement in Python.
- No raw SQL in route handlers.
- PostgreSQL RPC is the only execution path.
"""

import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from modules.borrow.schemas import (
    BORROW_SUCCESS_EXAMPLE,
    RETURN_SUCCESS_EXAMPLE,
    RENEW_SUCCESS_EXAMPLE,
    BorrowActionRequest,
    EmptyData,
    SimpleMessageResponse,
)
from modules.borrow.service import BorrowService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(
    prefix="/api/borrow",
    tags=["Borrow"],
)


def _resolve_runtime_error_status(message: str) -> int:
    """
    Map known PostgreSQL validation messages to HTTP status codes.

    Args:
        message (str): Preserved runtime error message.

    Returns:
        int: HTTP status code.
    """

    if "Book not found" in message:
        return status.HTTP_404_NOT_FOUND

    if "Outstanding fines exceed allowed threshold" in message:
        return status.HTTP_403_FORBIDDEN

    if "Borrow blocked: overdue books must be returned first" in message:
        return status.HTTP_403_FORBIDDEN

    conflict_messages = [
        "Book not available",
        "Book already borrowed",
        "Borrow limit exceeded",
        "Active transaction not found",
        "Renewal limit reached",
        "Cannot renew, book reserved by another user",
        "Book is reserved for another user in queue",
        "Your hold has expired",
    ]

    for known_message in conflict_messages:
        if known_message in message:
            return status.HTTP_409_CONFLICT

    return status.HTTP_400_BAD_REQUEST


def _require_user_id(request: Request) -> str:
    """
    Extract authenticated user ID from request context.

    Args:
        request (Request): FastAPI request object.

    Returns:
        str: Authenticated user UUID.

    Raises:
        HTTPException: If authentication context is missing.
    """

    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user_id


def _log_request_start(
    action: str,
    request: Request,
    user_id: str,
    book_id: str,
) -> None:
    logger.info(
        f"BORROW: {action} request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": book_id,
        },
    )


def _log_request_success(
    action: str,
    request: Request,
    user_id: str,
    book_id: str,
) -> None:
    logger.info(
        f"BORROW: {action} success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": book_id,
        },
    )


def _log_request_error(
    action: str,
    request: Request,
    user_id: str,
    book_id: str,
    error: str,
    status_code: int,
) -> None:
    logger.error(
        f"BORROW: {action} failed",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "book_id": book_id,
            "error": error,
            "status_code": status_code,
        },
    )


@router.post(
    "/borrow",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book borrowed successfully",
            "content": {
                "application/json": {
                    "example": BORROW_SUCCESS_EXAMPLE,
                }
            },
        },
    },
)
async def borrow_book(
    request: Request,
    payload: BorrowActionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Borrow a book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)
    request_id = getattr(request.state, "request_id", None)
    book_id = str(payload.book_id)

    _log_request_start("borrow", request, user_id, book_id)

    try:
        await BorrowService.borrow_book(user_id, payload.book_id, request_id=request_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_runtime_error_status(message)
        _log_request_error("borrow", request, user_id, book_id, message, http_status)
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        _log_request_error(
            "borrow",
            request,
            user_id,
            book_id,
            str(exc),
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

    _log_request_success("borrow", request, user_id, book_id)
    return SimpleMessageResponse(
        status=200,
        message="Borrowed",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/return",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book returned successfully",
            "content": {
                "application/json": {
                    "example": RETURN_SUCCESS_EXAMPLE,
                }
            },
        },
    },
)
async def return_book(
    request: Request,
    payload: BorrowActionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Return a book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)
    request_id = getattr(request.state, "request_id", None)
    book_id = str(payload.book_id)

    _log_request_start("return", request, user_id, book_id)

    try:
        await BorrowService.return_book(user_id, payload.book_id, request_id=request_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_runtime_error_status(message)
        _log_request_error("return", request, user_id, book_id, message, http_status)
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        _log_request_error(
            "return",
            request,
            user_id,
            book_id,
            str(exc),
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

    _log_request_success("return", request, user_id, book_id)
    return SimpleMessageResponse(
        status=200,
        message="Returned",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/renew",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Book renewed successfully",
            "content": {
                "application/json": {
                    "example": RENEW_SUCCESS_EXAMPLE,
                }
            },
        },
    },
)
async def renew_book(
    request: Request,
    payload: BorrowActionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Renew a book through PostgreSQL RPC.
    """

    user_id = _require_user_id(request)
    request_id = getattr(request.state, "request_id", None)
    book_id = str(payload.book_id)

    _log_request_start("renew", request, user_id, book_id)

    try:
        await BorrowService.renew_book(user_id, payload.book_id, request_id=request_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_runtime_error_status(message)
        _log_request_error("renew", request, user_id, book_id, message, http_status)
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        _log_request_error(
            "renew",
            request,
            user_id,
            book_id,
            str(exc),
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error",
        ) from exc

    _log_request_success("renew", request, user_id, book_id)
    return SimpleMessageResponse(
        status=200,
        message="Renewed",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
