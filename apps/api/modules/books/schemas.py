# apps/api/modules/books/schemas.py
"""
Books Module - Schemas

This module defines the Pydantic models used by the Books module.

Responsibilities:
- Define normalized response envelopes for public catalog and book management.
- Define request models for book management mutations.
- Provide OpenAPI-friendly field metadata and examples.

Architectural Constraints:
- No business logic.
- No database logic.
- No RPC logic.
- Validation and serialization only.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BookItemResponse(BaseModel):
    """
    Public representation of a single book in the catalog.
    """

    id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    author: str = Field(..., example="Thomas H. Cormen")
    category: str = Field(..., example="COMPUTER_SCIENCE")
    status: str = Field(..., example="available")
    created_at: datetime = Field(..., example="2026-02-24T10:15:30Z")

    class Config:
        from_attributes = True


class BookDetailItemResponse(BaseModel):
    """
    Detailed representation of a single book.
    """

    id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    author: str = Field(..., example="Thomas H. Cormen")
    category: str = Field(..., example="computer_science")
    status: str = Field(..., example="available")
    replacement_cost: Decimal = Field(..., example=2500)
    fine_per_day_rate: Decimal = Field(..., example=25)
    override_borrow_duration_days: Optional[int] = Field(None, example=7)
    created_at: datetime = Field(..., example="2026-02-24T10:15:30Z")

    class Config:
        from_attributes = True


class BooksListData(BaseModel):
    """
    Public catalog payload returned inside the success envelope.
    """

    items: List[BookItemResponse]
    next_cursor_created_at: Optional[datetime] = Field(
        None,
        example="2026-02-24T10:15:30Z",
        description="Cursor timestamp for fetching next page.",
    )
    next_cursor_id: Optional[UUID] = Field(
        None,
        example="550e8400-e29b-41d4-a716-446655440000",
        description="Cursor UUID for fetching next page.",
    )

    class Config:
        from_attributes = True


class BooksListResponse(BaseModel):
    """
    Normalized 200 response for public catalog listing.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Public catalog retrieved successfully")
    data: BooksListData
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


class BookQueueStatusItemResponse(BaseModel):
    """
    Public-safe queue status for one book.
    """

    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    book_status: str = Field(..., example="borrowed")
    waiting_count: int = Field(..., example=4)
    has_notified: bool = Field(..., example=True)
    notified_at: Optional[datetime] = Field(None, example="2026-03-16T09:00:00Z")
    hold_expires_at: Optional[datetime] = Field(None, example="2026-03-18T09:00:00Z")


class BookQueueStatusData(BaseModel):
    """
    Book queue status payload returned inside the success envelope.
    """

    queue: BookQueueStatusItemResponse


class BookQueueStatusResponse(BaseModel):
    """
    Normalized 200 response for public book queue status retrieval.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book queue status retrieved successfully")
    data: BookQueueStatusData
    timestamp_ms: int = Field(..., example=1741348800000)


class CreateBookRequest(BaseModel):
    """
    Request model for creating a new book.
    """

    title: str = Field(..., example="Clean Architecture")
    author: str = Field(..., example="Robert C. Martin")
    category: str = Field(..., example="COMPUTER_SCIENCE")
    replacement_cost: Decimal = Field(..., example=2500)
    fine_per_day_rate: Decimal = Field(..., example=25)
    override_borrow_duration_days: Optional[int] = Field(None, example=7)


class UpdateBookRequest(BaseModel):
    """
    Request model for updating a book.
    """

    title: Optional[str] = Field(None, example="Clean Architecture")
    author: Optional[str] = Field(None, example="Robert C. Martin")
    category: Optional[str] = Field(None, example="COMPUTER_SCIENCE")
    status: Optional[str] = Field(None, example="available")
    replacement_cost: Optional[Decimal] = Field(None, example=2500)
    fine_per_day_rate: Optional[Decimal] = Field(None, example=25)
    override_borrow_duration_days: Optional[int] = Field(None, example=7)


class BookIdData(BaseModel):
    """
    Book creation payload returned inside the success envelope.
    """

    book_id: UUID = Field(
        ...,
        example="550e8400-e29b-41d4-a716-446655440000",
    )


class BookIdResponse(BaseModel):
    """
    Normalized 200 response for book creation.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Book created successfully")
    data: BookIdData
    timestamp_ms: int = Field(..., example=1741348800000)


class EmptyData(BaseModel):
    """
    Empty object payload for mutation success responses.
    """

    pass


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
                "category": "COMPUTER_SCIENCE",
                "status": "available",
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
