# apps/api/modules/auth/service.py
"""
Auth Service Layer for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Create users via Supabase Admin API.
- Propagate role via app_metadata.
- Insert role-specific metadata into library tables.
- Generate password recovery link.
- Execute admin profile-management RPCs.
- Return structured creation result.

Architectural Constraints:
- No route logic here.
- No JWT validation here.
- No business rules outside database.
- Uses SUPABASE_SERVICE_ROLE_KEY securely.
"""

from typing import Any, Dict
from uuid import UUID

import asyncpg
import httpx

from core.config import settings
from core.database import Database
from core.logging import get_logger
from core.rate_limit import hash_sensitive_value

from modules.auth.schemas import (
    AccountStatusData,
    CreateStudentRequest,
    CreateLibrarianRequest,
    CreateAdminRequest,
    UserCreationData,
)

logger = get_logger(__name__)


class AuthService:
    """
    Service responsible for admin-driven user provisioning.
    """

    @staticmethod
    def _resolve_supabase_user_creation_error(response: httpx.Response) -> str:
        """
        Convert Supabase Admin API user-creation failures into stable messages.

        This keeps route-layer error mapping deterministic and prevents known
        conflicts, such as duplicate emails, from collapsing into generic 500s.
        """

        payload: Dict[str, Any] = {}

        try:
            payload = response.json()
        except ValueError:
            payload = {}

        code = str(payload.get("code", "")).strip()
        error_code = str(payload.get("error_code", "")).strip()
        message = str(payload.get("message", "")).strip()
        msg = str(payload.get("msg", "")).strip()
        detail = str(payload.get("detail", "")).strip()
        combined_error = " ".join([code, error_code, message, msg, detail]).lower()

        if (
            code == "23505"
            or error_code == "email_exists"
            or "already exists" in combined_error
            or "already been registered" in combined_error
            or "duplicate key value violates unique constraint" in combined_error
            or "users_email_partial_key" in combined_error
        ):
            return "User with this email already exists"

        return "Failed to create user in Supabase"

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
            error_message = AuthService._resolve_supabase_user_creation_error(
                response
            )
            logger.error(
                "AUTH: Supabase user creation failed",
                extra={
                    "status_code": response.status_code,
                    "error": response.text,
                    "mapped_error": error_message,
                    "email_hash": hash_sensitive_value(email),
                },
            )
            raise RuntimeError(error_message)

        logger.info(
            "AUTH: Supabase user created",
            extra={
                "email_hash": hash_sensitive_value(email),
                "role": role,
            },
        )

        return response.json()

    @staticmethod
    async def _invite_supabase_user(
        email: str,
        full_name: str,
        redirect_path: str = "/setup-password",
    ) -> None:
        """
        Send a first-time password setup invite email through Supabase.
        """

        url = f"{settings.supabase_project_url}/auth/v1/invite"

        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "apikey": settings.supabase_service_role_key,
        }

        normalized_path = (
            redirect_path if redirect_path.startswith("/") else f"/{redirect_path}"
        )
        redirect_to = f"{settings.frontend_app_url.rstrip('/')}{normalized_path}"
        payload = {
            "email": email,
            "redirect_to": redirect_to,
            "data": {
                "full_name": full_name,
            },
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, headers=headers, json=payload)

        if response.status_code >= 400:
            error_message = AuthService._resolve_supabase_user_creation_error(
                response
            )
            logger.error(
                "AUTH: Supabase invite trigger failed",
                extra={
                    "status_code": response.status_code,
                    "error": response.text,
                    "mapped_error": error_message,
                    "email_hash": hash_sensitive_value(email),
                },
            )
            raise RuntimeError(error_message)

        logger.info(
            "AUTH: Supabase invite email sent",
            extra={
                "email_hash": hash_sensitive_value(email),
                "redirect_to": redirect_to,
            },
        )

    @staticmethod
    async def _get_supabase_user_by_email(email: str) -> Dict[str, Any]:
        """
        Retrieve a Supabase Auth user record by normalized email.
        """

        normalized_email = email.strip().lower()
        url = f"{settings.supabase_project_url}/auth/v1/admin/users"
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "apikey": settings.supabase_service_role_key,
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url, headers=headers)

        if response.status_code >= 400:
            logger.error(
                "AUTH: Supabase user lookup failed",
                extra={
                    "status_code": response.status_code,
                    "error": response.text,
                    "email_hash": hash_sensitive_value(email),
                },
            )
            raise RuntimeError("Failed to retrieve invited user from Supabase")

        payload = response.json()
        users = payload.get("users", [])
        user = next(
            (
                item
                for item in users
                if str(item.get("email", "")).strip().lower() == normalized_email
            ),
            None,
        )

        if user is None:
            raise RuntimeError("Failed to retrieve invited user from Supabase")

        return user

    @staticmethod
    async def _update_supabase_user_metadata(
        user_id: UUID,
        full_name: str,
        role: str,
    ) -> None:
        """
        Persist user and app metadata on a previously invited Supabase user.
        """

        url = f"{settings.supabase_project_url}/auth/v1/admin/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "apikey": settings.supabase_service_role_key,
        }
        payload = {
            "app_metadata": {"role": role},
            "user_metadata": {"full_name": full_name},
        }

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.put(url, headers=headers, json=payload)

        if response.status_code >= 400:
            logger.error(
                "AUTH: Supabase user metadata update failed",
                extra={
                    "status_code": response.status_code,
                    "error": response.text,
                    "user_id": str(user_id),
                    "role": role,
                },
            )
            raise RuntimeError("Failed to finalize invited user in Supabase")

        logger.info(
            "AUTH: Supabase user metadata updated",
            extra={"user_id": str(user_id), "role": role},
        )

    @staticmethod
    async def _clear_deleted_account_marker(email: str) -> None:
        """
        Deactivate any deleted-account marker for an email after recreation.
        """

        normalized_email = email.strip().lower()
        pool = Database.get_pool()

        async with pool.acquire() as conn:
            await conn.execute(
                "select library.clear_deleted_account_marker($1::text)",
                normalized_email,
            )

    @staticmethod
    async def get_account_status(email: str) -> AccountStatusData:
        """
        Check whether an email belongs to an active or deleted account.
        """

        normalized_email = email.strip().lower()
        pool = Database.get_pool()

        async with pool.acquire() as conn:
            has_account = await conn.fetchval(
                """
                select exists (
                    select 1
                    from auth.users
                    where lower(email) = $1
                )
                """,
                normalized_email,
            )
            is_deleted = await conn.fetchval(
                "select library.is_account_deleted($1::text)",
                normalized_email,
            )

        return AccountStatusData(
            has_account=bool(has_account),
            is_deleted=bool(is_deleted),
        )

    @staticmethod
    async def create_student(
        data: CreateStudentRequest,
    ) -> UserCreationData:
        """
        Create a student account.
        """

        await AuthService._invite_supabase_user(
            email=data.email,
            full_name=data.full_name,
            redirect_path="/setup-password",
        )
        supabase_user = await AuthService._get_supabase_user_by_email(data.email)
        user_id = UUID(supabase_user["id"])
        await AuthService._update_supabase_user_metadata(
            user_id=user_id,
            full_name=data.full_name,
            role="STUDENT",
        )

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

        await AuthService._clear_deleted_account_marker(data.email)

        logger.info(
            "AUTH: student created successfully",
            extra={"user_id": str(user_id)},
        )

        return UserCreationData(
            user_id=user_id,
            email=data.email,
            role="STUDENT",
            password_setup_required=True,
        )

    @staticmethod
    async def create_librarian(
        data: CreateLibrarianRequest,
    ) -> UserCreationData:
        """
        Create a librarian account.
        """

        await AuthService._invite_supabase_user(
            email=data.email,
            full_name=data.full_name,
            redirect_path="/setup-password",
        )
        supabase_user = await AuthService._get_supabase_user_by_email(data.email)
        user_id = UUID(supabase_user["id"])
        await AuthService._update_supabase_user_metadata(
            user_id=user_id,
            full_name=data.full_name,
            role="LIBRARIAN",
        )

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

        await AuthService._clear_deleted_account_marker(data.email)

        logger.info(
            "AUTH: librarian created successfully",
            extra={"user_id": str(user_id)},
        )

        return UserCreationData(
            user_id=user_id,
            email=data.email,
            role="LIBRARIAN",
            password_setup_required=True,
        )

    @staticmethod
    async def create_admin(
        data: CreateAdminRequest,
    ) -> UserCreationData:
        """
        Create an admin account.
        """

        await AuthService._invite_supabase_user(
            email=data.email,
            full_name=data.full_name,
            redirect_path="/setup-password",
        )
        supabase_user = await AuthService._get_supabase_user_by_email(data.email)
        user_id = UUID(supabase_user["id"])
        await AuthService._update_supabase_user_metadata(
            user_id=user_id,
            full_name=data.full_name,
            role="ADMIN",
        )

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

        await AuthService._clear_deleted_account_marker(data.email)

        logger.info(
            "AUTH: admin created successfully",
            extra={"user_id": str(user_id)},
        )

        return UserCreationData(
            user_id=user_id,
            email=data.email,
            role="ADMIN",
            password_setup_required=True,
        )

    @staticmethod
    async def admin_update_profile(
        admin_id: str,
        target_user_id: UUID,
        full_name: str,
    ) -> None:
        """
        Update a target user's full name through PostgreSQL RPC.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        admin_id,
                    )
                    await conn.execute(
                        "select library.admin_update_profile($1::uuid, $2::text)",
                        target_user_id,
                        full_name,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: admin update profile RPC failed",
                extra={
                    "admin_id": admin_id,
                    "target_user_id": str(target_user_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    async def admin_delete_user(
        admin_id: str,
        target_user_id: UUID,
    ) -> None:
        """
        Delete a target user through PostgreSQL RPC.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    await conn.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        admin_id,
                    )
                    await conn.execute(
                        "select library.admin_delete_user($1::uuid)",
                        target_user_id,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: admin delete user RPC failed",
                extra={
                    "admin_id": admin_id,
                    "target_user_id": str(target_user_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc
