# apps/api/modules/librarian_metrics/schemas.py
"""
Pydantic schemas for the Librarian Metrics Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define the normalized response envelope for the librarian operational
  dashboard.
- Mirror backend-owned dashboard read data without adding business logic.
- Keep librarian metrics distinct from the admin metrics contract.
"""

from typing import List, Literal
from uuid import UUID

from pydantic import BaseModel, Field


DocumentProcessingStatusValue = Literal["uploaded", "processing", "indexed", "failed"]


class QueueHotspotItem(BaseModel):
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Database Systems")
    waiting_count: int = Field(..., example=6)


class PopularBookItem(BaseModel):
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440001")
    title: str = Field(..., example="Introduction to Algorithms")
    borrow_count: int = Field(..., example=18)


class DocumentAttentionItem(BaseModel):
    document_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440010")
    title: str = Field(..., example="Semester Rules 2026")
    processing_status: DocumentProcessingStatusValue = Field(
        ...,
        example="uploaded",
    )
    can_finalize: bool = Field(..., example=True)
    can_retry_finalize: bool = Field(..., example=False)
    requires_reupload: bool = Field(..., example=False)
    lifecycle_note: str = Field(
        ...,
        example="Waiting for file upload and finalize.",
    )


class LibrarianMetricsData(BaseModel):
    active_loan_count: int = Field(..., example=42)
    overdue_loan_count: int = Field(..., example=5)
    pending_fine_count: int = Field(..., example=7)
    documents_requiring_action_count: int = Field(..., example=3)
    queue_hotspots: List[QueueHotspotItem] = Field(default_factory=list)
    document_attention: List[DocumentAttentionItem] = Field(default_factory=list)
    popular_books: List[PopularBookItem] = Field(default_factory=list)


class LibrarianMetricsResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(
        ...,
        example="Librarian dashboard metrics retrieved successfully",
    )
    data: LibrarianMetricsData
    timestamp_ms: int = Field(..., example=1775400000000)


LIBRARIAN_METRICS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Librarian dashboard metrics retrieved successfully",
    "data": {
        "active_loan_count": 42,
        "overdue_loan_count": 5,
        "pending_fine_count": 7,
        "documents_requiring_action_count": 2,
        "queue_hotspots": [
            {
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Database Systems",
                "waiting_count": 6,
            }
        ],
        "document_attention": [
            {
                "document_id": "550e8400-e29b-41d4-a716-446655440010",
                "title": "Semester Rules 2026",
                "processing_status": "uploaded",
                "can_finalize": True,
                "can_retry_finalize": False,
                "requires_reupload": False,
                "lifecycle_note": "Waiting for file upload and finalize.",
            }
        ],
        "popular_books": [
            {
                "book_id": "550e8400-e29b-41d4-a716-446655440001",
                "title": "Introduction to Algorithms",
                "borrow_count": 18,
            }
        ],
    },
    "timestamp_ms": 1775400000000,
}
