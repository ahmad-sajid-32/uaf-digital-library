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

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import enforce_rate_limit
from modules.admin_fines.schemas import (
    ADMIN_FINE_DETAIL_SUCCESS_EXAMPLE,
    ADMIN_FINES_SUCCESS_EXAMPLE,
    AdminFineDetailData,
    AdminFineDetailResponse,
    AdminFinesData,
    AdminFinesListQueryParams,
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


async def _enforce_staff_fine_read_rate_limit(
    request: Request,
    *,
    user_id: str,
    subject_hint: str,
) -> None:
    """
    Apply staff fine-read throttling for list/detail requests.
    """

    await enforce_rate_limit(
        request=request,
        tier="fine_read",
        user_id=user_id,
        subject_hint=subject_hint,
    )


@router.get(
    "",
    response_model=AdminFinesResponse,
    responses={
        200: {
            "description": "Fine history retrieved successfully",
            "content": {"application/json": {"example": ADMIN_FINES_SUCCESS_EXAMPLE}},
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        422: {"description": "Validation Error"},
        429: {"description": "Too Many Requests"},
        500: {"description": "Internal Server Error"},
    },
)
async def get_fines(
    request: Request,
    query: AdminFinesListQueryParams = Depends(),
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminFinesResponse:
    user_id = _require_user_id(request)
    subject_hint = "|".join(
        [
            query.status or "all-statuses",
            query.search or "no-search",
            query.created_from.isoformat() if query.created_from else "no-created-from",
            query.created_to.isoformat() if query.created_to else "no-created-to",
            query.resolved_from.isoformat()
            if query.resolved_from
            else "no-resolved-from",
            query.resolved_to.isoformat() if query.resolved_to else "no-resolved-to",
            str(query.limit),
            str(query.offset),
        ]
    )

    await _enforce_staff_fine_read_rate_limit(
        request,
        user_id=user_id,
        subject_hint=subject_hint,
    )

    logger.info(
        "ADMIN_FINES: list request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "status_filter": query.status,
            "search": query.search,
            "created_from": (
                query.created_from.isoformat() if query.created_from else None
            ),
            "created_to": query.created_to.isoformat() if query.created_to else None,
            "resolved_from": (
                query.resolved_from.isoformat() if query.resolved_from else None
            ),
            "resolved_to": (
                query.resolved_to.isoformat() if query.resolved_to else None
            ),
            "limit": query.limit,
            "offset": query.offset,
            "rate_limit_tier": "fine_read",
            "outcome": "request",
        },
    )

    try:
        result = await AdminFinesService.get_fines(
            user_id=user_id,
            status=query.status,
            search=query.search,
            created_from=query.created_from,
            created_to=query.created_to,
            resolved_from=query.resolved_from,
            resolved_to=query.resolved_to,
            limit=query.limit,
            offset=query.offset,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ADMIN_FINES: list failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "status_filter": query.status,
                "search": query.search,
                "created_from": (
                    query.created_from.isoformat() if query.created_from else None
                ),
                "created_to": (
                    query.created_to.isoformat() if query.created_to else None
                ),
                "resolved_from": (
                    query.resolved_from.isoformat() if query.resolved_from else None
                ),
                "resolved_to": (
                    query.resolved_to.isoformat() if query.resolved_to else None
                ),
                "limit": query.limit,
                "offset": query.offset,
                "error": str(exc),
                "status_code": http_status,
                "rate_limit_tier": "fine_read",
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "ADMIN_FINES: list success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "returned_items": len(result["items"]),
            "total": result["total"],
            "limit": query.limit,
            "offset": query.offset,
            "rate_limit_tier": "fine_read",
            "outcome": "success",
        },
    )

    return AdminFinesResponse(
        status=200,
        message="Fine history retrieved successfully",
        data=AdminFinesData(
            items=result["items"],
            total=result["total"],
            limit=query.limit,
            offset=query.offset,
        ),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/{fine_id}",
    response_model=AdminFineDetailResponse,
    responses={
        200: {
            "description": "Fine detail retrieved successfully",
            "content": {"application/json": {"example": ADMIN_FINE_DETAIL_SUCCESS_EXAMPLE}},
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "Fine not found"},
        422: {"description": "Validation Error"},
        429: {"description": "Too Many Requests"},
        500: {"description": "Internal Server Error"},
    },
)
async def get_fine_detail(
    request: Request,
    fine_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminFineDetailResponse:
    user_id = _require_user_id(request)
    await _enforce_staff_fine_read_rate_limit(
        request,
        user_id=user_id,
        subject_hint=str(fine_id),
    )

    logger.info(
        "ADMIN_FINES: detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "fine_id": str(fine_id),
            "rate_limit_tier": "fine_read",
            "outcome": "request",
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
                "rate_limit_tier": "fine_read",
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "ADMIN_FINES: detail success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "fine_id": str(fine_id),
            "rate_limit_tier": "fine_read",
            "outcome": "success",
        },
    )

    return AdminFineDetailResponse(
        status=200,
        message="Fine detail retrieved successfully",
        data=AdminFineDetailData(item=item),
        timestamp_ms=int(time.time() * 1000),
    )
