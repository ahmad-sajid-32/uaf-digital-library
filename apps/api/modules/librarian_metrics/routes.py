# apps/api/modules/librarian_metrics/routes.py
"""
Routes for the Librarian Metrics Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose the librarian operational dashboard metrics endpoint.
- Keep route handlers thin and delegate aggregation to the service layer.
- Apply existing metrics-read rate limiting and truthful HTTP error mapping.
"""

import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import RateLimitTier, enforce_rate_limit
from modules.librarian_metrics.schemas import (
    LIBRARIAN_METRICS_SUCCESS_EXAMPLE,
    LibrarianMetricsData,
    LibrarianMetricsResponse,
)
from modules.librarian_metrics.service import LibrarianMetricsService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(
    prefix="/api/librarian/metrics",
    tags=["Librarian Metrics"],
)

METRICS_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
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


def _require_librarian_user_id(request: Request) -> str:
    user_id = _require_user_id(request)
    role = getattr(request.state, "role", None)

    if role != "librarian":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient privileges",
        )

    return user_id


def _resolve_runtime_error_status(message: str) -> int:
    normalized = message.lower()

    if "authentication required" in normalized:
        return status.HTTP_401_UNAUTHORIZED

    if "insufficient privileges" in normalized or "user profile not found" in normalized:
        return status.HTTP_403_FORBIDDEN

    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _enforce_metrics_read_rate_limit(
    request: Request,
    *,
    user_id: str,
    subject_hint: str,
) -> None:
    await enforce_rate_limit(
        request=request,
        tier="metrics_read",
        user_id=user_id,
        subject_hint=subject_hint,
    )


@router.get(
    "/dashboard",
    response_model=LibrarianMetricsResponse,
    responses={
        200: {
            "description": "Librarian dashboard metrics retrieved successfully",
            "content": {
                "application/json": {
                    "example": LIBRARIAN_METRICS_SUCCESS_EXAMPLE,
                }
            },
        },
        **METRICS_ERROR_RESPONSES,
    },
)
async def get_dashboard_metrics(
    request: Request,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> LibrarianMetricsResponse:
    user_id = _require_librarian_user_id(request)
    rate_limit_tier: RateLimitTier = "metrics_read"
    subject_hint = "dashboard"

    await _enforce_metrics_read_rate_limit(
        request,
        user_id=user_id,
        subject_hint=subject_hint,
    )

    logger.info(
        "LIBRARIAN_METRICS: dashboard request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "role": getattr(request.state, "role", None),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await LibrarianMetricsService.get_dashboard_metrics(user_id=user_id)
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_runtime_error_status(message)
        logger.error(
            "LIBRARIAN_METRICS: dashboard failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "role": getattr(request.state, "role", None),
                "error": message,
                "status_code": http_status,
                "rate_limit_tier": rate_limit_tier,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=message if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "LIBRARIAN_METRICS: dashboard success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "role": getattr(request.state, "role", None),
            "active_loan_count": result.get("active_loan_count"),
            "overdue_loan_count": result.get("overdue_loan_count"),
            "pending_fine_count": result.get("pending_fine_count"),
            "documents_requiring_action_count": result.get(
                "documents_requiring_action_count"
            ),
            "queue_hotspot_items": len(result.get("queue_hotspots", [])),
            "document_attention_items": len(result.get("document_attention", [])),
            "popular_book_items": len(result.get("popular_books", [])),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return LibrarianMetricsResponse(
        status=200,
        message="Librarian dashboard metrics retrieved successfully",
        data=LibrarianMetricsData(**result),
        timestamp_ms=int(time.time() * 1000),
    )
