# apps/api/modules/circulation/routes.py
"""
Routes for the Staff Circulation Management Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose librarian/admin circulation supervision reads and actions.
- Keep circulation business rules out of FastAPI and inside PostgreSQL RPCs.
- Apply circulation-specific rate limiting and truthful HTTP error mapping.
"""

import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import RateLimitTier, enforce_rate_limit
from modules.circulation.schemas import (
    CIRCULATION_DUE_DATE_SUCCESS_EXAMPLE,
    CIRCULATION_RENEW_SUCCESS_EXAMPLE,
    CIRCULATION_RETURN_SUCCESS_EXAMPLE,
    STAFF_CIRCULATION_LOAN_DETAIL_SUCCESS_EXAMPLE,
    STAFF_CIRCULATION_LOANS_SUCCESS_EXAMPLE,
    AdjustDueDateRequest,
    EmptyData,
    SimpleMessageResponse,
    StaffCirculationLoanDetailData,
    StaffCirculationLoanDetailResponse,
    StaffCirculationLoanListQueryParams,
    StaffCirculationLoansData,
    StaffCirculationLoansResponse,
)
from modules.circulation.service import CirculationService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin/circulation", tags=["Staff Circulation"])

READ_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Loan not found"},
    422: {"description": "Validation Error"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

ACTION_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Loan not found"},
    409: {"description": "Circulation action is blocked by current loan state"},
    422: {"description": "Validation Error"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user_id


def _resolve_circulation_runtime_error_status(message: str) -> int:
    normalized = message.lower()

    if "authentication required" in normalized:
        return status.HTTP_401_UNAUTHORIZED

    if "insufficient privileges" in normalized or "user profile not found" in normalized:
        return status.HTTP_403_FORBIDDEN

    if "loan not found" in normalized:
        return status.HTTP_404_NOT_FOUND

    if (
        "loan already returned" in normalized
        or "renewal limit reached" in normalized
        or "cannot renew, book reserved by another user" in normalized
        or "due date adjustment blocked: fine already resolved" in normalized
    ):
        return status.HTTP_409_CONFLICT

    if (
        "invalid circulation scope" in normalized
        or "due date is required" in normalized
        or "due date must be after the issue date" in normalized
        or "invalid input value for enum" in normalized
    ):
        return status.HTTP_422_UNPROCESSABLE_ENTITY

    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _enforce_circulation_rate_limit(
    request: Request,
    *,
    tier: RateLimitTier,
    user_id: str,
    subject_hint: str,
) -> None:
    await enforce_rate_limit(
        request=request,
        tier=tier,
        user_id=user_id,
        subject_hint=subject_hint,
    )


@router.get(
    "/loans",
    response_model=StaffCirculationLoansResponse,
    responses={
        200: {
            "description": "Circulation loans retrieved successfully",
            "content": {
                "application/json": {
                    "example": STAFF_CIRCULATION_LOANS_SUCCESS_EXAMPLE,
                }
            },
        },
        **READ_ERROR_RESPONSES,
    },
)
async def get_staff_circulation_loans(
    request: Request,
    query: StaffCirculationLoanListQueryParams = Depends(),
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StaffCirculationLoansResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "circulation_read"
    subject_hint = "|".join(
        [
            query.scope,
            query.search or "no-search",
            query.role or "all-roles",
            query.book_status or "all-book-statuses",
            query.due_from.isoformat() if query.due_from else "no-due-from",
            query.due_to.isoformat() if query.due_to else "no-due-to",
            str(query.limit),
            str(query.offset),
        ]
    )

    await _enforce_circulation_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=subject_hint,
    )

    logger.info(
        "CIRCULATION: list request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "scope": query.scope,
            "search": query.search,
            "role_filter": query.role,
            "book_status": query.book_status,
            "due_from": query.due_from.isoformat() if query.due_from else None,
            "due_to": query.due_to.isoformat() if query.due_to else None,
            "limit": query.limit,
            "offset": query.offset,
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await CirculationService.get_loans(user_id=user_id, query=query)
    except RuntimeError as exc:
        http_status = _resolve_circulation_runtime_error_status(str(exc))
        logger.error(
            "CIRCULATION: list failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "scope": query.scope,
                "search": query.search,
                "role_filter": query.role,
                "book_status": query.book_status,
                "limit": query.limit,
                "offset": query.offset,
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": rate_limit_tier,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "CIRCULATION: list success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "scope": query.scope,
            "returned_items": len(result["items"]),
            "total": result["total"],
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return StaffCirculationLoansResponse(
        status=200,
        message="Circulation loans retrieved successfully",
        data=StaffCirculationLoansData(**result),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/loans/{transaction_id}",
    response_model=StaffCirculationLoanDetailResponse,
    responses={
        200: {
            "description": "Circulation loan retrieved successfully",
            "content": {
                "application/json": {
                    "example": STAFF_CIRCULATION_LOAN_DETAIL_SUCCESS_EXAMPLE,
                }
            },
        },
        **READ_ERROR_RESPONSES,
    },
)
async def get_staff_circulation_loan_detail(
    request: Request,
    transaction_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StaffCirculationLoanDetailResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "circulation_read"

    await _enforce_circulation_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(transaction_id),
    )

    logger.info(
        "CIRCULATION: detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "transaction_id": str(transaction_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await CirculationService.get_loan_by_id(
            user_id=user_id,
            transaction_id=transaction_id,
        )
    except RuntimeError as exc:
        http_status = _resolve_circulation_runtime_error_status(str(exc))
        logger.error(
            "CIRCULATION: detail failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "transaction_id": str(transaction_id),
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": rate_limit_tier,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "CIRCULATION: detail success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "transaction_id": str(transaction_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return StaffCirculationLoanDetailResponse(
        status=200,
        message="Circulation loan retrieved successfully",
        data=StaffCirculationLoanDetailData(item=result),
        timestamp_ms=int(time.time() * 1000),
    )


@router.patch(
    "/loans/{transaction_id}/due-date",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Loan due date adjusted successfully",
            "content": {
                "application/json": {
                    "example": CIRCULATION_DUE_DATE_SUCCESS_EXAMPLE,
                }
            },
        },
        **ACTION_ERROR_RESPONSES,
    },
)
async def adjust_staff_circulation_due_date(
    request: Request,
    transaction_id: UUID,
    payload: AdjustDueDateRequest,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "circulation_mutation"

    await _enforce_circulation_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(transaction_id),
    )

    logger.info(
        "CIRCULATION: due date adjustment request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "transaction_id": str(transaction_id),
            "due_date": payload.due_date.isoformat(),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        await CirculationService.adjust_due_date(
            user_id=user_id,
            transaction_id=transaction_id,
            payload=payload,
        )
    except RuntimeError as exc:
        http_status = _resolve_circulation_runtime_error_status(str(exc))
        logger.error(
            "CIRCULATION: due date adjustment failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "transaction_id": str(transaction_id),
                "due_date": payload.due_date.isoformat(),
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": rate_limit_tier,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return SimpleMessageResponse(
        status=200,
        message="Loan due date adjusted successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/loans/{transaction_id}/return",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Loan returned successfully",
            "content": {
                "application/json": {
                    "example": CIRCULATION_RETURN_SUCCESS_EXAMPLE,
                }
            },
        },
        **ACTION_ERROR_RESPONSES,
    },
)
async def return_staff_circulation_loan(
    request: Request,
    transaction_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "circulation_mutation"

    await _enforce_circulation_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(transaction_id),
    )

    logger.info(
        "CIRCULATION: return request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "transaction_id": str(transaction_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        await CirculationService.return_loan(
            user_id=user_id,
            transaction_id=transaction_id,
        )
    except RuntimeError as exc:
        http_status = _resolve_circulation_runtime_error_status(str(exc))
        logger.error(
            "CIRCULATION: return failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "transaction_id": str(transaction_id),
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": rate_limit_tier,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return SimpleMessageResponse(
        status=200,
        message="Loan returned successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/loans/{transaction_id}/renew",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Loan renewed successfully",
            "content": {
                "application/json": {
                    "example": CIRCULATION_RENEW_SUCCESS_EXAMPLE,
                }
            },
        },
        **ACTION_ERROR_RESPONSES,
    },
)
async def renew_staff_circulation_loan(
    request: Request,
    transaction_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "circulation_mutation"

    await _enforce_circulation_rate_limit(
        request,
        tier=rate_limit_tier,
        user_id=user_id,
        subject_hint=str(transaction_id),
    )

    logger.info(
        "CIRCULATION: renew request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "transaction_id": str(transaction_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        await CirculationService.renew_loan(
            user_id=user_id,
            transaction_id=transaction_id,
        )
    except RuntimeError as exc:
        http_status = _resolve_circulation_runtime_error_status(str(exc))
        logger.error(
            "CIRCULATION: renew failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "transaction_id": str(transaction_id),
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": rate_limit_tier,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return SimpleMessageResponse(
        status=200,
        message="Loan renewed successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
