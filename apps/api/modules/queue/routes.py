# apps/api/modules/queue/routes.py
"""
Queue Module - Routes

Responsibilities:
- Expose authenticated queue action endpoints.
- Validate request bodies.
- Call queue service layer only.
- Map preserved database validation messages to HTTP responses.
- Emit structured logs for request start, success, and failure.

Architectural Constraints:
- No business logic.
- No queue policy enforcement in Python.
- No raw SQL in route handlers.
- PostgreSQL RPC is the only execution path.
"""

import time

from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from modules.queue.schemas import (
    CANCEL_QUEUE_SUCCESS_EXAMPLE,
    CancelQueueRequest,
    EmptyData,
    JOIN_QUEUE_SUCCESS_EXAMPLE,
    JoinQueueRequest,
    SimpleMessageResponse,
)
from modules.queue.service import QueueService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(
    prefix="/api/queue",
    tags=["Queue"],
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

    known_bad_request_messages = [
        "Queue is full",
        "Already in queue",
        "Book is available; borrow directly",
        "Active queue entry not found",
        "Queue not found",
    ]

    for known_message in known_bad_request_messages:
        if known_message in message:
            return status.HTTP_400_BAD_REQUEST

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
        f"QUEUE: {action} request",
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
        f"QUEUE: {action} success",
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
        f"QUEUE: {action} failed",
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
    "/join",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Queue joined successfully",
            "content": {
                "application/json": {
                    "example": JOIN_QUEUE_SUCCESS_EXAMPLE
                }
            },
        },
    },
)
async def join_queue(
    request: Request,
    payload: JoinQueueRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Join a book waiting queue.
    """

    user_id = _require_user_id(request)
    book_id = str(payload.book_id)

    _log_request_start("join queue", request, user_id, book_id)

    try:
        await QueueService.join_queue(user_id, payload.book_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_runtime_error_status(message)
        _log_request_error("join queue", request, user_id, book_id, message, http_status)
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        _log_request_error(
            "join queue",
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

    _log_request_success("join queue", request, user_id, book_id)
    return SimpleMessageResponse(
        status=200,
        message="Joined queue",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/cancel",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Queue entry cancelled successfully",
            "content": {
                "application/json": {
                    "example": CANCEL_QUEUE_SUCCESS_EXAMPLE
                }
            },
        },
    },
)
async def cancel_queue(
    request: Request,
    payload: CancelQueueRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Cancel an active queue entry.
    """

    user_id = _require_user_id(request)
    book_id = str(payload.book_id)

    _log_request_start("cancel queue", request, user_id, book_id)

    try:
        await QueueService.cancel_queue(user_id, payload.book_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_runtime_error_status(message)
        _log_request_error(
            "cancel queue",
            request,
            user_id,
            book_id,
            message,
            http_status,
        )
        raise HTTPException(status_code=http_status, detail=message) from exc
    except Exception as exc:
        _log_request_error(
            "cancel queue",
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

    _log_request_success("cancel queue", request, user_id, book_id)
    return SimpleMessageResponse(
        status=200,
        message="Queue entry cancelled",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
