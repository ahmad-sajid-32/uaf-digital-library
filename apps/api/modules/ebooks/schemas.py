"""Typed HTTP contracts for the E-Books module."""

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.config import settings


BookCategory = Literal[
    "science", "engineering", "agriculture", "computer_science", "mathematics",
    "business", "arts", "social_science", "other",
]
EBookFormat = Literal["pdf", "epub"]
EBookAccessScope = Literal["all_authenticated", "students_only", "staff_only"]
EBookAccessEventType = Literal["preview", "download"]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EBookUploadRequest(StrictRequest):
    title: str = Field(min_length=1, max_length=255)
    authors: str = Field(min_length=1, max_length=500)
    category: BookCategory
    filename: str = Field(min_length=1, max_length=255)
    file_format: EBookFormat
    mime_type: str = Field(min_length=1, max_length=100)
    file_size_bytes: int = Field(gt=0)

    @field_validator("file_size_bytes")
    @classmethod
    def validate_size(cls, value: int) -> int:
        if value > settings.ebook_upload_max_file_size_bytes:
            raise ValueError("File exceeds upload size limit")
        return value


class EBookUpdateRequest(StrictRequest):
    title: str = Field(min_length=1, max_length=255)
    subtitle: str | None = Field(default=None, max_length=255)
    authors: str = Field(min_length=1, max_length=500)
    description: str | None = None
    isbn: str | None = Field(default=None, max_length=64)
    publisher: str | None = Field(default=None, max_length=255)
    publication_year: int | None = Field(default=None, ge=1000, le=2200)
    edition: str | None = Field(default=None, max_length=100)
    language: str = Field(default="English", min_length=1, max_length=100)
    category: BookCategory
    keywords: list[str] = Field(default_factory=list, max_length=50)
    linked_book_id: UUID | None = None
    access_scope: EBookAccessScope = "all_authenticated"
    allow_preview: bool = True
    allow_download: bool = True


class EBookAccessRequest(StrictRequest):
    event_type: EBookAccessEventType


class EBookCoverRequest(StrictRequest):
    alt_text: str | None = Field(default=None, max_length=255)


class ApiResponse(BaseModel):
    status: int
    message: str
    data: Any
    timestamp_ms: int

