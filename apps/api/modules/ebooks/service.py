"""Orchestration for private E-Book files and PostgreSQL-owned lifecycle rules."""

import hashlib
import json
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import UUID, uuid4
from zipfile import BadZipFile, ZipFile

import asyncpg

from core.config import settings
from core.database import Database
from modules.ebooks.schemas import EBookUpdateRequest, EBookUploadRequest
from services.storage_service import StorageService


class EBooksService:
    MIME_BY_FORMAT = {"pdf": "application/pdf", "epub": "application/epub+zip"}
    COVER_EXTENSION_BY_MIME = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }

    @staticmethod
    def _decode(value: Any) -> Any:
        return json.loads(value) if isinstance(value, str) else value

    @staticmethod
    async def _rpc(user_id: str, sql: str, *args: Any) -> Any:
        try:
            async with Database.get_pool().acquire() as connection:
                async with connection.transaction():
                    await connection.execute(
                        "select set_config('request.jwt.claim.sub', $1, true)", user_id
                    )
                    return EBooksService._decode(await connection.fetchval(sql, user_id, *args))
        except asyncpg.PostgresError as exc:
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    def _with_cover_url(value: Any) -> Any:
        if isinstance(value, dict):
            path = value.get("cover_image_path")
            if path:
                value["cover_image_url"] = (
                    f"{settings.supabase_project_url.rstrip('/')}/storage/v1/object/public/"
                    f"{quote(settings.supabase_storage_bucket_ebook_covers, safe='')}/"
                    f"{'/'.join(quote(part, safe='') for part in path.split('/'))}"
                )
            for child in value.values():
                EBooksService._with_cover_url(child)
        elif isinstance(value, list):
            for child in value:
                EBooksService._with_cover_url(child)
        return value

    @classmethod
    async def list_staff(cls, user_id: str, limit: int, offset: int) -> dict[str, Any]:
        return cls._with_cover_url(await cls._rpc(
            user_id, "select library.get_staff_ebooks($1::uuid, $2, $3)", limit, offset
        ))

    @classmethod
    async def get_staff(cls, user_id: str, ebook_id: UUID) -> dict[str, Any]:
        return cls._with_cover_url(await cls._rpc(
            user_id, "select library.get_staff_ebook_by_id($1::uuid, $2::uuid)", ebook_id
        ))

    @classmethod
    async def list_student(cls, user_id: str, limit: int, offset: int) -> dict[str, Any]:
        return cls._with_cover_url(await cls._rpc(
            user_id, "select library.get_student_ebooks($1::uuid, $2, $3)", limit, offset
        ))

    @classmethod
    async def get_student(cls, user_id: str, ebook_id: UUID) -> dict[str, Any]:
        return cls._with_cover_url(await cls._rpc(
            user_id, "select library.get_student_ebook_by_id($1::uuid, $2::uuid)", ebook_id
        ))

    @classmethod
    async def create_upload_url(cls, user_id: str, payload: EBookUploadRequest) -> dict[str, Any]:
        expected_mime = cls.MIME_BY_FORMAT[payload.file_format]
        if payload.mime_type != expected_mime or Path(payload.filename).suffix.lower() != f".{payload.file_format}":
            raise RuntimeError("Unsupported E-Book file type")
        ebook_id, file_id = uuid4(), uuid4()
        path = f"ebooks/{ebook_id}/files/{file_id}/book.{payload.file_format}"
        signed = await StorageService.create_signed_upload_url(
            settings.supabase_storage_bucket_ebooks, path
        )
        await cls._rpc(
            user_id,
            """select library.create_ebook_upload_intent(
              $1::uuid,$2::uuid,$3::uuid,$4,$5,$6::library.book_category_enum,$7,
              $8::library.ebook_file_format_enum,$9,$10,$11,$12)""",
            ebook_id, file_id, payload.title, payload.authors, payload.category,
            payload.filename, payload.file_format, payload.mime_type,
            payload.file_size_bytes, settings.supabase_storage_bucket_ebooks, path,
        )
        return {
            "ebook_id": ebook_id, "file_id": file_id,
            "bucket_name": settings.supabase_storage_bucket_ebooks,
            "storage_object_path": path,
            "signed_upload_url": signed["signed_upload_url"], "upload_token": signed["token"],
            "file_status": "uploaded",
        }

    @classmethod
    async def finalize(cls, user_id: str, ebook_id: UUID) -> dict[str, Any]:
        item = await cls.get_staff(user_id, ebook_id)
        file = item.get("file") or {}
        try:
            info = await StorageService.get_object_info(file["bucket_name"], file["storage_object_path"])
            if not info:
                raise RuntimeError("Storage object missing")
            content = await StorageService.download_object(file["bucket_name"], file["storage_object_path"])
            validated = cls.validate_uploaded_object(file, info, content)
            return await cls._rpc(
                user_id,
                """select library.finalize_ebook_file(
                  $1::uuid,$2::uuid,'ready',$3,$4,$5,null)""",
                ebook_id, validated["mime_type"], validated["file_size_bytes"],
                hashlib.sha256(content).hexdigest(),
            )
        except RuntimeError as exc:
            await cls._rpc(
                user_id,
                """select library.finalize_ebook_file(
                  $1::uuid,$2::uuid,'failed',$3,$4,null,$5)""",
                ebook_id, file.get("mime_type"), file.get("file_size_bytes"), str(exc)[:1000],
            )
            raise

    @staticmethod
    def validate_file_bytes(file_format: str, content: bytes) -> None:
        if file_format == "pdf":
            if not content.startswith(b"%PDF-"):
                raise RuntimeError("Stored PDF is invalid")
            return
        try:
            with ZipFile(BytesIO(content)) as archive:
                if archive.read("mimetype") != b"application/epub+zip":
                    raise RuntimeError("Stored EPUB is invalid")
                archive.getinfo("META-INF/container.xml")
        except (BadZipFile, KeyError):
            raise RuntimeError("Stored EPUB is invalid") from None

    @staticmethod
    def _storage_size(object_info: dict[str, Any]) -> int | None:
        metadata = object_info.get("metadata")
        for candidate in (
            object_info.get("size"),
            object_info.get("file_size"),
            metadata.get("size") if isinstance(metadata, dict) else None,
        ):
            try:
                if candidate is not None:
                    return int(candidate)
            except (TypeError, ValueError):
                continue
        return None

    @staticmethod
    def _storage_mime(object_info: dict[str, Any]) -> str | None:
        metadata = object_info.get("metadata")
        for candidate in (
            object_info.get("mimetype"),
            object_info.get("mime_type"),
            metadata.get("mimetype") if isinstance(metadata, dict) else None,
            metadata.get("mimeType") if isinstance(metadata, dict) else None,
        ):
            if isinstance(candidate, str) and candidate.strip():
                return candidate.split(";", 1)[0].strip().lower()
        return None

    @classmethod
    def validate_uploaded_object(
        cls,
        file: dict[str, Any],
        object_info: dict[str, Any],
        content: bytes,
    ) -> dict[str, Any]:
        expected_mime = cls.MIME_BY_FORMAT[str(file["file_format"])]
        expected_size = int(file.get("file_size_bytes") or 0)
        stored_mime = cls._storage_mime(object_info)
        stored_size = cls._storage_size(object_info)
        if stored_mime != expected_mime or stored_size is None:
            raise RuntimeError("Stored object violates upload policy")
        if stored_size != expected_size or len(content) != expected_size:
            raise RuntimeError("Stored object violates upload policy")
        if stored_size < 1 or stored_size > settings.ebook_upload_max_file_size_bytes:
            raise RuntimeError("File exceeds upload size limit")
        cls.validate_file_bytes(str(file["file_format"]), content)
        return {"mime_type": stored_mime, "file_size_bytes": stored_size}

    @classmethod
    async def update(cls, user_id: str, ebook_id: UUID, payload: EBookUpdateRequest) -> dict[str, Any]:
        return cls._with_cover_url(await cls._rpc(
            user_id,
            """select library.update_ebook(
              $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::library.book_category_enum,
              $13::text[],$14::uuid,$15::library.ebook_access_scope_enum,$16,$17)""",
            ebook_id, payload.title, payload.subtitle, payload.authors, payload.description,
            payload.isbn, payload.publisher, payload.publication_year, payload.edition,
            payload.language, payload.category, payload.keywords, payload.linked_book_id,
            payload.access_scope, payload.allow_preview, payload.allow_download,
        ))

    @classmethod
    async def lifecycle(cls, user_id: str, ebook_id: UUID, action: str) -> dict[str, Any]:
        function = {"publish": "publish_ebook", "archive": "archive_ebook"}[action]
        return cls._with_cover_url(await cls._rpc(
            user_id, f"select library.{function}($1::uuid, $2::uuid)", ebook_id
        ))

    @classmethod
    async def delete_draft(cls, user_id: str, ebook_id: UUID) -> None:
        storage = await cls._rpc(
            user_id, "select library.delete_ebook_draft($1::uuid, $2::uuid)", ebook_id
        )
        if storage.get("storage_object_path"):
            await StorageService.delete_object(storage["bucket_name"], storage["storage_object_path"])

    @classmethod
    async def access_url(cls, user_id: str, ebook_id: UUID, event_type: str) -> dict[str, Any]:
        access = await cls._rpc(
            user_id,
            "select library.can_access_ebook($1::uuid,$2::uuid,$3::library.ebook_access_event_type_enum)",
            ebook_id, event_type,
        )
        url = await StorageService.create_signed_read_url(
            access["bucket_name"], access["storage_object_path"],
            expires_in_seconds=settings.ebook_signed_access_url_ttl_seconds,
            download_filename=access["original_filename"] if event_type == "download" else None,
        )
        await cls._rpc(
            user_id,
            "select library.record_ebook_access_event($1::uuid,$2::uuid,$3::library.ebook_access_event_type_enum)",
            ebook_id, event_type,
        )
        return {
            "ebook_id": ebook_id, "event_type": event_type, "url": url,
            "expires_in_seconds": settings.ebook_signed_access_url_ttl_seconds,
        }

    @classmethod
    async def events(cls, user_id: str, ebook_id: UUID, limit: int, offset: int) -> dict[str, Any]:
        return await cls._rpc(
            user_id, "select library.get_ebook_access_events($1::uuid,$2::uuid,$3,$4)",
            ebook_id, limit, offset,
        )

    @classmethod
    async def set_cover(
        cls, user_id: str, ebook_id: UUID, content: bytes, mime_type: str, alt_text: str | None
    ) -> dict[str, Any]:
        extension = cls.COVER_EXTENSION_BY_MIME.get(mime_type)
        if not extension:
            raise RuntimeError("Invalid cover image type")
        if not content or len(content) > settings.ebook_cover_max_file_size_bytes:
            raise RuntimeError("Invalid cover image size")
        current = await cls.get_staff(user_id, ebook_id)
        previous_path = current.get("cover_image_path")
        path = f"ebooks/{ebook_id}/cover.{extension}"
        await StorageService.upload_object(
            settings.supabase_storage_bucket_ebook_covers, path, content,
            content_type=mime_type, upsert=True,
        )
        result = cls._with_cover_url(await cls._rpc(
            user_id,
            "select library.set_ebook_cover_metadata($1::uuid,$2::uuid,$3,$4,$5,$6)",
            ebook_id, path, alt_text, mime_type, len(content),
        ))
        if previous_path and previous_path != path:
            await StorageService.delete_object(settings.supabase_storage_bucket_ebook_covers, previous_path)
        return result

    @classmethod
    async def clear_cover(cls, user_id: str, ebook_id: UUID) -> None:
        result = await cls._rpc(
            user_id, "select library.clear_ebook_cover_metadata($1::uuid,$2::uuid)", ebook_id
        )
        if result.get("cover_image_path"):
            await StorageService.delete_object(
                settings.supabase_storage_bucket_ebook_covers, result["cover_image_path"]
            )
