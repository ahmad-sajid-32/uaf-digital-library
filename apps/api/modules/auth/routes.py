# apps/api/modules/auth/routes.py
"""
Auth Routes Module for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Expose admin-only user creation endpoints.
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

from modules.auth.schemas import (
    ADMIN_DELETE_USER_SUCCESS_EXAMPLE,
    ADMIN_UPDATE_PROFILE_SUCCESS_EXAMPLE,
    CREATE_ADMIN_SUCCESS_EXAMPLE,
    CREATE_LIBRARIAN_SUCCESS_EXAMPLE,
    CREATE_STUDENT_SUCCESS_EXAMPLE,
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


def _resolve_runtime_error_status(message: str) -> int:
    """
    Map deterministic PostgreSQL errors to HTTP status codes.
    """

    if "Authentication required" in message:
        return status.HTTP_401_UNAUTHORIZED

    if "Insufficient privileges" in message:
        return status.HTTP_403_FORBIDDEN

    if "Profile not found" in message:
        return status.HTTP_404_NOT_FOUND

    if "Invalid full_name" in message:
        return status.HTTP_400_BAD_REQUEST

    return status.HTTP_500_INTERNAL_SERVER_ERROR


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

    await _ensure_admin(user_id)

    logger.info(
        "AUTH: create student request",
        extra={"admin_id": user_id, "email": payload.email},
    )

    result = await AuthService.create_student(payload)

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

    await _ensure_admin(user_id)

    logger.info(
        "AUTH: create librarian request",
        extra={"admin_id": user_id, "email": payload.email},
    )

    result = await AuthService.create_librarian(payload)

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

    await _ensure_admin(user_id)

    logger.info(
        "AUTH: create admin request",
        extra={"admin_id": user_id, "email": payload.email},
    )

    result = await AuthService.create_admin(payload)

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

    await _ensure_admin(admin_id)

    logger.info(
        "AUTH: admin update user profile request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "admin_id": admin_id,
            "target_user_id": str(user_id),
        },
    )

    try:
        await AuthService.admin_update_profile(admin_id, user_id, payload.full_name)
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
