# apps/api/modules/auth/routes.py
"""
Auth Routes Module for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Expose admin-only user creation endpoints.
- Expose admin-only user list and detail read endpoints.
- Expose admin-only user status-management endpoints.
- Declare Bearer authentication requirement (OpenAPI).
- Verify ADMIN role via database RPC.
- Delegate provisioning logic to AuthService.
- Return structured 200 success responses.
- Declare error codes in route metadata (no models).

Architectural Rules:
- No business logic.
- No role logic outside RPC.
- No Supabase logic here.
"""

import time

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.database import Database
from core.logging import get_logger
from core.rate_limit import enforce_rate_limit, hash_sensitive_value

from modules.auth.schemas import (
    ADMIN_DELETE_USER_SUCCESS_EXAMPLE,
    ADMIN_USER_DETAIL_SUCCESS_EXAMPLE,
    ADMIN_USERS_LIST_SUCCESS_EXAMPLE,
    ACCOUNT_STATUS_SUCCESS_EXAMPLE,
    ADMIN_UPDATE_STATUS_SUCCESS_EXAMPLE,
    AdminUserDetailData,
    AdminUserDetailResponse,
    AdminUpdateUserStatusRequest,
    AdminUsersListData,
    AdminUsersListQueryParams,
    AdminUsersListResponse,
    ADMIN_UPDATE_PROFILE_SUCCESS_EXAMPLE,
    CREATE_ADMIN_SUCCESS_EXAMPLE,
    CREATE_LIBRARIAN_SUCCESS_EXAMPLE,
    CREATE_STUDENT_SUCCESS_EXAMPLE,
    AccountStatusRequest,
    AccountStatusResponse,
    AccountStatusData,
    AdminUpdateUserProfileRequest,
    CreateStudentRequest,
    CreateLibrarianRequest,
    CreateAdminRequest,
    EmptyData,
    SimpleMessageResponse,
    UserCreationData,
    UserCreationResponse,
)
from modules.auth.service import AuthService

logger = get_logger(__name__)

# OpenAPI Security Scheme (for Swagger UI)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(
    prefix="/api/admin/users",
    tags=["Admin Users"],
)

public_router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"],
)


# ============================================================
# Internal Helper
# ============================================================

async def _ensure_admin(user_id: str) -> None:
    """
    Validate that the requesting user has ADMIN role using RPC.

    Args:
        user_id (str): Authenticated user UUID.

    Raises:
        HTTPException: 403 if not admin.
    """

    pool = Database.get_pool()

    async with pool.acquire() as conn:
        is_admin = await conn.fetchval(
            "select library.is_admin($1);",
            user_id,
        )

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )


async def _enforce_public_auth_rate_limit(
    request: Request,
    *,
    email: str,
) -> None:
    """
    Apply a strict public auth probe limiter keyed by route fingerprint and email hash.
    """

    await enforce_rate_limit(
        request=request,
        tier="auth_public",
        subject_hint=email,
    )


async def _enforce_admin_auth_rate_limit(
    request: Request,
    *,
    user_id: str,
    subject_hint: str | None = None,
) -> None:
    """
    Apply admin auth-management throttling for authenticated callers.
    """

    await enforce_rate_limit(
        request=request,
        tier="admin_auth",
        user_id=user_id,
        subject_hint=subject_hint,
    )


def _resolve_runtime_error_status(message: str) -> int:
    """
    Map deterministic PostgreSQL errors to HTTP status codes.
    """

    if "Authentication required" in message:
        return status.HTTP_401_UNAUTHORIZED

    if "Insufficient privileges" in message:
        return status.HTTP_403_FORBIDDEN

    if "Account is inactive" in message:
        return status.HTTP_403_FORBIDDEN

    if "Profile not found" in message:
        return status.HTTP_404_NOT_FOUND

    if "User not found" in message:
        return status.HTTP_404_NOT_FOUND

    if (
        "Invalid full_name" in message
        or "Invalid role" in message
        or "Invalid roll_number" in message
        or "Invalid department" in message
        or "Invalid semester" in message
        or "Invalid employee_code" in message
        or "Invalid designation" in message
        or "Role field mismatch" in message
        or "No updatable fields provided" in message
    ):
        return status.HTTP_422_UNPROCESSABLE_ENTITY

    if (
        "User with this email already exists" in message
        or "Roll number already exists" in message
        or "Employee code already exists" in message
    ):
        return status.HTTP_409_CONFLICT

    return status.HTTP_500_INTERNAL_SERVER_ERROR


# ============================================================
# Public Account Status
# ============================================================

@public_router.post(
    "/account-status",
    response_model=AccountStatusResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Account status retrieved successfully",
            "content": {
                "application/json": {
                    "example": ACCOUNT_STATUS_SUCCESS_EXAMPLE
                }
            },
        },
    },
)
async def get_account_status(
    request: Request,
    payload: AccountStatusRequest,
) -> AccountStatusResponse:
    """
    Public endpoint used by guest auth flows to detect account state.
    """

    await _enforce_public_auth_rate_limit(request, email=payload.email)

    logger.info(
        "AUTH: account status request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "email_hash": hash_sensitive_value(payload.email),
        },
    )

    result = await AuthService.get_account_status(payload.email)

    return AccountStatusResponse(
        status=200,
        message="Account status retrieved successfully",
        data=AccountStatusData(**result.model_dump()),
        timestamp_ms=int(time.time() * 1000),
    )


# ============================================================
# Admin User List
# ============================================================

@router.get(
    "",
    response_model=AdminUsersListResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Users retrieved successfully",
            "content": {
                "application/json": {
                    "example": ADMIN_USERS_LIST_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        429: {"description": "Too Many Requests"},
        500: {"description": "Internal Server Error"},
    },
)
async def list_admin_users(
    request: Request,
    query: AdminUsersListQueryParams = Depends(),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminUsersListResponse:
    """
    Retrieve a filtered admin-managed user list.
    """

    admin_id = getattr(request.state, "user_id", None)

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    subject_hint = (
        query.search
        or query.role
        or (
            "active"
            if query.is_active is True
            else "inactive" if query.is_active is False else "list"
        )
    )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=admin_id,
        subject_hint=subject_hint,
    )
    await _ensure_admin(admin_id)

    logger.info(
        "AUTH: admin list users request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "admin_id": admin_id,
            "role_filter": query.role,
            "is_active_filter": query.is_active,
            "search_applied": bool(query.search),
            "limit": query.limit,
            "offset": query.offset,
        },
    )

    try:
        result = await AuthService.list_admin_users(
            admin_id,
            role=query.role,
            is_active=query.is_active,
            search=query.search,
            limit=query.limit,
            offset=query.offset,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: admin list users failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": admin_id,
                "role_filter": query.role,
                "is_active_filter": query.is_active,
                "search_applied": bool(query.search),
                "limit": query.limit,
                "offset": query.offset,
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AdminUsersListResponse(
        status=200,
        message="Users retrieved successfully",
        data=AdminUsersListData(**result),
        timestamp_ms=int(time.time() * 1000),
    )


# ============================================================
# Admin User Detail
# ============================================================

@router.get(
    "/{user_id}",
    response_model=AdminUserDetailResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "User retrieved successfully",
            "content": {
                "application/json": {
                    "example": ADMIN_USER_DETAIL_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "User not found"},
        429: {"description": "Too Many Requests"},
        500: {"description": "Internal Server Error"},
    },
)
async def get_admin_user_detail(
    request: Request,
    user_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AdminUserDetailResponse:
    """
    Retrieve one admin-managed user by UUID.
    """

    admin_id = getattr(request.state, "user_id", None)

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=admin_id,
        subject_hint=str(user_id),
    )
    await _ensure_admin(admin_id)

    logger.info(
        "AUTH: admin user detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "admin_id": admin_id,
            "target_user_id": str(user_id),
        },
    )

    try:
        result = await AuthService.get_admin_user_detail(admin_id, user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: admin user detail failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": admin_id,
                "target_user_id": str(user_id),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AdminUserDetailResponse(
        status=200,
        message="User retrieved successfully",
        data=AdminUserDetailData(user=result),
        timestamp_ms=int(time.time() * 1000),
    )


# ============================================================
# Create Student
# ============================================================

@router.post(
    "/students",
    response_model=UserCreationResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Student created successfully",
            "content": {
                "application/json": {
                    "example": CREATE_STUDENT_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        409: {"description": "Email or unique role metadata already exists"},
        422: {"description": "Invalid role metadata payload"},
        500: {"description": "Internal Server Error"},
    },
)
async def create_student(
    request: Request,
    payload: CreateStudentRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserCreationResponse:
    """
    Create a new student account.

    Requires:
        Authenticated ADMIN user.
    """

    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=user_id,
        subject_hint=payload.email,
    )
    await _ensure_admin(user_id)

    logger.info(
        "AUTH: create student request",
        extra={
            "admin_id": user_id,
            "email_hash": hash_sensitive_value(payload.email),
        },
    )

    try:
        result = await AuthService.create_student(payload)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: create student failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": user_id,
                "email_hash": hash_sensitive_value(payload.email),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return UserCreationResponse(
        status=200,
        message="Student account created successfully",
        data=UserCreationData(**result.model_dump()),
        timestamp_ms=int(time.time() * 1000),
    )


# ============================================================
# Create Librarian
# ============================================================

@router.post(
    "/librarians",
    response_model=UserCreationResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Librarian created successfully",
            "content": {
                "application/json": {
                    "example": CREATE_LIBRARIAN_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        409: {"description": "Email or unique role metadata already exists"},
        422: {"description": "Invalid role metadata payload"},
        500: {"description": "Internal Server Error"},
    },
)
async def create_librarian(
    request: Request,
    payload: CreateLibrarianRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserCreationResponse:
    """
    Create a new librarian account.

    Requires:
        Authenticated ADMIN user.
    """

    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=user_id,
        subject_hint=payload.email,
    )
    await _ensure_admin(user_id)

    logger.info(
        "AUTH: create librarian request",
        extra={
            "admin_id": user_id,
            "email_hash": hash_sensitive_value(payload.email),
        },
    )

    try:
        result = await AuthService.create_librarian(payload)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: create librarian failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": user_id,
                "email_hash": hash_sensitive_value(payload.email),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return UserCreationResponse(
        status=200,
        message="Librarian account created successfully",
        data=UserCreationData(**result.model_dump()),
        timestamp_ms=int(time.time() * 1000),
    )


# ============================================================
# Create Admin
# ============================================================

@router.post(
    "/admins",
    response_model=UserCreationResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Admin created successfully",
            "content": {
                "application/json": {
                    "example": CREATE_ADMIN_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        409: {"description": "Email or unique role metadata already exists"},
        422: {"description": "Invalid role metadata payload"},
        500: {"description": "Internal Server Error"},
    },
)
async def create_admin(
    request: Request,
    payload: CreateAdminRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserCreationResponse:
    """
    Create a new admin account.

    Requires:
        Authenticated ADMIN user.
    """

    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=user_id,
        subject_hint=payload.email,
    )
    await _ensure_admin(user_id)

    logger.info(
        "AUTH: create admin request",
        extra={
            "admin_id": user_id,
            "email_hash": hash_sensitive_value(payload.email),
        },
    )

    try:
        result = await AuthService.create_admin(payload)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: create admin failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": user_id,
                "email_hash": hash_sensitive_value(payload.email),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return UserCreationResponse(
        status=200,
        message="Admin account created successfully",
        data=UserCreationData(**result.model_dump()),
        timestamp_ms=int(time.time() * 1000),
    )


@router.patch(
    "/{user_id}/profile",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "User profile updated successfully",
            "content": {
                "application/json": {
                    "example": ADMIN_UPDATE_PROFILE_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "User profile not found"},
        409: {"description": "Unique role-specific value already exists"},
        422: {"description": "Invalid update payload for the target user role"},
        500: {"description": "Internal Server Error"},
    },
)
async def update_user_profile(
    request: Request,
    user_id: UUID,
    payload: AdminUpdateUserProfileRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Update a target user's profile as an authenticated admin.
    """

    admin_id = getattr(request.state, "user_id", None)

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=admin_id,
        subject_hint=str(user_id),
    )
    await _ensure_admin(admin_id)

    logger.info(
        "AUTH: admin update user profile request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "admin_id": admin_id,
            "target_user_id": str(user_id),
            "fields_supplied": [
                field_name
                for field_name, field_value in payload.model_dump().items()
                if field_value is not None
            ],
        },
    )

    try:
        await AuthService.admin_update_profile(admin_id, user_id, payload)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: admin update user profile failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": admin_id,
                "target_user_id": str(user_id),
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
        message="User profile updated successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.patch(
    "/{user_id}/status",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "User status updated successfully",
            "content": {
                "application/json": {
                    "example": ADMIN_UPDATE_STATUS_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "User profile not found"},
        429: {"description": "Too Many Requests"},
        500: {"description": "Internal Server Error"},
    },
)
async def update_user_status(
    request: Request,
    user_id: UUID,
    payload: AdminUpdateUserStatusRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Update a target user's activation state as an authenticated admin.
    """

    admin_id = getattr(request.state, "user_id", None)

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=admin_id,
        subject_hint=f"{user_id}:{payload.is_active}",
    )
    await _ensure_admin(admin_id)

    logger.info(
        "AUTH: admin update user status request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "admin_id": admin_id,
            "target_user_id": str(user_id),
            "is_active": payload.is_active,
        },
    )

    try:
        await AuthService.admin_update_user_status(
            admin_id,
            user_id,
            payload.is_active,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: admin update user status failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": admin_id,
                "target_user_id": str(user_id),
                "is_active": payload.is_active,
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
        message="User status updated successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )


@router.delete(
    "/{user_id}",
    response_model=SimpleMessageResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "User account deleted successfully",
            "content": {
                "application/json": {
                    "example": ADMIN_DELETE_USER_SUCCESS_EXAMPLE
                }
            },
        },
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden"},
        404: {"description": "User profile not found"},
        500: {"description": "Internal Server Error"},
    },
)
async def delete_user(
    request: Request,
    user_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    """
    Delete a target user's account as an authenticated admin.
    """

    admin_id = getattr(request.state, "user_id", None)

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    await _enforce_admin_auth_rate_limit(
        request,
        user_id=admin_id,
        subject_hint=str(user_id),
    )
    await _ensure_admin(admin_id)

    logger.info(
        "AUTH: admin delete user request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "admin_id": admin_id,
            "target_user_id": str(user_id),
        },
    )

    try:
        await AuthService.admin_delete_user(admin_id, user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AUTH: admin delete user failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "admin_id": admin_id,
                "target_user_id": str(user_id),
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
        message="User account deleted successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
