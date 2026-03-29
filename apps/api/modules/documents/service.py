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
- No text-extraction or embedding logic.
- No storage SDK calls from routes.
"""

import re
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from zipfile import BadZipFile, ZipFile

import asyncpg

from core.config import settings
from core.database import Database
from core.logging import get_logger
from core.rate_limit import hash_sensitive_value
from modules.documents.schemas import CreateUploadUrlRequest
from services.document_ingestion_service import DocumentIngestionService
from services.storage_service import StorageService

logger = get_logger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}
ALLOWED_MIME_TYPES_BY_EXTENSION = {
    ".pdf": {"application/pdf"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    ".txt": {"text/plain"},
}
EXPECTED_FILE_SIGNATURE_BY_EXTENSION = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".txt": "txt",
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
                lifecycle_state = DocumentsService._build_document_lifecycle_state(
                    document_row
                )

                if document_row["processing_status"] == "processing":
                    raise RuntimeError("Document is already processing")

                if document_row["processing_status"] == "indexed":
                    return {
                        "document_id": document_id,
                        "processing_status": "indexed",
                        "message": "Document already indexed",
                        **lifecycle_state,
                    }

                if lifecycle_state["requires_reupload"]:
                    raise RuntimeError("Upload expired; re-upload required")

                object_info = await StorageService.get_object_info(
                    document_row["bucket_name"],
                    document_row["storage_object_path"],
                )

                if object_info is None:
                    raise RuntimeError("Storage object missing")

                file_bytes = await StorageService.download_object(
                    document_row["bucket_name"],
                    document_row["storage_object_path"],
                )
                validated_object = DocumentsService._validate_uploaded_object(
                    document_row=document_row,
                    object_info=object_info,
                    file_bytes=file_bytes,
                )
                document_row["mime_type"] = validated_object["mime_type"]
                document_row["file_size_bytes"] = validated_object["file_size_bytes"]
                await DocumentsService._apply_validated_storage_metadata(
                    connection=connection,
                    document_id=document_id,
                    mime_type=validated_object["mime_type"],
                    file_size_bytes=validated_object["file_size_bytes"],
                )

                ingestion_result = await DocumentIngestionService.finalize_document(
                    connection,
                    document_row,
                    file_bytes,
                )
                return {
                    **ingestion_result,
                    "message": "Document indexed successfully",
                    **DocumentsService._build_document_lifecycle_state(
                        {
                            **document_row,
                            "processing_status": ingestion_result["processing_status"],
                            "created_at": document_row.get("created_at"),
                        }
                    ),
                }
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
                        d.id,
                        d.title,
                        d.original_filename,
                        d.bucket_name,
                        d.storage_object_path,
                        d.mime_type,
                        d.file_size_bytes,
                        d.processing_status,
                        d.indexing_error,
                        d.is_active,
                        d.uploaded_by,
                        p.full_name as uploaded_by_name,
                        d.created_at,
                        d.updated_at
                    from library.university_documents d
                    left join library.profiles p
                        on p.id = d.uploaded_by
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

        return [DocumentsService._enrich_document_row(dict(row)) for row in rows]

    @staticmethod
    async def create_signed_read_url(
        user_id: str,
        document_id: UUID,
        *,
        disposition: str,
    ) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await DocumentsService._set_request_identity(connection, user_id)
                await DocumentsService._require_documents_manager(connection, user_id)
                document_row = await DocumentsService._get_document_row(
                    connection,
                    document_id,
                )

                signed_read_url = await StorageService.create_signed_read_url(
                    document_row["bucket_name"],
                    document_row["storage_object_path"],
                    expires_in_seconds=settings.document_signed_read_url_ttl_seconds,
                    download_filename=(
                        str(document_row["original_filename"])
                        if disposition == "attachment"
                        else None
                    ),
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "DOCUMENTS: create signed read url failed",
                extra={
                    "user_id": user_id,
                    "document_id": str(document_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        logger.info(
            "DOCUMENTS: signed read url created",
            extra={
                "user_id": user_id,
                "document_id": str(document_id),
                "disposition": disposition,
                "expires_in_seconds": settings.document_signed_read_url_ttl_seconds,
            },
        )

        return {
            "document_id": document_id,
            "signed_read_url": signed_read_url,
            "expires_in_seconds": settings.document_signed_read_url_ttl_seconds,
            "disposition": disposition,
        }

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
                        d.id,
                        d.title,
                        d.original_filename,
                        d.bucket_name,
                        d.storage_object_path,
                        d.mime_type,
                        d.file_size_bytes,
                        d.processing_status,
                        d.indexing_error,
                        d.is_active,
                        d.uploaded_by,
                        p.full_name as uploaded_by_name,
                        d.created_at,
                        d.updated_at,
                        d.checksum_sha256,
                        d.document_type,
                        d.audience_scope,
                        d.department,
                        d.file_path
                    from library.university_documents d
                    left join library.profiles p
                        on p.id = d.uploaded_by
                    where d.id = $1::uuid
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

        return DocumentsService._enrich_document_row(dict(row))

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

        if not DocumentsService._is_allowed_mime_for_extension(extension, mime_type):
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
        file_bytes: bytes,
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
        detected_signature = DocumentsService._detect_file_signature(file_bytes)
        expected_signature = EXPECTED_FILE_SIGNATURE_BY_EXTENSION.get(expected_extension)
        resolved_mime_type = stored_mime_type

        if expected_extension not in SUPPORTED_EXTENSIONS:
            raise RuntimeError("Unsupported file type")

        if stored_file_size is None or stored_file_size <= 0:
            raise RuntimeError("Stored object violates upload policy")

        if stored_file_size > settings.document_upload_max_file_size_bytes:
            raise RuntimeError("File exceeds upload size limit")

        if expected_file_size > 0 and stored_file_size != expected_file_size:
            raise RuntimeError("Stored object violates upload policy")

        if (
            resolved_mime_type in {None, "application/octet-stream"}
            and expected_mime_type
            and DocumentsService._is_allowed_mime_for_extension(
                expected_extension,
                expected_mime_type,
            )
            and (expected_signature is None or detected_signature == expected_signature)
        ):
            resolved_mime_type = expected_mime_type

        if not resolved_mime_type:
            raise RuntimeError("Stored object violates upload policy")

        if expected_file_size > 0 and len(file_bytes) != expected_file_size:
            raise RuntimeError("Stored object violates upload policy")

        if not DocumentsService._is_allowed_mime_for_extension(
            expected_extension,
            resolved_mime_type,
        ):
            raise RuntimeError("Unsupported file type")

        if expected_mime_type and not DocumentsService._is_allowed_mime_for_extension(
            expected_extension,
            expected_mime_type,
        ):
            raise RuntimeError("Unsupported file type")

        if expected_mime_type and resolved_mime_type != expected_mime_type:
            raise RuntimeError("Stored object violates upload policy")

        if expected_signature and detected_signature != expected_signature:
            raise RuntimeError("Stored object violates upload policy")

        return {
            "file_size_bytes": stored_file_size,
            "mime_type": resolved_mime_type,
        }

    @staticmethod
    def _is_allowed_mime_for_extension(extension: str, mime_type: str) -> bool:
        allowed_types = ALLOWED_MIME_TYPES_BY_EXTENSION.get(extension, set())
        return mime_type in allowed_types

    @staticmethod
    def _detect_file_signature(file_bytes: bytes) -> Optional[str]:
        if file_bytes.startswith(b"%PDF-"):
            return "pdf"

        if DocumentsService._looks_like_docx(file_bytes):
            return "docx"

        if DocumentsService._looks_like_text_file(file_bytes):
            return "txt"

        return None

    @staticmethod
    def _looks_like_docx(file_bytes: bytes) -> bool:
        try:
            with ZipFile(BytesIO(file_bytes)) as archive:
                names = set(archive.namelist())
        except BadZipFile:
            return False

        return "[Content_Types].xml" in names and any(
            name.startswith("word/") for name in names
        )

    @staticmethod
    def _looks_like_text_file(file_bytes: bytes) -> bool:
        if not file_bytes or b"\x00" in file_bytes[:4096]:
            return False

        sample = file_bytes[:8192]

        for encoding in ("utf-8", "utf-8-sig", "latin-1"):
            try:
                decoded = sample.decode(encoding)
            except UnicodeDecodeError:
                continue

            if not decoded.strip():
                continue

            readable_chars = sum(
                1 for char in decoded if char.isprintable() or char in "\n\r\t"
            )
            return (readable_chars / len(decoded)) >= 0.95

        return False

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

    @staticmethod
    def _enrich_document_row(row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Attach lifecycle and action metadata used by staff-facing UI.
        """

        return {
            **row,
            **DocumentsService._build_document_lifecycle_state(row),
        }

    @staticmethod
    def _build_document_lifecycle_state(row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Derive frontend-safe lifecycle flags from the persisted document row.
        """

        processing_status = str(row.get("processing_status") or "")
        created_at = row.get("created_at")
        is_upload_stale = DocumentsService._is_upload_stale(
            processing_status=processing_status,
            created_at=created_at,
        )
        can_finalize = processing_status == "uploaded" and not is_upload_stale
        can_retry_finalize = processing_status == "failed"
        requires_reupload = processing_status == "uploaded" and is_upload_stale

        if processing_status == "uploaded" and is_upload_stale:
            lifecycle_note = (
                "Upload intent expired before the file arrived. Delete and re-upload the document."
            )
        elif processing_status == "uploaded":
            lifecycle_note = "Waiting for file upload and finalize."
        elif processing_status == "processing":
            lifecycle_note = "Indexing is in progress."
        elif processing_status == "failed":
            lifecycle_note = (
                "Indexing failed. Finalize can retry after the underlying issue is fixed."
            )
        else:
            lifecycle_note = "Indexed and available for retrieval."

        return {
            "is_upload_stale": is_upload_stale,
            "can_finalize": can_finalize,
            "can_retry_finalize": can_retry_finalize,
            "requires_reupload": requires_reupload,
            "lifecycle_note": lifecycle_note,
        }

    @staticmethod
    def _is_upload_stale(
        *,
        processing_status: str,
        created_at: Any,
    ) -> bool:
        """
        Determine whether an uploaded-but-unfinalized document has exceeded the grace window.
        """

        if processing_status != "uploaded" or not isinstance(created_at, datetime):
            return False

        created_at_utc = created_at
        if created_at_utc.tzinfo is None:
            created_at_utc = created_at_utc.replace(tzinfo=timezone.utc)
        else:
            created_at_utc = created_at_utc.astimezone(timezone.utc)

        stale_after = timedelta(seconds=settings.document_upload_stale_after_seconds)
        now_utc = datetime.now(timezone.utc)
        return created_at_utc <= (now_utc - stale_after)
