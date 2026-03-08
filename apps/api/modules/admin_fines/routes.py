# apps/api/modules/admin_fines/routes.py
"""
Routes for the Admin Fine History Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose authenticated fine history read endpoints for librarian/admin users.
- Keep authorization and fine history business logic out of route handlers.
- Map deterministic database errors to HTTP responses.
"""

import time

from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from modules.admin_fines.schemas import (
    ADMIN_FINE_DETAIL_SUCCESS_EXAMPLE,
    ADMIN_FINES_SUCCESS_EXAMPLE,
    AdminFineDetailData,
    AdminFineDetailResponse,
    AdminFinesData,
    AdminFinesResponse,
)
from modules.admin_fines.service import AdminFinesService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin/fines", tags=["Admin Fine History"])


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

    return status.HTTP_500_INTERNAL_SERVER_ERROR


@router.get(
    "",
    response_model=AdminFinesResponse,
    responses={
        200: {
            "description": "Fine history retrieved successfully",
            "content": {"application/json": {"example": ADMIN_FINES_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_fines(
    request: Request,
    status_filter: Optional[Literal["pending", "paid", "waived", "cancelled"]] = Query(
        default=None,
        alias="status",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminFinesResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ADMIN_FINES: list request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "status_filter": status_filter,
            "limit": limit,
            "offset": offset,
        },
    )

    try:
        items = await AdminFinesService.get_fines(user_id, status_filter, limit, offset)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ADMIN_FINES: list failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "status_filter": status_filter,
                "limit": limit,
                "offset": offset,
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AdminFinesResponse(
        status=200,
        message="Fine history retrieved successfully",
        data=AdminFinesData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/{fine_id}",
    response_model=AdminFineDetailResponse,
    responses={
        200: {
            "description": "Fine detail retrieved successfully",
            "content": {"application/json": {"example": ADMIN_FINE_DETAIL_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_fine_detail(
    request: Request,
    fine_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminFineDetailResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ADMIN_FINES: detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "fine_id": str(fine_id),
        },
    )

    try:
        item = await AdminFinesService.get_fine_detail(user_id, fine_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ADMIN_FINES: detail failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "fine_id": str(fine_id),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AdminFineDetailResponse(
        status=200,
        message="Fine detail retrieved successfully",
        data=AdminFineDetailData(item=item),
        timestamp_ms=int(time.time() * 1000),
    )
