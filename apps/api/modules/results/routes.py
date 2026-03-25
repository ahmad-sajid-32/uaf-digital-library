# apps/api/modules/results/routes.py
"""
Routes for the Results Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose authenticated LMS result retrieval.
- Keep scraping and parsing logic out of route handlers.
- Return normalized response envelopes.
"""

import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import hash_sensitive_value
from modules.results.schemas import (
    REG_NUMBER_PATTERN,
    RESULT_SUCCESS_EXAMPLE,
    ResultData,
    ResultResponse,
)
from modules.results.service import ResultsService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/me", tags=["Results"])
public_router = APIRouter(prefix="/api/public", tags=["Results"])


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


def _resolve_runtime_error_status(message: str) -> int:
    """
    Map deterministic service/runtime errors to HTTP status codes.
    """

    if "Authentication required" in message:
        return status.HTTP_401_UNAUTHORIZED

    if "Profile not found" in message:
        return status.HTTP_404_NOT_FOUND

    if "Invalid registration number format" in message:
        return status.HTTP_400_BAD_REQUEST

    if "Failed to fetch result HTML" in message or "Failed to parse result HTML" in message:
        return status.HTTP_502_BAD_GATEWAY

    return status.HTTP_500_INTERNAL_SERVER_ERROR


@router.get(
    "/result",
    response_model=ResultResponse,
    responses={
        200: {
            "description": "Result retrieved successfully",
            "content": {
                "application/json": {
                    "example": RESULT_SUCCESS_EXAMPLE,
                }
            },
        }
    },
)
async def get_my_result(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ResultResponse:
    """
    Retrieve the authenticated student's LMS result.
    """

    user_id = _require_user_id(request)

    logger.info(
        "RESULTS: get my result request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
        },
    )

    try:
        result = await ResultsService.get_my_result(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "RESULTS: get my result failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return ResultResponse(
        status=200,
        message="Result retrieved successfully",
        data=ResultData(**result),
        timestamp_ms=int(time.time() * 1000),
    )


@public_router.get(
    "/result",
    response_model=ResultResponse,
    responses={
        200: {
            "description": "Result retrieved successfully",
            "content": {
                "application/json": {
                    "example": RESULT_SUCCESS_EXAMPLE,
                }
            },
        }
    },
)
async def get_public_result(
    request: Request,
    reg_number: str = Query(
        ...,
        pattern=REG_NUMBER_PATTERN,
        description="Student registration number in UAF LMS format.",
    ),
) -> ResultResponse:
    """
    Retrieve a student's LMS result from a public registration number lookup.
    """

    logger.info(
        "RESULTS: public result request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "reg_number_hash": hash_sensitive_value(reg_number),
        },
    )

    try:
        result = await ResultsService.get_public_result(reg_number)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "RESULTS: public result failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "reg_number_hash": hash_sensitive_value(reg_number),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return ResultResponse(
        status=200,
        message="Result retrieved successfully",
        data=ResultData(**result),
        timestamp_ms=int(time.time() * 1000),
    )
