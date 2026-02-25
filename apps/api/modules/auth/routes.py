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

from fastapi import APIRouter, Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.database import Database
from core.logging import get_logger

from modules.auth.schemas import (
    CreateStudentRequest,
    CreateLibrarianRequest,
    CreateAdminRequest,
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


# ============================================================
# Create Student
# ============================================================

@router.post(
    "/students",
    response_model=UserCreationResponse,
    status_code=status.HTTP_200_OK,
    responses={
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

    return await AuthService.create_student(payload)


# ============================================================
# Create Librarian
# ============================================================

@router.post(
    "/librarians",
    response_model=UserCreationResponse,
    status_code=status.HTTP_200_OK,
    responses={
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

    return await AuthService.create_librarian(payload)


# ============================================================
# Create Admin
# ============================================================

@router.post(
    "/admins",
    response_model=UserCreationResponse,
    status_code=status.HTTP_200_OK,
    responses={
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

    return await AuthService.create_admin(payload)