# apps/api/modules/documents/service.py
"""
Service layer for the Documents Module of the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Enforce authenticated document-manager access using the database.
- Create provisional document metadata rows and signed upload URLs.
- Delegate indexing to the ingestion service.
- Expose document management reads and deletion flows.

Architectural Constraints:
- No HTTP route logic.
- No OCR or embedding logic.
- No storage SDK calls from routes.
"""

import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import asyncpg

from core.config import settings
from core.database import Database
from core.logging import get_logger
from core.rate_limit import hash_sensitive_value
from modules.documents.schemas import CreateUploadUrlRequest
from services.document_ingestion_service import DocumentIngestionService
from services.storage_service import StorageService

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp"}
SUPPORTED_MIME_PREFIXES = ("application/pdf", "text/plain", "image/")
SUPPORTED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class DocumentsService:
    """
    Route-facing orchestration service for official document management.
    """

    @staticmethod
    async def create_upload_url(
        user_id: str,
        payload: CreateUploadUrlRequest,
    ) -> Dict[str, Any]:
        DocumentsService._validate_upload_request(payload)

        document_id = uuid4()
        storage_object_path = DocumentsService._build_storage_object_path(
            document_id,
            payload.filename,
        )
        title = DocumentsService._resolve_title(payload)

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await DocumentsService._set_request_identity(connection, user_id)
                await DocumentsService._require_documents_manager(connection, user_id)

                signed_upload = await StorageService.create_signed_upload_url(
                    settings.supabase_storage_bucket_university_documents,
                    storage_object_path,
                )

                await connection.execute(
                    """
                    insert into library.university_documents (
                        id,
                        title,
                        file_path,
                        original_filename,
                        bucket_name,
                        storage_object_path,
                        mime_type,
                        file_size_bytes,
                        uploaded_by,
                        processing_status,
                        indexing_error,
                        is_active,
                        document_type,
                        audience_scope,
                        department
                    )
                    values (
                        $1::uuid,
                        $2::text,
                        $3::text,
                        $4::text,
                        $5::text,
                        $6::text,
                        $7::text,
                        $8::bigint,
                        $9::uuid,
                        'uploaded',
                        null,
                        true,
                        $10::text,
                        $11::text,
                        $12::text
                    )
                    """,
                    document_id,
                    title,
                    storage_object_path,
                    payload.filename.strip(),
                    settings.supabase_storage_bucket_university_documents,
                    storage_object_path,
                    payload.mime_type.strip(),
                    payload.file_size_bytes,
                    user_id,
                    payload.document_type,
                    payload.audience_scope,
                    payload.department,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "DOCUMENTS: create upload url failed",
                extra={
                    "user_id": user_id,
                    "filename_hash": hash_sensitive_value(payload.filename),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        logger.info(
            "DOCUMENTS: signed upload url created",
            extra={
                "user_id": user_id,
                "document_id": str(document_id),
                "storage_object_path": storage_object_path,
            },
        )

        return {
            "document_id": document_id,
            "bucket_name": settings.supabase_storage_bucket_university_documents,
            "storage_object_path": storage_object_path,
            "signed_upload_url": signed_upload["signed_upload_url"],
            "upload_token": signed_upload["token"],
            "processing_status": "uploaded",
        }

    @staticmethod
    async def finalize_document(user_id: str, document_id: UUID) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await DocumentsService._set_request_identity(connection, user_id)
                await DocumentsService._require_documents_manager(connection, user_id)
                document_row = await DocumentsService._get_document_row(connection, document_id)

                object_info = await StorageService.get_object_info(
                    document_row["bucket_name"],
                    document_row["storage_object_path"],
                )

                if object_info is None:
                    raise RuntimeError("Storage object missing")

                validated_object = DocumentsService._validate_uploaded_object(
                    document_row=document_row,
                    object_info=object_info,
                )
                document_row["mime_type"] = validated_object["mime_type"]
                document_row["file_size_bytes"] = validated_object["file_size_bytes"]
                await DocumentsService._apply_validated_storage_metadata(
                    connection=connection,
                    document_id=document_id,
                    mime_type=validated_object["mime_type"],
                    file_size_bytes=validated_object["file_size_bytes"],
                )

                return await DocumentIngestionService.finalize_document(
                    connection,
                    document_row,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "DOCUMENTS: finalize document failed",
                extra={
                    "user_id": user_id,
                    "document_id": str(document_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    async def list_documents(user_id: str) -> List[Dict[str, Any]]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await DocumentsService._set_request_identity(connection, user_id)
                await DocumentsService._require_documents_manager(connection, user_id)
                rows = await connection.fetch(
                    """
                    select
                        id,
                        title,
                        original_filename,
                        bucket_name,
                        storage_object_path,
                        mime_type,
                        file_size_bytes,
                        processing_status,
                        indexing_error,
                        is_active,
                        uploaded_by,
                        created_at,
                        updated_at
                    from library.university_documents
                    order by created_at desc, id desc
                    """
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "DOCUMENTS: list documents failed",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return [dict(row) for row in rows]

    @staticmethod
    async def get_document(user_id: str, document_id: UUID) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await DocumentsService._set_request_identity(connection, user_id)
                await DocumentsService._require_documents_manager(connection, user_id)
                row = await connection.fetchrow(
                    """
                    select
                        id,
                        title,
                        original_filename,
                        bucket_name,
                        storage_object_path,
                        mime_type,
                        file_size_bytes,
                        processing_status,
                        indexing_error,
                        is_active,
                        uploaded_by,
                        created_at,
                        updated_at,
                        checksum_sha256,
                        document_type,
                        audience_scope,
                        department,
                        file_path
                    from library.university_documents
                    where id = $1::uuid
                    """,
                    document_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "DOCUMENTS: get document failed",
                extra={
                    "user_id": user_id,
                    "document_id": str(document_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Document not found")

        return dict(row)

    @staticmethod
    async def delete_document(user_id: str, document_id: UUID) -> None:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await DocumentsService._set_request_identity(connection, user_id)
                await DocumentsService._require_documents_manager(connection, user_id)
                document_row = await DocumentsService._get_document_row(connection, document_id)

                await StorageService.delete_object(
                    document_row["bucket_name"],
                    document_row["storage_object_path"],
                )

                await connection.execute(
                    "delete from library.university_documents where id = $1::uuid",
                    document_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "DOCUMENTS: delete document failed",
                extra={
                    "user_id": user_id,
                    "document_id": str(document_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        logger.info(
            "DOCUMENTS: document deleted",
            extra={
                "user_id": user_id,
                "document_id": str(document_id),
            },
        )

    @staticmethod
    async def _set_request_identity(
        connection: asyncpg.Connection,
        user_id: str,
    ) -> None:
        await connection.execute(
            "select set_config('request.jwt.claim.sub', $1, true)",
            user_id,
        )

    @staticmethod
    async def _require_documents_manager(
        connection: asyncpg.Connection,
        user_id: str,
    ) -> None:
        role = await connection.fetchval(
            """
            select role::text
            from library.profiles
            where id = $1::uuid
            """,
            user_id,
        )

        if role not in {"admin", "librarian"}:
            raise RuntimeError("Insufficient privileges")

    @staticmethod
    async def _get_document_row(
        connection: asyncpg.Connection,
        document_id: UUID,
    ) -> Dict[str, Any]:
        row = await connection.fetchrow(
            """
            select *
            from library.university_documents
            where id = $1::uuid
            """,
            document_id,
        )

        if row is None:
            raise RuntimeError("Document not found")

        return dict(row)

    @staticmethod
    def _validate_upload_request(payload: CreateUploadUrlRequest) -> None:
        extension = Path(payload.filename.strip()).suffix.lower()
        mime_type = DocumentsService._normalize_mime_type(payload.mime_type)

        if payload.file_size_bytes <= 0:
            raise RuntimeError("Invalid input")

        if payload.file_size_bytes > settings.document_upload_max_file_size_bytes:
            raise RuntimeError("File exceeds upload size limit")

        if extension not in SUPPORTED_EXTENSIONS:
            raise RuntimeError("Unsupported file type")

        if not (
            mime_type in SUPPORTED_MIME_TYPES
            or mime_type.startswith(SUPPORTED_MIME_PREFIXES)
        ):
            raise RuntimeError("Unsupported file type")

    @staticmethod
    def _build_storage_object_path(document_id: UUID, filename: str) -> str:
        now = datetime.utcnow()
        sanitized_filename = DocumentsService._sanitize_filename(filename)
        return (
            f"official/{now:%Y}/{now:%m}/"
            f"{document_id}__{sanitized_filename}"
        )

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        cleaned = Path(filename).name.strip()
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", cleaned)
        cleaned = re.sub(r"_+", "_", cleaned).strip("._")

        if not cleaned:
            raise RuntimeError("Invalid input")

        return cleaned[:180]

    @staticmethod
    def _resolve_title(payload: CreateUploadUrlRequest) -> str:
        if payload.title and payload.title.strip():
            return payload.title.strip()

        return Path(payload.filename.strip()).stem.strip() or "Untitled Document"

    @staticmethod
    def _extract_storage_size_bytes(object_info: Dict[str, Any]) -> Optional[int]:
        """
        Resolve object size from Supabase storage info response variants.
        """

        metadata = object_info.get("metadata")

        size_candidates = (
            object_info.get("size"),
            object_info.get("file_size"),
            metadata.get("size") if isinstance(metadata, dict) else None,
        )

        for candidate in size_candidates:
            if candidate is None:
                continue

            try:
                size = int(candidate)
            except (TypeError, ValueError):
                continue

            if size >= 0:
                return size

        return None

    @staticmethod
    def _extract_storage_mime_type(object_info: Dict[str, Any]) -> Optional[str]:
        """
        Resolve object MIME type from Supabase storage info response variants.
        """

        metadata = object_info.get("metadata")

        mime_candidates = (
            object_info.get("mimetype"),
            object_info.get("mime_type"),
            metadata.get("mimetype") if isinstance(metadata, dict) else None,
            metadata.get("mimeType") if isinstance(metadata, dict) else None,
        )

        for candidate in mime_candidates:
            if isinstance(candidate, str) and candidate.strip():
                return DocumentsService._normalize_mime_type(candidate)

        return None

    @staticmethod
    def _normalize_mime_type(value: str) -> str:
        """
        Normalize MIME types into a stable comparison form.
        """

        return value.split(";", 1)[0].strip().lower()

    @staticmethod
    def _validate_uploaded_object(
        *,
        document_row: Dict[str, Any],
        object_info: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Enforce storage-level upload policy during finalize/index.
        """

        expected_extension = Path(str(document_row["storage_object_path"])).suffix.lower()
        expected_mime_type = DocumentsService._normalize_mime_type(
            str(document_row["mime_type"] or "")
        )
        expected_file_size = int(document_row["file_size_bytes"] or 0)
        stored_file_size = DocumentsService._extract_storage_size_bytes(object_info)
        stored_mime_type = DocumentsService._extract_storage_mime_type(object_info)

        if expected_extension not in SUPPORTED_EXTENSIONS:
            raise RuntimeError("Unsupported file type")

        if stored_file_size is None or stored_file_size <= 0:
            raise RuntimeError("Stored object violates upload policy")

        if stored_file_size > settings.document_upload_max_file_size_bytes:
            raise RuntimeError("File exceeds upload size limit")

        if expected_file_size > 0 and stored_file_size != expected_file_size:
            raise RuntimeError("Stored object violates upload policy")

        if not stored_mime_type:
            raise RuntimeError("Stored object violates upload policy")

        if not (
            stored_mime_type in SUPPORTED_MIME_TYPES
            or stored_mime_type.startswith(SUPPORTED_MIME_PREFIXES)
        ):
            raise RuntimeError("Unsupported file type")

        if expected_mime_type and stored_mime_type != expected_mime_type:
            raise RuntimeError("Stored object violates upload policy")

        return {
            "file_size_bytes": stored_file_size,
            "mime_type": stored_mime_type,
        }

    @staticmethod
    async def _apply_validated_storage_metadata(
        *,
        connection: asyncpg.Connection,
        document_id: UUID,
        mime_type: str,
        file_size_bytes: int,
    ) -> None:
        """
        Persist validated storage metadata before indexing proceeds.
        """

        await connection.execute(
            """
            update library.university_documents
            set
                mime_type = $2::text,
                file_size_bytes = $3::bigint,
                updated_at = now()
            where id = $1::uuid
            """,
            document_id,
            mime_type,
            file_size_bytes,
        )
