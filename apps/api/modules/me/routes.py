# apps/api/modules/me/routes.py
"""
Me Module - Routes

Responsibilities:
- Expose authenticated self-service read endpoints.
- Validate auth presence and query parameters.
- Call service layer only.
- Map preserved database privilege failures to HTTP responses.
"""

import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from modules.me.schemas import (
    ACTIVE_BORROWS_SUCCESS_EXAMPLE,
    BORROW_HISTORY_SUCCESS_EXAMPLE,
    DELETE_MY_ACCOUNT_SUCCESS_EXAMPLE,
    FINE_HISTORY_SUCCESS_EXAMPLE,
    FINES_SUCCESS_EXAMPLE,
    STUDENT_DASHBOARD_SUCCESS_EXAMPLE,
    QUEUE_ENTRIES_SUCCESS_EXAMPLE,
    UPDATE_MY_PROFILE_SUCCESS_EXAMPLE,
    ActiveBorrowsData,
    ActiveBorrowsResponse,
    BorrowHistoryData,
    BorrowHistoryResponse,
    EmptyData,
    FineHistoryData,
    FineHistoryResponse,
    FinesData,
    FinesResponse,
    QueueEntriesData,
    QueueEntriesResponse,
    SimpleMessageResponse,
    StudentDashboardData,
    StudentDashboardResponse,
    UpdateMyProfileRequest,
)
from modules.me.service import MeService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/me", tags=["Me"])


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
    if "Profile not found" in message:
        return status.HTTP_404_NOT_FOUND
    if "Invalid full_name" in message:
        return status.HTTP_400_BAD_REQUEST
    return status.HTTP_500_INTERNAL_SERVER_ERROR


def _require_student_user_id(request: Request) -> str:
    user_id = _require_user_id(request)
    role = getattr(request.state, "role", None)

    if role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient privileges",
        )

    return user_id


@router.get(
    "/borrows/active",
    response_model=ActiveBorrowsResponse,
    responses={
        200: {
            "description": "Active borrows retrieved successfully",
            "content": {"application/json": {"example": ACTIVE_BORROWS_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_active_borrows(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ActiveBorrowsResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ME: active borrows request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
        },
    )

    try:
        items = await MeService.get_active_borrows(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: active borrows failed",
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

    return ActiveBorrowsResponse(
        status=200,
        message="Active borrows retrieved successfully",
        data=ActiveBorrowsData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/borrows/history",
    response_model=BorrowHistoryResponse,
    responses={
        200: {
            "description": "Borrow history retrieved successfully",
            "content": {"application/json": {"example": BORROW_HISTORY_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_borrow_history(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> BorrowHistoryResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ME: borrow history request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "limit": limit,
        },
    )

    try:
        items = await MeService.get_borrow_history(user_id, limit)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: borrow history failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "limit": limit,
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return BorrowHistoryResponse(
        status=200,
        message="Borrow history retrieved successfully",
        data=BorrowHistoryData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/fines",
    response_model=FinesResponse,
    responses={
        200: {
            "description": "Fines retrieved successfully",
            "content": {"application/json": {"example": FINES_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_fines(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> FinesResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ME: fines request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
        },
    )

    try:
        items = await MeService.get_fines(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: fines failed",
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

    return FinesResponse(
        status=200,
        message="Fines retrieved successfully",
        data=FinesData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/fines/history",
    response_model=FineHistoryResponse,
    responses={
        200: {
            "description": "Fine history retrieved successfully",
            "content": {"application/json": {"example": FINE_HISTORY_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_fine_history(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> FineHistoryResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ME: fine history request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
        },
    )

    try:
        items = await MeService.get_my_fine_history(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: fine history failed",
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

    return FineHistoryResponse(
        status=200,
        message="Fine history retrieved successfully",
        data=FineHistoryData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/queue",
    response_model=QueueEntriesResponse,
    responses={
        200: {
            "description": "Queue entries retrieved successfully",
            "content": {"application/json": {"example": QUEUE_ENTRIES_SUCCESS_EXAMPLE}},
        }
    },
)
async def get_queue_entries(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> QueueEntriesResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ME: queue entries request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
        },
    )

    try:
        items = await MeService.get_queue_entries(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: queue entries failed",
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

    return QueueEntriesResponse(
        status=200,
        message="Queue entries retrieved successfully",
        data=QueueEntriesData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/dashboard",
    response_model=StudentDashboardResponse,
    responses={
        200: {
            "description": "Student dashboard retrieved successfully",
            "content": {
                "application/json": {
                    "example": STUDENT_DASHBOARD_SUCCESS_EXAMPLE,
                }
            },
        }
    },
)
async def get_student_dashboard(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StudentDashboardResponse:
    del credentials
    user_id = _require_student_user_id(request)

    logger.info(
        "ME: student dashboard request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "role": getattr(request.state, "role", None),
        },
    )

    try:
        dashboard = await MeService.get_student_dashboard(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: student dashboard failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "role": getattr(request.state, "role", None),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    logger.info(
        "ME: student dashboard success",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "role": getattr(request.state, "role", None),
            "active_borrow_count": dashboard.get("summary", {}).get(
                "active_borrow_count"
            ),
            "pending_fine_count": dashboard.get("summary", {}).get(
                "pending_fine_count"
            ),
            "active_queue_count": dashboard.get("summary", {}).get(
                "active_queue_count"
            ),
        },
    )

    return StudentDashboardResponse(
        status=200,
        message="Student dashboard retrieved successfully",
        data=StudentDashboardData(**dashboard),
        timestamp_ms=int(time.time() * 1000),
    )


@router.patch(
    "/profile",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Profile updated successfully",
            "content": {
                "application/json": {
                    "example": UPDATE_MY_PROFILE_SUCCESS_EXAMPLE
                }
            },
        }
    },
)
async def update_my_profile(
    request: Request,
    payload: UpdateMyProfileRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ME: update profile request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
        },
    )

    try:
        await MeService.update_my_profile(user_id, payload.full_name)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: update profile failed",
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

    return SimpleMessageResponse(
        status=200,
        message="Profile updated successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.delete(
    "",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Account deleted successfully",
            "content": {
                "application/json": {
                    "example": DELETE_MY_ACCOUNT_SUCCESS_EXAMPLE
                }
            },
        }
    },
)
async def delete_my_account(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)

    logger.info(
        "ME: delete account request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
        },
    )

    try:
        await MeService.delete_my_account(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "ME: delete account failed",
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

    return SimpleMessageResponse(
        status=200,
        message="Account deleted successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
