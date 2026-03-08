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
from modules.admin_metrics.schemas import (
    ADMIN_METRICS_SUCCESS_EXAMPLE,
    AdminMetricsData,
    AdminMetricsResponse,
)
from modules.admin_metrics.service import AdminMetricsService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin/metrics", tags=["Admin Metrics"])


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user_id


def _resolve_runtime_error_status(message: str) -> int:
    if "Insufficient privileges" in message:
        return status.HTTP_403_FORBIDDEN
    if "Book not found" in message:
        return status.HTTP_404_NOT_FOUND
    return status.HTTP_500_INTERNAL_SERVER_ERROR


@router.get(
    "/dashboard",
    response_model=AdminMetricsResponse,
    responses={
        200: {
            "description": "Admin metrics retrieved successfully",
            "content": {"application/json": {"example": ADMIN_METRICS_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_dashboard_metrics(
    request: Request,
    popular_limit: int = Query(10, ge=1, le=50),
    queue_limit: int = Query(10, ge=1, le=50),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminMetricsResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ADMIN_METRICS: dashboard request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "popular_limit": popular_limit,
            "queue_limit": queue_limit,
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
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=message if http_status != 500 else "Internal Server Error",
        ) from exc

    return AdminMetricsResponse(
        status=200,
        message="Admin metrics retrieved successfully",
        data=AdminMetricsData(**result),
        timestamp_ms=int(time.time() * 1000),
    )
