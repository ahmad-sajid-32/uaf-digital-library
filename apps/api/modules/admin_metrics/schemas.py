# apps/api/modules/admin_metrics/schemas.py
"""
Pydantic schemas for the Admin Metrics Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define typed response models for the admin dashboard metrics RPC.
- Mirror the JSON structure returned by PostgreSQL without adding logic.
"""

from decimal import Decimal
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class PopularBookItem(BaseModel):
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
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
        example="Cover image for Introduction to Algorithms",
    )
    borrow_count: int = Field(..., example=18)


class QueuePressureItem(BaseModel):
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    cover_image_path: str | None = Field(
        default=None,
        example="books/550e8400-e29b-41d4-a716-446655440001/cover.webp",
    )
    cover_image_url: str | None = Field(
        default=None,
        example=(
            "https://example.supabase.co/storage/v1/object/public/book-covers/"
            "books/550e8400-e29b-41d4-a716-446655440001/cover.webp"
        ),
    )
    cover_image_alt: str | None = Field(
        default=None,
        example="Cover image for Database Systems",
    )
    waiting_count: int = Field(..., example=6)


class AdminMetricsData(BaseModel):
    active_borrow_count: int = Field(..., example=42)
    overdue_count: int = Field(..., example=5)
    total_pending_fines: Decimal = Field(..., example=1250)
    popular_books: List[PopularBookItem]
    queue_pressure: List[QueuePressureItem]


class AdminMetricsResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Admin metrics retrieved successfully")
    data: AdminMetricsData
    timestamp_ms: int = Field(..., example=1741348800000)


ADMIN_METRICS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Admin metrics retrieved successfully",
    "data": {
        "active_borrow_count": 42,
        "overdue_count": 5,
        "total_pending_fines": 1250,
        "popular_books": [
            {
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "cover_image_path": (
                    "books/550e8400-e29b-41d4-a716-446655440000/cover.webp"
                ),
                "cover_image_url": (
                    "https://example.supabase.co/storage/v1/object/public/"
                    "book-covers/books/550e8400-e29b-41d4-a716-446655440000/"
                    "cover.webp"
                ),
                "cover_image_alt": "Cover image for Introduction to Algorithms",
                "borrow_count": 18,
            }
        ],
        "queue_pressure": [
            {
                "book_id": "550e8400-e29b-41d4-a716-446655440001",
                "title": "Database Systems",
                "cover_image_path": (
                    "books/550e8400-e29b-41d4-a716-446655440001/cover.webp"
                ),
                "cover_image_url": (
                    "https://example.supabase.co/storage/v1/object/public/"
                    "book-covers/books/550e8400-e29b-41d4-a716-446655440001/"
                    "cover.webp"
                ),
                "cover_image_alt": "Cover image for Database Systems",
                "waiting_count": 6,
            }
        ],
    },
    "timestamp_ms": 1741348800000,
}
