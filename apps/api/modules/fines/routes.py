# apps/api/modules/fines/routes.py
"""
Routes for the Fines Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose authenticated fine-settlement endpoints.
- Keep settlement business logic out of route handlers.
- Map deterministic database errors to HTTP responses.
"""

import time

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import enforce_rate_limit
from modules.fines.schemas import (
    EmptyData,
    PAY_FINE_SUCCESS_EXAMPLE,
    SimpleMessageResponse,
    WAIVE_FINE_SUCCESS_EXAMPLE,
    WaiveFineRequest,
)
from modules.fines.service import FinesService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/fines", tags=["Fines"])


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user_id


def _resolve_runtime_error_status(message: str) -> int:
    if "Authentication required" in message:
        return status.HTTP_401_UNAUTHORIZED

    if "Insufficient privileges" in message:
        return status.HTTP_403_FORBIDDEN

    if "Fine not found" in message:
        return status.HTTP_404_NOT_FOUND

    if "Fine already settled" in message:
        return status.HTTP_409_CONFLICT

    if "Fine is not pending" in message:
        return status.HTTP_409_CONFLICT

    if "Invalid waive reason" in message:
        return status.HTTP_422_UNPROCESSABLE_ENTITY

    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _enforce_fine_settlement_rate_limit(
    request: Request,
    *,
    user_id: str,
    subject_hint: str,
) -> None:
    """
    Apply fine-settlement throttling for pay and waive actions.
    """

    await enforce_rate_limit(
        request=request,
        tier="fine_settlement",
        user_id=user_id,
        subject_hint=subject_hint,
    )


@router.post(
    "/{fine_id}/pay",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Fine marked as paid",
            "content": {"application/json": {"example": PAY_FINE_SUCCESS_EXAMPLE}},
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "Fine not found"},
        409: {"description": "Fine is already resolved or not pending"},
        422: {"description": "Validation Error"},
        429: {"description": "Too Many Requests"},
        500: {"description": "Internal Server Error"},
    },
)
async def pay_fine(
    request: Request,
    fine_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)
    await _enforce_fine_settlement_rate_limit(
        request,
        user_id=user_id,
        subject_hint=f"pay:{fine_id}",
    )

    logger.info(
        "FINES: pay fine request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "fine_id": str(fine_id),
            "action": "pay",
            "rate_limit_tier": "fine_settlement",
            "outcome": "request",
        },
    )

    try:
        await FinesService.pay_fine(user_id, fine_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "FINES: pay fine failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "fine_id": str(fine_id),
                "action": "pay",
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": "fine_settlement",
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "FINES: pay fine success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "fine_id": str(fine_id),
            "action": "pay",
            "rate_limit_tier": "fine_settlement",
            "outcome": "success",
        },
    )

    return SimpleMessageResponse(
        status=200,
        message="Fine marked as paid",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/{fine_id}/waive",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Fine waived",
            "content": {"application/json": {"example": WAIVE_FINE_SUCCESS_EXAMPLE}},
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "Fine not found"},
        409: {"description": "Fine is already resolved or not pending"},
        422: {"description": "Validation Error"},
        429: {"description": "Too Many Requests"},
        500: {"description": "Internal Server Error"},
    },
)
async def waive_fine(
    request: Request,
    fine_id: UUID,
    payload: WaiveFineRequest,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)
    await _enforce_fine_settlement_rate_limit(
        request,
        user_id=user_id,
        subject_hint=f"waive:{fine_id}",
    )

    logger.info(
        "FINES: waive fine request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "fine_id": str(fine_id),
            "action": "waive",
            "rate_limit_tier": "fine_settlement",
            "outcome": "request",
        },
    )

    try:
        await FinesService.waive_fine(user_id, fine_id, payload.reason)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "FINES: waive fine failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "fine_id": str(fine_id),
                "action": "waive",
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": "fine_settlement",
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "FINES: waive fine success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "fine_id": str(fine_id),
            "action": "waive",
            "rate_limit_tier": "fine_settlement",
            "outcome": "success",
        },
    )

    return SimpleMessageResponse(
        status=200,
        message="Fine waived",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
