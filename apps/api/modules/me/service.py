# apps/api/modules/me/service.py
"""
Me Module - Service Layer

Responsibilities:
- Execute PostgreSQL read RPCs for authenticated self-service views.
- Set authenticated user identity in session context before RPC calls.
- Preserve database errors for deterministic route-level mapping.
"""

import json
from typing import Any, Dict, List, Tuple

import asyncpg
from fastapi import UploadFile

from core.config import settings
from core.database import Database
from core.logging import get_logger
from services.storage_service import StorageService

logger = get_logger(__name__)


class MeService:
    """
    Thin RPC wrapper for authenticated user read endpoints.
    """

    PROFILE_AVATAR_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
    PROFILE_AVATAR_EXTENSION_BY_MIME_TYPE = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }

    @staticmethod
    async def get_active_borrows(user_id: str) -> List[Dict[str, Any]]:
        return await MeService._fetch_rows(
            query="select * from library.get_my_active_borrows($1::uuid)",
            action="get active borrows",
            user_id=user_id,
            parameters=(user_id,),
        )

    @staticmethod
    async def get_borrow_history(user_id: str, limit: int) -> List[Dict[str, Any]]:
        return await MeService._fetch_rows(
            query="select * from library.get_my_borrow_history($1::uuid, $2::int)",
            action="get borrow history",
            user_id=user_id,
            parameters=(user_id, limit),
        )

    @staticmethod
    async def get_fines(user_id: str) -> List[Dict[str, Any]]:
        return await MeService._fetch_rows(
            query="select * from library.get_my_fines($1::uuid)",
            action="get fines",
            user_id=user_id,
            parameters=(user_id,),
        )

    @staticmethod
    async def get_my_fine_history(user_id: str) -> List[Dict[str, Any]]:
        return await MeService._fetch_rows(
            query="select * from library.get_my_fine_history()",
            action="get fine history",
            user_id=user_id,
            parameters=(),
        )

    @staticmethod
    async def get_queue_entries(user_id: str) -> List[Dict[str, Any]]:
        rows = await MeService._fetch_rows(
            query="select * from library.get_my_queue_entries($1::uuid)",
            action="get queue entries",
            user_id=user_id,
            parameters=(user_id,),
        )

        normalized_rows: List[Dict[str, Any]] = []

        for row in rows:
            normalized_row = dict(row)

            if "position" not in normalized_row and "queue_position" in normalized_row:
                normalized_row["position"] = normalized_row["queue_position"]

            normalized_row.pop("queue_position", None)
            normalized_rows.append(normalized_row)

        return normalized_rows

    @staticmethod
    async def get_student_dashboard(user_id: str) -> Dict[str, Any]:
        return await MeService._fetch_jsonb_object(
            query="select library.get_my_dashboard($1::uuid)",
            action="get student dashboard",
            user_id=user_id,
            parameters=(user_id,),
        )

    @staticmethod
    async def update_my_profile(user_id: str, full_name: str) -> None:
        """
        Update the authenticated user's profile via PostgreSQL RPC.
        """

        await MeService._execute_void_rpc(
            user_id=user_id,
            action="update profile",
            query="select library.update_my_profile($1::text)",
            parameters=(full_name,),
        )

    @staticmethod
    async def get_my_avatar(user_id: str) -> Dict[str, Any]:
        """
        Return current avatar metadata with a renderable signed URL.
        """

        metadata = await MeService._get_my_avatar_metadata(user_id)
        return await MeService._attach_avatar_url(metadata)

    @staticmethod
    async def upload_my_avatar(user_id: str, file: UploadFile) -> Dict[str, Any]:
        """
        Validate and upload the authenticated user's avatar image.
        """

        content_type = (file.content_type or "").strip().lower()
        content = await file.read()

        MeService._validate_avatar_upload(
            content=content,
            content_type=content_type,
        )

        avatar_image_path = MeService._build_avatar_object_path(
            user_id=user_id,
            content_type=content_type,
        )
        bucket_name = settings.supabase_storage_bucket_profile_avatars

        await StorageService.upload_object(
            bucket_name=bucket_name,
            object_path=avatar_image_path,
            content=content,
            content_type=content_type,
            upsert=True,
        )

        try:
            metadata = await MeService._set_my_avatar_metadata(
                user_id=user_id,
                avatar_image_path=avatar_image_path,
                avatar_image_mime_type=content_type,
                avatar_image_size_bytes=len(content),
            )
        except RuntimeError:
            await MeService._delete_avatar_object_after_failed_metadata(
                avatar_image_path=avatar_image_path
            )
            raise

        logger.info(
            "ME: profile avatar uploaded",
            extra={
                "user_id": user_id,
                "avatar_image_path": avatar_image_path,
                "avatar_image_mime_type": content_type,
                "avatar_image_size_bytes": len(content),
            },
        )

        return await MeService._attach_avatar_url(metadata)

    @staticmethod
    async def delete_my_avatar(user_id: str) -> Dict[str, Any]:
        """
        Delete the authenticated user's avatar object and clear metadata.
        """

        current_metadata = await MeService._get_my_avatar_metadata(user_id)
        avatar_image_path = current_metadata.get("avatar_image_path")

        if avatar_image_path:
            await StorageService.delete_object(
                bucket_name=settings.supabase_storage_bucket_profile_avatars,
                object_path=str(avatar_image_path),
            )

        metadata = await MeService._clear_my_avatar_metadata(user_id)

        logger.info(
            "ME: profile avatar deleted",
            extra={
                "user_id": user_id,
                "avatar_image_path": avatar_image_path,
            },
        )

        return await MeService._attach_avatar_url(metadata)

    @staticmethod
    async def delete_my_account(user_id: str) -> None:
        """
        Delete the authenticated user's account and best-effort avatar object.
        """

        current_metadata = await MeService._get_my_avatar_metadata(user_id)
        avatar_image_path = current_metadata.get("avatar_image_path")

        await MeService._execute_void_rpc(
            user_id=user_id,
            action="delete account",
            query="select library.delete_my_account()",
            parameters=(),
        )

        if avatar_image_path:
            try:
                await StorageService.delete_object(
                    bucket_name=settings.supabase_storage_bucket_profile_avatars,
                    object_path=str(avatar_image_path),
                )
            except RuntimeError as exc:
                logger.warning(
                    "ME: failed to delete avatar object after account deletion",
                    extra={
                        "user_id": user_id,
                        "avatar_image_path": avatar_image_path,
                        "error": str(exc),
                    },
                )

    @staticmethod
    async def _get_my_avatar_metadata(user_id: str) -> Dict[str, Any]:
        rows = await MeService._fetch_rows(
            query="select * from library.get_my_avatar_metadata($1::uuid)",
            action="get avatar metadata",
            user_id=user_id,
            parameters=(user_id,),
        )

        if not rows:
            raise RuntimeError("Profile not found")

        return MeService._normalize_avatar_metadata(rows[0])

    @staticmethod
    async def _set_my_avatar_metadata(
        user_id: str,
        avatar_image_path: str,
        avatar_image_mime_type: str,
        avatar_image_size_bytes: int,
    ) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        user_id,
                    )
                    row = await connection.fetchrow(
                        """
                        select *
                        from library.set_my_avatar_metadata(
                            $1::uuid,
                            $2::text,
                            $3::text,
                            $4::integer
                        )
                        """,
                        user_id,
                        avatar_image_path,
                        avatar_image_mime_type,
                        avatar_image_size_bytes,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "ME: set avatar metadata RPC failed",
                extra={
                    "user_id": user_id,
                    "avatar_image_path": avatar_image_path,
                    "avatar_image_mime_type": avatar_image_mime_type,
                    "avatar_image_size_bytes": avatar_image_size_bytes,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Profile not found")

        return MeService._normalize_avatar_metadata(dict(row))

    @staticmethod
    async def _clear_my_avatar_metadata(user_id: str) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        user_id,
                    )
                    row = await connection.fetchrow(
                        "select * from library.clear_my_avatar_metadata($1::uuid)",
                        user_id,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "ME: clear avatar metadata RPC failed",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Profile not found")

        return MeService._normalize_avatar_metadata(dict(row))

    @staticmethod
    async def _attach_avatar_url(metadata: Dict[str, Any]) -> Dict[str, Any]:
        avatar_image_path = metadata.get("avatar_image_path")
        metadata["avatar_image_url"] = None

        if not avatar_image_path:
            return metadata

        metadata["avatar_image_url"] = await StorageService.create_signed_read_url(
            bucket_name=settings.supabase_storage_bucket_profile_avatars,
            object_path=str(avatar_image_path),
            expires_in_seconds=settings.profile_avatar_signed_url_ttl_seconds,
        )

        return metadata

    @staticmethod
    def _validate_avatar_upload(content: bytes, content_type: str) -> None:
        if content_type not in MeService.PROFILE_AVATAR_ALLOWED_MIME_TYPES:
            raise RuntimeError("Invalid avatar image MIME type")

        if not content:
            raise RuntimeError("Avatar image file is required")

        if len(content) > settings.profile_avatar_max_file_size_bytes:
            raise RuntimeError("Avatar image file is too large")

    @staticmethod
    def _build_avatar_object_path(user_id: str, content_type: str) -> str:
        extension = MeService.PROFILE_AVATAR_EXTENSION_BY_MIME_TYPE[content_type]
        return f"profiles/{user_id}/avatar.{extension}"

    @staticmethod
    async def _delete_avatar_object_after_failed_metadata(
        avatar_image_path: str,
    ) -> None:
        try:
            await StorageService.delete_object(
                bucket_name=settings.supabase_storage_bucket_profile_avatars,
                object_path=avatar_image_path,
            )
        except RuntimeError as exc:
            logger.warning(
                "ME: failed to rollback avatar object after metadata failure",
                extra={
                    "avatar_image_path": avatar_image_path,
                    "error": str(exc),
                },
            )

    @staticmethod
    def _normalize_avatar_metadata(row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "avatar_image_path": row.get("avatar_image_path"),
            "avatar_image_url": None,
            "avatar_image_mime_type": row.get("avatar_image_mime_type"),
            "avatar_image_size_bytes": row.get("avatar_image_size_bytes"),
            "avatar_image_updated_at": row.get("avatar_image_updated_at"),
        }

    @staticmethod
    async def _fetch_rows(
        query: str,
        action: str,
        user_id: str,
        parameters: Tuple[Any, ...],
    ) -> List[Dict[str, Any]]:
        """
        Execute a read RPC that returns rows.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        user_id,
                    )
                    rows = await connection.fetch(query, *parameters)
        except asyncpg.PostgresError as exc:
            logger.error(
                f"ME: {action} RPC failed",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return [dict(row) for row in rows]

    @staticmethod
    async def _execute_void_rpc(
        user_id: str,
        action: str,
        query: str,
        parameters: Tuple[Any, ...],
    ) -> None:
        """
        Execute a void self-service RPC after setting request identity.
        """

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        user_id,
                    )
                    await connection.execute(query, *parameters)
        except asyncpg.PostgresError as exc:
            logger.error(
                f"ME: {action} RPC failed",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    async def _fetch_jsonb_object(
        query: str,
        action: str,
        user_id: str,
        parameters: Tuple[Any, ...],
    ) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)",
                        user_id,
                    )
                    raw = await connection.fetchval(query, *parameters)
        except asyncpg.PostgresError as exc:
            logger.error(
                f"ME: {action} RPC failed",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return MeService._normalize_jsonb_mapping(
            raw,
            null_message="Student dashboard RPC returned null",
            invalid_json_message="Student dashboard RPC returned invalid JSON",
            invalid_shape_message="Student dashboard RPC returned non-object JSON",
            unexpected_type_message=(
                "Student dashboard RPC returned unexpected payload type"
            ),
            log_context={"user_id": user_id},
        )

    @staticmethod
    def _normalize_jsonb_mapping(
        raw: Any,
        *,
        null_message: str,
        invalid_json_message: str,
        invalid_shape_message: str,
        unexpected_type_message: str,
        log_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        if raw is None:
            logger.error(
                "ME: jsonb RPC returned null",
                extra=log_context,
            )
            raise RuntimeError(null_message)

        if isinstance(raw, dict):
            return raw

        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as exc:
                logger.error(
                    "ME: failed to decode jsonb RPC payload",
                    extra={
                        **log_context,
                        "error": str(exc),
                        "raw_preview": raw[:200],
                    },
                )
                raise RuntimeError(invalid_json_message) from exc

            if not isinstance(parsed, dict):
                logger.error(
                    "ME: decoded jsonb payload is not an object",
                    extra={
                        **log_context,
                        "decoded_type": type(parsed).__name__,
                    },
                )
                raise RuntimeError(invalid_shape_message)

            return parsed

        logger.error(
            "ME: unexpected jsonb RPC return type",
            extra={
                **log_context,
                "return_type": type(raw).__name__,
            },
        )
        raise RuntimeError(unexpected_type_message)
