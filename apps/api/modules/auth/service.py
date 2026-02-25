# apps/api/modules/auth/service.py
"""
Auth Service Layer for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Create users via Supabase Admin API.
- Propagate role via app_metadata.
- Insert role-specific metadata into library tables.
- Generate password recovery link.
- Return structured creation result.

Architectural Constraints:
- No route logic here.
- No JWT validation here.
- No business rules outside database.
- Uses SUPABASE_SERVICE_ROLE_KEY securely.
"""

import httpx
from uuid import UUID
from typing import Dict, Any

from core.config import settings
from core.database import Database
from core.logging import get_logger

from modules.auth.schemas import (
    CreateStudentRequest,
    CreateLibrarianRequest,
    CreateAdminRequest,
    UserCreationResponse,
)

logger = get_logger(__name__)


class AuthService:
    """
    Service responsible for admin-driven user provisioning.
    """

    @staticmethod
    async def _create_supabase_user(
        email: str,
        full_name: str,
        role: str,
    ) -> Dict[str, Any]:
        """
        Create user in Supabase Auth using Admin API.
        """

        url = f"{settings.supabase_project_url}/auth/v1/admin/users"

        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "apikey": settings.supabase_service_role_key,
        }

        payload = {
            "email": email,
            "email_confirm": True,
            "app_metadata": {"role": role},
            "user_metadata": {"full_name": full_name},
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, headers=headers, json=payload)

        if response.status_code >= 400:
            logger.error(
                "AUTH: Supabase user creation failed",
                extra={"status_code": response.status_code, "error": response.text},
            )
            raise RuntimeError("Failed to create user in Supabase")

        logger.info(
            "AUTH: Supabase user created",
            extra={"email": email, "role": role},
        )

        return response.json()

    @staticmethod
    async def _generate_password_recovery(email: str) -> None:
        """
        Trigger password recovery email for user.
        """

        url = f"{settings.supabase_project_url}/auth/v1/recover"

        headers = {
            "Content-Type": "application/json",
            "apikey": settings.supabase_service_role_key,
        }

        payload = {"email": email}

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, headers=headers, json=payload)

        if response.status_code >= 400:
            logger.error(
                "AUTH: Password recovery trigger failed",
                extra={"status_code": response.status_code, "error": response.text},
            )
            raise RuntimeError("Failed to send password recovery email")

        logger.info(
            "AUTH: Password recovery email sent",
            extra={"email": email},
        )

    @staticmethod
    async def create_student(
        data: CreateStudentRequest,
    ) -> UserCreationResponse:
        """
        Create a student account.
        """

        supabase_user = await AuthService._create_supabase_user(
            email=data.email,
            full_name=data.full_name,
            role="STUDENT",
        )

        user_id = UUID(supabase_user["id"])

        pool = Database.get_pool()

        async with pool.acquire() as conn:
            await conn.execute(
                """
                insert into library.students (
                    id,
                    roll_number,
                    department,
                    semester
                )
                values ($1, $2, $3, $4)
                """,
                user_id,
                data.roll_number,
                data.department,
                data.semester,
            )

        await AuthService._generate_password_recovery(data.email)

        logger.info(
            "AUTH: student created successfully",
            extra={"user_id": str(user_id)},
        )

        return UserCreationResponse(
            user_id=user_id,
            email=data.email,
            role="STUDENT",
            password_setup_required=True,
        )

    @staticmethod
    async def create_librarian(
        data: CreateLibrarianRequest,
    ) -> UserCreationResponse:
        """
        Create a librarian account.
        """

        supabase_user = await AuthService._create_supabase_user(
            email=data.email,
            full_name=data.full_name,
            role="LIBRARIAN",
        )

        user_id = UUID(supabase_user["id"])

        pool = Database.get_pool()

        async with pool.acquire() as conn:
            await conn.execute(
                """
                insert into library.librarians (
                    id,
                    employee_code,
                    department
                )
                values ($1, $2, $3)
                """,
                user_id,
                data.employee_code,
                data.department,
            )

        await AuthService._generate_password_recovery(data.email)

        logger.info(
            "AUTH: librarian created successfully",
            extra={"user_id": str(user_id)},
        )

        return UserCreationResponse(
            user_id=user_id,
            email=data.email,
            role="LIBRARIAN",
            password_setup_required=True,
        )

    @staticmethod
    async def create_admin(
        data: CreateAdminRequest,
    ) -> UserCreationResponse:
        """
        Create an admin account.
        """

        supabase_user = await AuthService._create_supabase_user(
            email=data.email,
            full_name=data.full_name,
            role="ADMIN",
        )

        user_id = UUID(supabase_user["id"])

        pool = Database.get_pool()

        async with pool.acquire() as conn:
            await conn.execute(
                """
                insert into library.admins (
                    id,
                    designation
                )
                values ($1, $2)
                """,
                user_id,
                data.designation,
            )

        await AuthService._generate_password_recovery(data.email)

        logger.info(
            "AUTH: admin created successfully",
            extra={"user_id": str(user_id)},
        )

        return UserCreationResponse(
            user_id=user_id,
            email=data.email,
            role="ADMIN",
            password_setup_required=True,
        )