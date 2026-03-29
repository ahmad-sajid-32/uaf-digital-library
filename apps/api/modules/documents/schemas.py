# apps/api/modules/documents/schemas.py
"""
Pydantic schemas for the Documents Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Validate document upload-url requests and document management inputs.
- Provide normalized response envelopes for official document APIs.
- Expose processing-state aware metadata for admin/librarian workflows.
"""

from datetime import datetime
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.config import settings


ProcessingStatus = Literal["uploaded", "processing", "indexed", "failed"]
ReadUrlDisposition = Literal["inline", "attachment"]


def _normalize_required_text(value: Any) -> Any:
    """
    Trim boundary whitespace on required document text fields.
    """

    if isinstance(value, str):
        return value.strip()

    return value


def _normalize_optional_text(value: Any) -> Any:
    """
    Collapse optional document metadata text into a stable persisted form.
    """

    if isinstance(value, str):
        normalized = " ".join(value.strip().split())
        return normalized or None

    return value


class CreateUploadUrlRequest(BaseModel):
    """
    Request body for creating a signed upload URL.
    """

    model_config = ConfigDict(extra="forbid")

    filename: str = Field(..., min_length=1, max_length=255, example="semester-rules.pdf")
    mime_type: str = Field(..., min_length=1, max_length=255, example="application/pdf")
    file_size_bytes: int = Field(..., gt=0, example=248731)
    title: Optional[str] = Field(default=None, max_length=255, example="Semester Rules 2026")
    document_type: Optional[str] = Field(default=None, max_length=100, example="policy")
    audience_scope: Optional[str] = Field(default=None, max_length=100, example="all_students")
    department: Optional[str] = Field(default=None, max_length=100, example="Registrar Office")

    @field_validator("filename", "mime_type", mode="before")
    @classmethod
    def normalize_required_fields(cls, value: Any) -> Any:
        """
        Normalize required file metadata before validation.
        """

        return _normalize_required_text(value)

    @field_validator("title", "document_type", "audience_scope", "department", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: Any) -> Any:
        """
        Normalize optional upload metadata fields.
        """

        return _normalize_optional_text(value)

    @field_validator("file_size_bytes")
    @classmethod
    def enforce_max_file_size(cls, value: int) -> int:
        """
        Enforce the configured document upload size ceiling at the schema boundary.
        """

        if value > settings.document_upload_max_file_size_bytes:
            raise ValueError("File exceeds upload size limit")

        return value


class UploadUrlPayload(BaseModel):
    """
    Upload-url payload returned to the frontend.
    """

    document_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    bucket_name: str = Field(..., example="university-documents")
    storage_object_path: str = Field(
        ...,
        example="official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf",
    )
    signed_upload_url: str = Field(
        ...,
        example="https://project.supabase.co/storage/v1/object/upload/sign/university-documents/official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf?token=example",
    )
    upload_token: Optional[str] = Field(default=None, example="signed-upload-token")
    processing_status: ProcessingStatus = Field(..., example="uploaded")


class CreateUploadUrlResponse(BaseModel):
    """
    Normalized response for signed upload-url creation.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Signed upload URL generated successfully")
    data: UploadUrlPayload
    timestamp_ms: int = Field(..., example=1741392000000)


class FinalizeDocumentData(BaseModel):
    """
    Finalization result payload.
    """

    document_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    processing_status: ProcessingStatus = Field(..., example="indexed")
    is_upload_stale: bool = Field(default=False, example=False)
    can_finalize: bool = Field(default=False, example=False)
    can_retry_finalize: bool = Field(default=False, example=False)
    requires_reupload: bool = Field(default=False, example=False)


class FinalizeDocumentResponse(BaseModel):
    """
    Normalized response for document finalization.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Document finalized successfully")
    data: FinalizeDocumentData
    timestamp_ms: int = Field(..., example=1741392000000)


class SignedReadUrlData(BaseModel):
    """
    Signed read-url payload for private document access.
    """

    document_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    signed_read_url: str = Field(
        ...,
        example="https://project.supabase.co/storage/v1/object/sign/university-documents/official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf?token=example",
    )
    expires_in_seconds: int = Field(..., example=300)
    disposition: ReadUrlDisposition = Field(..., example="inline")


class SignedReadUrlResponse(BaseModel):
    """
    Normalized response for signed document read URL issuance.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Signed read URL generated successfully")
    data: SignedReadUrlData
    timestamp_ms: int = Field(..., example=1741392000000)


class DocumentListItem(BaseModel):
    """
    Document metadata item for list and detail endpoints.
    """

    id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Semester Rules 2026")
    original_filename: str = Field(..., example="semester-rules.pdf")
    bucket_name: str = Field(..., example="university-documents")
    storage_object_path: str = Field(
        ...,
        example="official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf",
    )
    mime_type: Optional[str] = Field(default=None, example="application/pdf")
    file_size_bytes: Optional[int] = Field(default=None, example=248731)
    processing_status: ProcessingStatus = Field(..., example="indexed")
    indexing_error: Optional[str] = Field(default=None, example=None)
    is_active: bool = Field(..., example=True)
    uploaded_by: Optional[UUID] = Field(
        default=None,
        example="11111111-1111-1111-1111-111111111111",
    )
    uploaded_by_name: Optional[str] = Field(default=None, example="Ahmad Sajid")
    created_at: datetime = Field(..., example="2026-03-08T10:00:00Z")
    updated_at: datetime = Field(..., example="2026-03-08T10:05:00Z")
    is_upload_stale: bool = Field(default=False, example=False)
    can_finalize: bool = Field(default=False, example=False)
    can_retry_finalize: bool = Field(default=False, example=False)
    requires_reupload: bool = Field(default=False, example=False)
    lifecycle_note: str = Field(
        ...,
        example="Indexed and available for retrieval.",
    )


class DocumentDetailItem(DocumentListItem):
    """
    Rich document metadata for single-document reads.
    """

    checksum_sha256: Optional[str] = Field(
        default=None,
        example="f3b0d2c5e5f6f9f7d32d8d5f9d5e8a1f9f4b8b9d4e2f7a1c3d4e5f6a7b8c9d0e",
    )
    document_type: Optional[str] = Field(default=None, example="policy")
    audience_scope: Optional[str] = Field(default=None, example="all_students")
    department: Optional[str] = Field(default=None, example="Registrar Office")
    file_path: str = Field(
        ...,
        example="official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf",
    )


class DocumentsListData(BaseModel):
    """
    List wrapper for document metadata responses.
    """

    items: List[DocumentListItem]


class DocumentsListResponse(BaseModel):
    """
    Normalized document list response.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Documents retrieved successfully")
    data: DocumentsListData
    timestamp_ms: int = Field(..., example=1741392000000)


class DocumentDetailData(BaseModel):
    """
    Single-item wrapper for document detail responses.
    """

    item: DocumentDetailItem


class DocumentDetailResponse(BaseModel):
    """
    Normalized single-document response.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Document retrieved successfully")
    data: DocumentDetailData
    timestamp_ms: int = Field(..., example=1741392000000)


class EmptyData(BaseModel):
    """
    Empty object payload for mutation responses.
    """


class SimpleMessageResponse(BaseModel):
    """
    Normalized generic mutation response.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Document deleted successfully")
    data: EmptyData
    timestamp_ms: int = Field(..., example=1741392000000)


CREATE_UPLOAD_URL_REQUEST_EXAMPLE = {
    "filename": "semester-rules.pdf",
    "mime_type": "application/pdf",
    "file_size_bytes": 248731,
    "title": "Semester Rules 2026",
    "document_type": "policy",
    "audience_scope": "all_students",
    "department": "Registrar Office",
}

CREATE_UPLOAD_URL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Signed upload URL generated successfully",
    "data": {
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "bucket_name": "university-documents",
        "storage_object_path": "official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf",
        "signed_upload_url": "https://project.supabase.co/storage/v1/object/upload/sign/university-documents/official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf?token=example",
        "upload_token": "signed-upload-token",
        "processing_status": "uploaded",
    },
    "timestamp_ms": 1741392000000,
}

FINALIZE_DOCUMENT_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Document indexed successfully",
    "data": {
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "processing_status": "indexed",
        "is_upload_stale": False,
        "can_finalize": False,
        "can_retry_finalize": False,
        "requires_reupload": False,
    },
    "timestamp_ms": 1741392000000,
}

SIGNED_READ_URL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Signed read URL generated successfully",
    "data": {
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "signed_read_url": "https://project.supabase.co/storage/v1/object/sign/university-documents/official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf?token=example",
        "expires_in_seconds": 300,
        "disposition": "inline",
    },
    "timestamp_ms": 1741392000000,
}

DOCUMENTS_LIST_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Documents retrieved successfully",
    "data": {
        "items": [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Semester Rules 2026",
                "original_filename": "semester-rules.pdf",
                "bucket_name": "university-documents",
                "storage_object_path": "official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf",
                "mime_type": "application/pdf",
                "file_size_bytes": 248731,
                "processing_status": "indexed",
                "indexing_error": None,
                "is_active": True,
                "uploaded_by": "11111111-1111-1111-1111-111111111111",
                "uploaded_by_name": "Ahmad Sajid",
                "created_at": "2026-03-08T10:00:00Z",
                "updated_at": "2026-03-08T10:05:00Z",
                "is_upload_stale": False,
                "can_finalize": False,
                "can_retry_finalize": False,
                "requires_reupload": False,
                "lifecycle_note": "Indexed and available for retrieval.",
            }
        ]
    },
    "timestamp_ms": 1741392000000,
}

DOCUMENT_DETAIL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Document retrieved successfully",
    "data": {
        "item": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Semester Rules 2026",
            "original_filename": "semester-rules.pdf",
            "bucket_name": "university-documents",
            "storage_object_path": "official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf",
            "mime_type": "application/pdf",
            "file_size_bytes": 248731,
            "processing_status": "indexed",
            "indexing_error": None,
            "is_active": True,
            "uploaded_by": "11111111-1111-1111-1111-111111111111",
            "uploaded_by_name": "Ahmad Sajid",
            "created_at": "2026-03-08T10:00:00Z",
            "updated_at": "2026-03-08T10:05:00Z",
            "is_upload_stale": False,
            "can_finalize": False,
            "can_retry_finalize": False,
            "requires_reupload": False,
            "lifecycle_note": "Indexed and available for retrieval.",
            "checksum_sha256": "f3b0d2c5e5f6f9f7d32d8d5f9d5e8a1f9f4b8b9d4e2f7a1c3d4e5f6a7b8c9d0e",
            "document_type": "policy",
            "audience_scope": "all_students",
            "department": "Registrar Office",
            "file_path": "official/2026/03/550e8400-e29b-41d4-a716-446655440000__semester-rules.pdf",
        }
    },
    "timestamp_ms": 1741392000000,
}

DELETE_DOCUMENT_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Document deleted successfully",
    "data": {},
    "timestamp_ms": 1741392000000,
}
