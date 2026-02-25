# apps/api/modules/books/schemas.py
"""
Books Module - Response Schemas

This module defines the Pydantic models for the public
catalog listing endpoint.

Architectural Role:
- Defines response contracts exposed via HTTP.
- Mirrors the return shape of the RPC:
  library.get_public_catalog().
- Enforces Principle of Least Privilege by exposing
  only publicly safe book fields.

This file contains NO business logic.
It defines serialization and OpenAPI documentation only.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BookItemResponse(BaseModel):
    """
    Public representation of a single book in the catalog.

    Fields:
        id: Unique identifier of the book.
        title: Book title.
        author: Author name.
        category: Controlled enum category.
        status: Current availability status.
        created_at: Timestamp when the book was added.
    """

    id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    author: str = Field(..., example="Thomas H. Cormen")
    category: str = Field(..., example="COMPUTER_SCIENCE")
    status: str = Field(..., example="available")
    created_at: datetime = Field(..., example="2026-02-24T10:15:30Z")

    class Config:
        from_attributes = True


class BooksListResponse(BaseModel):
    """
    Cursor-based paginated response for public catalog listing.

    Fields:
        items: List of books.
        next_cursor_created_at: Timestamp pointer for next page.
        next_cursor_id: UUID pointer for next page.
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


# ---------------------------------------------------------
# Swagger Example (200 Success Response Only)
# ---------------------------------------------------------

BOOKS_LIST_SUCCESS_EXAMPLE = {
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
}