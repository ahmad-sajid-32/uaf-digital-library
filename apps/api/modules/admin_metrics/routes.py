# apps/api/modules/admin_metrics/routes.py
"""
Admin Metrics Module - Routes

Responsibilities:
- Expose authenticated admin dashboard metrics endpoint.
- Validate auth presence and query parameters.
- Call service layer only.
- Map preserved database privilege failures to HTTP responses.
"""

import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import RateLimitTier, enforce_rate_limit
from modules.admin_metrics.schemas import (
    ADMIN_METRICS_SUCCESS_EXAMPLE,
    AdminMetricsData,
    AdminMetricsResponse,
)
from modules.admin_metrics.service import AdminMetricsService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin/metrics", tags=["Admin Metrics"])

METRICS_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
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


def _require_admin_user_id(request: Request) -> str:
    user_id = _require_user_id(request)
    role = getattr(request.state, "role", None)

    if role != "admin":
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
    response_model=AdminMetricsResponse,
    responses={
        200: {
            "description": "Admin metrics retrieved successfully",
            "content": {"application/json": {"example": ADMIN_METRICS_SUCCESS_EXAMPLE}},
        },
        **METRICS_ERROR_RESPONSES,
    },
)
async def get_dashboard_metrics(
    request: Request,
    popular_limit: int = Query(10, ge=1, le=50),
    queue_limit: int = Query(10, ge=1, le=50),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminMetricsResponse:
    del credentials
    user_id = _require_admin_user_id(request)
    rate_limit_tier: RateLimitTier = "metrics_read"
    subject_hint = f"popular:{popular_limit}|queue:{queue_limit}"

    await _enforce_metrics_read_rate_limit(
        request,
        user_id=user_id,
        subject_hint=subject_hint,
    )

    logger.info(
        "ADMIN_METRICS: dashboard request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "popular_limit": popular_limit,
            "queue_limit": queue_limit,
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        result = await AdminMetricsService.get_dashboard_metrics(
            user_id=user_id,
            popular_limit=popular_limit,
            queue_limit=queue_limit,
        )
    except RuntimeError as exc:
        message = str(exc)
        http_status = _resolve_runtime_error_status(message)
        logger.error(
            "ADMIN_METRICS: dashboard failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "popular_limit": popular_limit,
                "queue_limit": queue_limit,
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
        "ADMIN_METRICS: dashboard success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "popular_limit": popular_limit,
            "queue_limit": queue_limit,
            "popular_items": len(result.get("popular_books", [])),
            "queue_items": len(result.get("queue_pressure", [])),
            "active_borrow_count": result.get("active_borrow_count"),
            "overdue_count": result.get("overdue_count"),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "success",
        },
    )

    return AdminMetricsResponse(
        status=200,
        message="Admin metrics retrieved successfully",
        data=AdminMetricsData(**result),
        timestamp_ms=int(time.time() * 1000),
    )
