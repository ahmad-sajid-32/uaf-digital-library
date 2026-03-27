# apps/api/modules/auth/service.py
"""
Auth Service Layer for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Read admin-managed user list/detail data from the centralized database view.
- Resolve public account-state checks, including inactive-account detection.
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
    AdminUpdateUserProfileRequest,
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
    async def _validate_user_creation_metadata(
        *,
        role: str,
        roll_number: str | None = None,
        department: str | None = None,
        semester: int | None = None,
        employee_code: str | None = None,
        designation: str | None = None,
    ) -> None:
        """
        Run database-owned metadata preflight checks before auth-user creation.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    select library.validate_admin_user_creation_metadata(
                        $1::text,
                        $2::text,
                        $3::text,
                        $4::integer,
                        $5::text,
                        $6::text
                    )
                    """,
                    role,
                    roll_number,
                    department,
                    semester,
                    employee_code,
                    designation,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: create-user metadata preflight failed",
                extra={
                    "role": role,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    def _resolve_role_metadata_persistence_error(exc: asyncpg.PostgresError) -> str:
        """
        Convert role-metadata insert conflicts into stable API messages.
        """

        if exc.sqlstate == "23505":
            error_message = str(exc).lower()

            if "roll_number" in error_message:
                return "Roll number already exists"

            if "employee_code" in error_message:
                return "Employee code already exists"

        return str(exc)

    @staticmethod
    async def _cleanup_failed_provisioned_user(
        *,
        user_id: UUID | None = None,
        email: str | None = None,
    ) -> None:
        """
        Remove a partially created auth user after a failed create flow.
        """

        resolved_user_id = user_id

        if resolved_user_id is None and email:
            try:
                supabase_user = await AuthService._get_supabase_user_by_email(email)
                resolved_user_id = UUID(supabase_user["id"])
            except RuntimeError:
                logger.warning(
                    "AUTH: failed create cleanup skipped because user lookup failed",
                    extra={
                        "email_hash": hash_sensitive_value(email),
                    },
                )
                return

        if resolved_user_id is None:
            logger.warning(
                "AUTH: failed create cleanup skipped because no user was resolved"
            )
            return

        pool = Database.get_pool()

        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "select library.cleanup_failed_provisioned_user($1::uuid)",
                    resolved_user_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: failed create cleanup failed",
                extra={
                    "user_id": str(resolved_user_id),
                    "email_hash": hash_sensitive_value(email) if email else None,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            return

        logger.warning(
            "AUTH: partially created user cleaned up after failed create",
            extra={
                "user_id": str(resolved_user_id),
                "email_hash": hash_sensitive_value(email) if email else None,
            },
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
            is_inactive = await conn.fetchval(
                """
                select exists (
                    select 1
                    from auth.users u
                    join library.profiles p
                      on p.id = u.id
                    where lower(u.email) = $1
                      and p.is_active = false
                )
                """,
                normalized_email,
            )

        return AccountStatusData(
            has_account=bool(has_account),
            is_deleted=bool(is_deleted),
            is_inactive=bool(is_inactive),
        )

    @staticmethod
    def _serialize_admin_user_row(row: asyncpg.Record) -> Dict[str, Any]:
        """
        Convert an admin-user directory row into the stable API object shape.
        """

        return {
            "user_id": row["user_id"],
            "email": row["email"],
            "role": row["role"],
            "is_active": row["is_active"],
            "full_name": row["full_name"],
            "roll_number": row["roll_number"],
            "department": row["department"],
            "semester": row["semester"],
            "employee_code": row["employee_code"],
            "designation": row["designation"],
            "created_at": row["created_at"],
        }

    @staticmethod
    def _serialize_admin_user_detail_row(row: asyncpg.Record) -> Dict[str, Any]:
        """
        Convert one admin-user directory row into the role-explicit detail shape.
        """

        role = row["role"]
        user_id = str(row["user_id"])
        base_payload = {
            "user_id": row["user_id"],
            "email": row["email"],
            "role": role,
            "is_active": row["is_active"],
            "full_name": row["full_name"],
            "created_at": row["created_at"],
        }

        if role == "STUDENT":
            if (
                row["roll_number"] is None
                or row["department"] is None
                or row["semester"] is None
            ):
                logger.error(
                    "AUTH: student detail row missing role metadata",
                    extra={
                        "target_user_id": user_id,
                    },
                )
                raise RuntimeError("Student profile metadata missing")

            return {
                **base_payload,
                "student_profile": {
                    "roll_number": row["roll_number"],
                    "department": row["department"],
                    "semester": row["semester"],
                },
            }

        if role == "LIBRARIAN":
            if row["employee_code"] is None or row["department"] is None:
                logger.error(
                    "AUTH: librarian detail row missing role metadata",
                    extra={
                        "target_user_id": user_id,
                    },
                )
                raise RuntimeError("Librarian profile metadata missing")

            return {
                **base_payload,
                "librarian_profile": {
                    "employee_code": row["employee_code"],
                    "department": row["department"],
                },
            }

        if role == "ADMIN":
            if row["designation"] is None:
                logger.error(
                    "AUTH: admin detail row missing role metadata",
                    extra={
                        "target_user_id": user_id,
                    },
                )
                raise RuntimeError("Admin profile metadata missing")

            return {
                **base_payload,
                "admin_profile": {
                    "designation": row["designation"],
                },
            }

        raise RuntimeError("Unsupported user role")

    @staticmethod
    async def list_admin_users(
        admin_id: str,
        *,
        role: str | None,
        is_active: bool | None,
        search: str | None,
        limit: int,
        offset: int,
    ) -> Dict[str, Any]:
        """
        Retrieve a filtered admin-managed user list from the centralized view.
        """

        logger.info(
            "AUTH: fetching admin user list",
            extra={
                "admin_id": admin_id,
                "role_filter": role,
                "is_active_filter": is_active,
                "search_applied": bool(search),
                "limit": limit,
                "offset": offset,
            },
        )

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    admin_id,
                )

                rows = await connection.fetch(
                    """
                    select
                        aud.user_id,
                        aud.email,
                        aud.role,
                        aud.is_active,
                        aud.full_name,
                        aud.roll_number,
                        aud.department,
                        aud.semester,
                        aud.employee_code,
                        aud.designation,
                        aud.created_at,
                        count(*) over() as total_count
                    from library.admin_user_directory aud
                    where ($1::text is null or lower(aud.role) = $1::text)
                      and ($2::boolean is null or aud.is_active = $2::boolean)
                      and (
                        $3::text is null
                        or aud.email ilike '%' || $3 || '%'
                        or aud.full_name ilike '%' || $3 || '%'
                        or coalesce(aud.roll_number, '') ilike '%' || $3 || '%'
                        or coalesce(aud.employee_code, '') ilike '%' || $3 || '%'
                        or coalesce(aud.department, '') ilike '%' || $3 || '%'
                        or coalesce(aud.designation, '') ilike '%' || $3 || '%'
                      )
                    order by aud.created_at desc, aud.user_id desc
                    limit $4::integer
                    offset $5::integer
                    """,
                    role,
                    is_active,
                    search,
                    limit,
                    offset,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: admin user list query failed",
                extra={
                    "admin_id": admin_id,
                    "role_filter": role,
                    "is_active_filter": is_active,
                    "search_applied": bool(search),
                    "limit": limit,
                    "offset": offset,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        items = [AuthService._serialize_admin_user_row(row) for row in rows]
        total = int(rows[0]["total_count"]) if rows else 0

        logger.info(
            "AUTH: admin user list fetched",
            extra={
                "admin_id": admin_id,
                "items_returned": len(items),
                "total": total,
                "limit": limit,
                "offset": offset,
            },
        )

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    async def get_admin_user_detail(
        admin_id: str,
        target_user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Retrieve one admin-managed user from the centralized view.
        """

        logger.info(
            "AUTH: fetching admin user detail",
            extra={
                "admin_id": admin_id,
                "target_user_id": str(target_user_id),
            },
        )

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    admin_id,
                )

                row = await connection.fetchrow(
                    """
                    select
                        user_id,
                        email,
                        role,
                        is_active,
                        full_name,
                        roll_number,
                        department,
                        semester,
                        employee_code,
                        designation,
                        created_at
                    from library.admin_user_directory
                    where user_id = $1::uuid
                    """,
                    target_user_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: admin user detail query failed",
                extra={
                    "admin_id": admin_id,
                    "target_user_id": str(target_user_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("User not found")

        logger.info(
            "AUTH: admin user detail fetched",
            extra={
                "admin_id": admin_id,
                "target_user_id": str(target_user_id),
            },
        )

        return AuthService._serialize_admin_user_detail_row(row)

    @staticmethod
    async def create_student(
        data: CreateStudentRequest,
    ) -> UserCreationData:
        """
        Create a student account.
        """

        await AuthService._validate_user_creation_metadata(
            role="STUDENT",
            roll_number=data.roll_number,
            department=data.department,
            semester=data.semester,
        )

        pool = Database.get_pool()
        user_id: UUID | None = None
        auth_user_created = False

        try:
            await AuthService._invite_supabase_user(
                email=data.email,
                full_name=data.full_name,
                redirect_path="/setup-password",
            )
            auth_user_created = True
            supabase_user = await AuthService._get_supabase_user_by_email(data.email)
            user_id = UUID(supabase_user["id"])
            await AuthService._update_supabase_user_metadata(
                user_id=user_id,
                full_name=data.full_name,
                role="STUDENT",
            )

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
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: student role metadata persistence failed",
                extra={
                    "email_hash": hash_sensitive_value(data.email),
                    "user_id": str(user_id) if user_id else None,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            if auth_user_created:
                await AuthService._cleanup_failed_provisioned_user(
                    user_id=user_id,
                    email=data.email,
                )

            raise RuntimeError(
                AuthService._resolve_role_metadata_persistence_error(exc)
            ) from exc
        except RuntimeError:
            if auth_user_created:
                await AuthService._cleanup_failed_provisioned_user(
                    user_id=user_id,
                    email=data.email,
                )
            raise

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

        await AuthService._validate_user_creation_metadata(
            role="LIBRARIAN",
            department=data.department,
            employee_code=data.employee_code,
        )

        pool = Database.get_pool()
        user_id: UUID | None = None
        auth_user_created = False

        try:
            await AuthService._invite_supabase_user(
                email=data.email,
                full_name=data.full_name,
                redirect_path="/setup-password",
            )
            auth_user_created = True
            supabase_user = await AuthService._get_supabase_user_by_email(data.email)
            user_id = UUID(supabase_user["id"])
            await AuthService._update_supabase_user_metadata(
                user_id=user_id,
                full_name=data.full_name,
                role="LIBRARIAN",
            )

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
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: librarian role metadata persistence failed",
                extra={
                    "email_hash": hash_sensitive_value(data.email),
                    "user_id": str(user_id) if user_id else None,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            if auth_user_created:
                await AuthService._cleanup_failed_provisioned_user(
                    user_id=user_id,
                    email=data.email,
                )

            raise RuntimeError(
                AuthService._resolve_role_metadata_persistence_error(exc)
            ) from exc
        except RuntimeError:
            if auth_user_created:
                await AuthService._cleanup_failed_provisioned_user(
                    user_id=user_id,
                    email=data.email,
                )
            raise

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

        await AuthService._validate_user_creation_metadata(
            role="ADMIN",
            designation=data.designation,
        )

        pool = Database.get_pool()
        user_id: UUID | None = None
        auth_user_created = False

        try:
            await AuthService._invite_supabase_user(
                email=data.email,
                full_name=data.full_name,
                redirect_path="/setup-password",
            )
            auth_user_created = True
            supabase_user = await AuthService._get_supabase_user_by_email(data.email)
            user_id = UUID(supabase_user["id"])
            await AuthService._update_supabase_user_metadata(
                user_id=user_id,
                full_name=data.full_name,
                role="ADMIN",
            )

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
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: admin role metadata persistence failed",
                extra={
                    "email_hash": hash_sensitive_value(data.email),
                    "user_id": str(user_id) if user_id else None,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            if auth_user_created:
                await AuthService._cleanup_failed_provisioned_user(
                    user_id=user_id,
                    email=data.email,
                )

            raise RuntimeError(
                AuthService._resolve_role_metadata_persistence_error(exc)
            ) from exc
        except RuntimeError:
            if auth_user_created:
                await AuthService._cleanup_failed_provisioned_user(
                    user_id=user_id,
                    email=data.email,
                )
            raise

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
        payload: AdminUpdateUserProfileRequest,
    ) -> None:
        """
        Update a target user's role-specific profile fields through PostgreSQL RPC.
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
                        """
                        select library.admin_update_profile(
                            $1::uuid,
                            $2::text,
                            $3::text,
                            $4::text,
                            $5::integer,
                            $6::text,
                            $7::text
                        )
                        """,
                        target_user_id,
                        payload.full_name,
                        payload.roll_number,
                        payload.department,
                        payload.semester,
                        payload.employee_code,
                        payload.designation,
                    )
        except asyncpg.PostgresError as exc:
            if exc.sqlstate == "23505":
                error_message = str(exc).lower()

                if "roll_number" in error_message:
                    raise RuntimeError("Roll number already exists") from exc

                if "employee_code" in error_message:
                    raise RuntimeError("Employee code already exists") from exc

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
    async def admin_update_user_status(
        admin_id: str,
        target_user_id: UUID,
        is_active: bool,
    ) -> None:
        """
        Update a target user's activation state through PostgreSQL RPC.
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
                        """
                        select library.admin_set_user_active_status(
                            $1::uuid,
                            $2::boolean
                        )
                        """,
                        target_user_id,
                        is_active,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: admin update user status RPC failed",
                extra={
                    "admin_id": admin_id,
                    "target_user_id": str(target_user_id),
                    "is_active": is_active,
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
