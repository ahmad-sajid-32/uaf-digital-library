# apps/api/modules/books/schemas.py
"""
Pydantic schemas for the Books Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define normalized response envelopes for public catalog, staff inventory,
  single-book reads, queue visibility, book-management mutations, and
  book-cover metadata operations.
- Validate book-management inputs without moving business rules out of
  PostgreSQL.
- Provide OpenAPI-friendly field metadata and examples.

Book Cover Integration:
- Book cover binaries live in the Supabase Storage `book-covers` bucket.
- PostgreSQL stores only stable object metadata such as path, alt text, MIME
  type, size, and update timestamp.
- Public and staff book responses expose public cover URL fields after the
  service layer enriches database rows.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


BookCategoryValue = Literal[
    "science",
    "engineering",
    "agriculture",
    "computer_science",
    "mathematics",
    "business",
    "arts",
    "social_science",
    "other",
]

BookStatusValue = Literal[
    "available",
    "borrowed",
    "reserved",
    "maintenance",
]

EditableBookStatusValue = Literal["available", "maintenance"]

BookCoverMimeTypeValue = Literal[
    "image/jpeg",
    "image/png",
    "image/webp",
]


def _normalize_required_text(value: Any) -> Any:
    """
    Trim boundary whitespace on required text values.
    """

    if isinstance(value, str):
        return " ".join(value.strip().split())

    return value


def _normalize_optional_text(value: Any) -> Any:
    """
    Collapse optional text into a stable persisted form.
    """

    if isinstance(value, str):
        normalized = " ".join(value.strip().split())
        return normalized or None

    return value


def _normalize_enum_token(value: Any) -> Any:
    """
    Normalize enum-like tokens to lowercase snake-style input for validation.
    """

    if isinstance(value, str):
        normalized = value.strip().lower()
        return normalized or None

    return value


class StrictRequestModel(BaseModel):
    """
    Shared strict request base model for books inputs.
    """

    model_config = ConfigDict(extra="forbid")


class BookCoverPublicFields(BaseModel):
    """
    Public-safe book-cover fields shared by public and staff book responses.

    These fields are nullable because older book records may not have a cover
    image yet.
    """

    cover_image_path: str | None = Field(
        default=None,
        example="books/550e8400-e29b-41d4-a716-446655440000/cover.webp",
        description="Supabase Storage object path inside the book-covers bucket.",
    )
    cover_image_url: str | None = Field(
        default=None,
        example=(
            "https://example.supabase.co/storage/v1/object/public/book-covers/"
            "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
        ),
        description="Public read URL for the cover image.",
    )
    cover_image_alt: str | None = Field(
        default=None,
        example="Cover image for Introduction to Algorithms",
        description="Human-readable alternative text for the book cover.",
    )
    cover_image_updated_at: datetime | None = Field(
        default=None,
        example="2026-05-25T18:16:31Z",
        description="Timestamp when cover metadata was last changed.",
    )


class BookCoverStaffFields(BookCoverPublicFields):
    """
    Staff-only book-cover fields.

    Staff responses include MIME type and size because staff users manage
    uploads and replacements.
    """

    cover_image_mime_type: BookCoverMimeTypeValue | None = Field(
        default=None,
        example="image/webp",
        description="Validated MIME type of the uploaded cover image.",
    )
    cover_image_size_bytes: int | None = Field(
        default=None,
        ge=1,
        le=2_097_152,
        example=134522,
        description="Validated cover image size in bytes.",
    )


class BookItemResponse(BookCoverPublicFields):
    """
    Public representation of a single book in the catalog.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    author: str = Field(..., example="Thomas H. Cormen")
    category: BookCategoryValue = Field(..., example="computer_science")
    status: BookStatusValue = Field(..., example="available")
    created_at: datetime = Field(..., example="2026-02-24T10:15:30Z")


class BookDetailItemResponse(BookCoverPublicFields):
    """
    Detailed public representation of a single book.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    author: str = Field(..., example="Thomas H. Cormen")
    category: BookCategoryValue = Field(..., example="computer_science")
    status: BookStatusValue = Field(..., example="available")
    replacement_cost: Decimal = Field(..., example=2500)
    fine_per_day_rate: Decimal = Field(..., example=25)
    override_borrow_duration_days: int | None = Field(None, example=7)
    created_at: datetime = Field(..., example="2026-02-24T10:15:30Z")


class StaffBookListItemResponse(BookCoverStaffFields):
    """
    Staff inventory row shape for directory management.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    author: str = Field(..., example="Thomas H. Cormen")
    category: BookCategoryValue = Field(..., example="computer_science")
    status: BookStatusValue = Field(..., example="available")
    replacement_cost: Decimal = Field(..., example=2500)
    fine_per_day_rate: Decimal = Field(..., example=25)
    override_borrow_duration_days: int | None = Field(None, example=7)
    created_at: datetime = Field(..., example="2026-02-24T10:15:30Z")


class BooksListData(BaseModel):
    """
    Public catalog payload returned inside the success envelope.
    """

    model_config = ConfigDict(from_attributes=True)

    items: list[BookItemResponse]
    next_cursor_created_at: datetime | None = Field(
        None,
        example="2026-02-24T10:15:30Z",
        description="Cursor timestamp for fetching the next page.",
    )
    next_cursor_id: UUID | None = Field(
        None,
        example="550e8400-e29b-41d4-a716-446655440000",
        description="Cursor UUID for fetching the next page.",
    )


class BooksListResponse(BaseModel):
    """
    Normalized 200 response for public catalog listing.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Public catalog retrieved successfully")
    data: BooksListData
    timestamp_ms: int = Field(..., example=1741348800000)


class StaffBooksListData(BaseModel):
    """
    Staff inventory payload returned inside the success envelope.
    """

    items: list[StaffBookListItemResponse]
    total: int = Field(..., example=2)
    limit: int = Field(..., example=100)
    offset: int = Field(..., example=0)


class StaffBooksListResponse(BaseModel):
    """
    Normalized 200 response for the staff inventory list.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Staff inventory retrieved successfully")
    data: StaffBooksListData
    timestamp_ms: int = Field(..., example=1741348800000)


class BookDetailData(BaseModel):
    """
    Single-book payload returned inside the success envelope.
    """

    book: BookDetailItemResponse


class BookDetailResponse(BaseModel):
    """
    Normalized 200 response for single book retrieval.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book retrieved successfully")
    data: BookDetailData
    timestamp_ms: int = Field(..., example=1741348800000)


class StaffBookDetailData(BaseModel):
    """
    Staff single-book payload returned inside the success envelope.
    """

    book: StaffBookListItemResponse


class StaffBookDetailResponse(BaseModel):
    """
    Normalized 200 response for staff single-book retrieval.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Staff book retrieved successfully")
    data: StaffBookDetailData
    timestamp_ms: int = Field(..., example=1741348800000)


class BookQueueStatusItemResponse(BaseModel):
    """
    Queue status for one selected book.
    """

    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    book_status: BookStatusValue = Field(..., example="borrowed")
    waiting_count: int = Field(..., example=4)
    has_notified: bool = Field(..., example=True)
    notified_at: datetime | None = Field(None, example="2026-03-16T09:00:00Z")
    hold_expires_at: datetime | None = Field(
        None,
        example="2026-03-18T09:00:00Z",
    )


class BookQueueStatusData(BaseModel):
    """
    Book queue status payload returned inside the success envelope.
    """

    queue: BookQueueStatusItemResponse


class BookQueueStatusResponse(BaseModel):
    """
    Normalized 200 response for selected-book queue-status retrieval.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book queue status retrieved successfully")
    data: BookQueueStatusData
    timestamp_ms: int = Field(..., example=1741348800000)


class StaffBooksListQueryParams(StrictRequestModel):
    """
    Query parameters for the staff inventory list.
    """

    limit: int = Field(
        default=100,
        ge=1,
        le=200,
        description="Number of inventory rows to fetch (max 200).",
        example=100,
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Number of inventory rows to skip.",
        example=0,
    )


class CreateBookRequest(StrictRequestModel):
    """
    Request model for creating a new book.
    """

    title: Annotated[str, StringConstraints(min_length=1, max_length=255)] = Field(
        ...,
        example="Clean Architecture",
    )
    author: Annotated[str, StringConstraints(min_length=1, max_length=255)] = Field(
        ...,
        example="Robert C. Martin",
    )
    category: BookCategoryValue = Field(..., example="computer_science")
    replacement_cost: Decimal = Field(..., ge=0, example=2500)
    fine_per_day_rate: Decimal = Field(..., ge=0, example=25)
    override_borrow_duration_days: int | None = Field(
        default=None,
        gt=0,
        example=7,
    )

    @field_validator("title", "author", mode="before")
    @classmethod
    def normalize_required_fields(cls, value: Any) -> Any:
        """
        Normalize required text fields before validation.
        """

        return _normalize_required_text(value)

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: Any) -> Any:
        """
        Normalize category enum input before validation.
        """

        return _normalize_enum_token(value)


class UpdateBookRequest(StrictRequestModel):
    """
    Request model for updating a book.
    """

    title: Annotated[
        str | None,
        StringConstraints(min_length=1, max_length=255),
    ] = Field(default=None, example="Clean Architecture")
    author: Annotated[
        str | None,
        StringConstraints(min_length=1, max_length=255),
    ] = Field(default=None, example="Robert C. Martin")
    category: BookCategoryValue | None = Field(default=None, example="computer_science")
    status: BookStatusValue | None = Field(default=None, example="available")
    replacement_cost: Decimal | None = Field(default=None, ge=0, example=2500)
    fine_per_day_rate: Decimal | None = Field(default=None, ge=0, example=25)
    override_borrow_duration_days: int | None = Field(
        default=None,
        gt=0,
        example=7,
    )

    @field_validator("title", "author", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: Any) -> Any:
        """
        Normalize optional text fields before validation.
        """

        return _normalize_optional_text(value)

    @field_validator("category", "status", mode="before")
    @classmethod
    def normalize_enums(cls, value: Any) -> Any:
        """
        Normalize enum-like inputs before validation.
        """

        return _normalize_enum_token(value)


class BookIdData(BaseModel):
    """
    Book creation payload returned inside the success envelope.
    """

    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")


class BookIdResponse(BaseModel):
    """
    Normalized 200 response for book creation.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book created successfully")
    data: BookIdData
    timestamp_ms: int = Field(..., example=1741348800000)


class BookCoverMetadataItem(BaseModel):
    """
    Staff response item for a book-cover metadata mutation.
    """

    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    cover_image_path: str | None = Field(
        default=None,
        example="books/550e8400-e29b-41d4-a716-446655440000/cover.webp",
    )
    cover_image_url: str | None = Field(
        default=None,
        example=(
            "https://example.supabase.co/storage/v1/object/public/book-covers/"
            "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
        ),
    )
    cover_image_alt: str | None = Field(
        default=None,
        example="Cover image for Clean Architecture",
    )
    cover_image_mime_type: BookCoverMimeTypeValue | None = Field(
        default=None,
        example="image/webp",
    )
    cover_image_size_bytes: int | None = Field(
        default=None,
        ge=1,
        le=2_097_152,
        example=134522,
    )
    cover_image_updated_at: datetime | None = Field(
        default=None,
        example="2026-05-25T18:16:31Z",
    )


class BookCoverUploadData(BaseModel):
    """
    Payload returned after a successful book-cover upload.
    """

    cover: BookCoverMetadataItem


class BookCoverUploadResponse(BaseModel):
    """
    Normalized 200 response for book-cover upload or replacement.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book cover uploaded successfully")
    data: BookCoverUploadData
    timestamp_ms: int = Field(..., example=1741348800000)


class BookCoverDeleteItem(BookCoverMetadataItem):
    """
    Staff response item for clearing book-cover metadata.

    previous_cover_image_path helps the API caller understand which object was
    removed or attempted for cleanup.
    """

    previous_cover_image_path: str | None = Field(
        default=None,
        example="books/550e8400-e29b-41d4-a716-446655440000/cover.webp",
    )
    previous_cover_image_url: str | None = Field(
        default=None,
        example=(
            "https://example.supabase.co/storage/v1/object/public/book-covers/"
            "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
        ),
    )


class BookCoverDeleteData(BaseModel):
    """
    Payload returned after successful book-cover removal.
    """

    cover: BookCoverDeleteItem


class BookCoverDeleteResponse(BaseModel):
    """
    Normalized 200 response for book-cover removal.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book cover removed successfully")
    data: BookCoverDeleteData
    timestamp_ms: int = Field(..., example=1741348800000)


class EmptyData(BaseModel):
    """
    Empty object payload for mutation success responses.
    """


class SimpleMessageResponse(BaseModel):
    """
    Normalized 200 response for simple successful mutations.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book updated successfully")
    data: EmptyData = Field(default_factory=EmptyData)
    timestamp_ms: int = Field(..., example=1741348800000)


BOOKS_LIST_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Public catalog retrieved successfully",
    "data": {
        "items": [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "author": "Thomas H. Cormen",
                "category": "computer_science",
                "status": "available",
                "cover_image_path": (
                    "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
                ),
                "cover_image_url": (
                    "https://example.supabase.co/storage/v1/object/public/"
                    "book-covers/books/550e8400-e29b-41d4-a716-446655440000/"
                    "cover.webp"
                ),
                "cover_image_alt": "Cover image for Introduction to Algorithms",
                "cover_image_updated_at": "2026-05-25T18:16:31Z",
                "created_at": "2026-02-24T10:15:30Z",
            }
        ],
        "next_cursor_created_at": "2026-02-24T10:15:30Z",
        "next_cursor_id": "550e8400-e29b-41d4-a716-446655440000",
    },
    "timestamp_ms": 1741348800000,
}

BOOK_DETAIL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Book retrieved successfully",
    "data": {
        "book": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Introduction to Algorithms",
            "author": "Thomas H. Cormen",
            "category": "computer_science",
            "status": "available",
            "replacement_cost": 2500,
            "fine_per_day_rate": 25,
            "override_borrow_duration_days": 7,
            "cover_image_path": (
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "cover_image_url": (
                "https://example.supabase.co/storage/v1/object/public/book-covers/"
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "cover_image_alt": "Cover image for Introduction to Algorithms",
            "cover_image_updated_at": "2026-05-25T18:16:31Z",
            "created_at": "2026-02-24T10:15:30Z",
        }
    },
    "timestamp_ms": 1741348800000,
}

STAFF_BOOKS_LIST_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Staff inventory retrieved successfully",
    "data": {
        "items": [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "author": "Thomas H. Cormen",
                "category": "computer_science",
                "status": "available",
                "replacement_cost": 2500,
                "fine_per_day_rate": 25,
                "override_borrow_duration_days": 7,
                "cover_image_path": (
                    "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
                ),
                "cover_image_url": (
                    "https://example.supabase.co/storage/v1/object/public/"
                    "book-covers/books/550e8400-e29b-41d4-a716-446655440000/"
                    "cover.webp"
                ),
                "cover_image_alt": "Cover image for Introduction to Algorithms",
                "cover_image_mime_type": "image/webp",
                "cover_image_size_bytes": 134522,
                "cover_image_updated_at": "2026-05-25T18:16:31Z",
                "created_at": "2026-02-24T10:15:30Z",
            }
        ],
        "total": 1,
        "limit": 100,
        "offset": 0,
    },
    "timestamp_ms": 1741348800000,
}

STAFF_BOOK_DETAIL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Staff book retrieved successfully",
    "data": {
        "book": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Introduction to Algorithms",
            "author": "Thomas H. Cormen",
            "category": "computer_science",
            "status": "borrowed",
            "replacement_cost": 2500,
            "fine_per_day_rate": 25,
            "override_borrow_duration_days": 7,
            "cover_image_path": (
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "cover_image_url": (
                "https://example.supabase.co/storage/v1/object/public/book-covers/"
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "cover_image_alt": "Cover image for Introduction to Algorithms",
            "cover_image_mime_type": "image/webp",
            "cover_image_size_bytes": 134522,
            "cover_image_updated_at": "2026-05-25T18:16:31Z",
            "created_at": "2026-02-24T10:15:30Z",
        }
    },
    "timestamp_ms": 1741348800000,
}

BOOK_QUEUE_STATUS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Book queue status retrieved successfully",
    "data": {
        "queue": {
            "book_id": "550e8400-e29b-41d4-a716-446655440000",
            "book_status": "borrowed",
            "waiting_count": 4,
            "has_notified": True,
            "notified_at": "2026-03-16T09:00:00Z",
            "hold_expires_at": "2026-03-18T09:00:00Z",
        }
    },
    "timestamp_ms": 1741348800000,
}

CREATE_BOOK_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Book created successfully",
    "data": {
        "book_id": "550e8400-e29b-41d4-a716-446655440000",
    },
    "timestamp_ms": 1741348800000,
}

UPDATE_BOOK_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Book updated successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}

DELETE_BOOK_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Book deleted successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}

BOOK_COVER_UPLOAD_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Book cover uploaded successfully",
    "data": {
        "cover": {
            "book_id": "550e8400-e29b-41d4-a716-446655440000",
            "cover_image_path": (
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "cover_image_url": (
                "https://example.supabase.co/storage/v1/object/public/book-covers/"
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "cover_image_alt": "Cover image for Clean Architecture",
            "cover_image_mime_type": "image/webp",
            "cover_image_size_bytes": 134522,
            "cover_image_updated_at": "2026-05-25T18:16:31Z",
        }
    },
    "timestamp_ms": 1741348800000,
}

BOOK_COVER_DELETE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Book cover removed successfully",
    "data": {
        "cover": {
            "book_id": "550e8400-e29b-41d4-a716-446655440000",
            "previous_cover_image_path": (
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "previous_cover_image_url": (
                "https://example.supabase.co/storage/v1/object/public/book-covers/"
                "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
            ),
            "cover_image_path": None,
            "cover_image_url": None,
            "cover_image_alt": None,
            "cover_image_mime_type": None,
            "cover_image_size_bytes": None,
            "cover_image_updated_at": "2026-05-25T18:16:31Z",
        }
    },
    "timestamp_ms": 1741348800000,
}