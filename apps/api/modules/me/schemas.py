# apps/api/modules/me/schemas.py
"""
Pydantic schemas for the Me Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define typed response models for authenticated self-service read endpoints.
- Mirror PostgreSQL RPC return shapes without adding business logic.
- Provide normalized success envelopes for Swagger and runtime responses.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UpdateMyProfileRequest(BaseModel):
    """
    Request model for updating the authenticated user's full name.
    """

    full_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        example="Ahmad Sajid",
    )


class ActiveBorrowItem(BaseModel):
    """
    One active borrow record for the authenticated user.
    """

    transaction_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440010")
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    author: str = Field(..., example="Thomas H. Cormen")
    category: str = Field(..., example="computer_science")
    book_status: str = Field(..., example="borrowed")
    issue_date: datetime = Field(..., example="2026-03-01T10:00:00Z")
    due_date: datetime = Field(..., example="2026-03-15T10:00:00Z")
    renewal_count: int = Field(..., example=0)


class BorrowHistoryItem(ActiveBorrowItem):
    """
    One historical borrow record for the authenticated user.
    """

    return_date: datetime = Field(..., example="2026-03-12T08:00:00Z")


class FineItem(BaseModel):
    """
    One fine record for the authenticated user.
    """

    fine_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440020")
    transaction_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440010")
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    amount: Decimal = Field(..., example=250)
    status: str = Field(..., example="pending")
    fine_created_at: datetime = Field(..., example="2026-03-16T09:00:00Z")
    issue_date: datetime = Field(..., example="2026-03-01T10:00:00Z")
    due_date: datetime = Field(..., example="2026-03-15T10:00:00Z")
    return_date: Optional[datetime] = Field(None, example="2026-03-16T08:00:00Z")
    resolved_at: Optional[datetime] = Field(None, example="2026-03-17T11:00:00Z")
    resolved_by: Optional[UUID] = Field(None, example="550e8400-e29b-41d4-a716-446655440099")
    waive_reason: Optional[str] = Field(None, example="Late return waived due to approved exception.")


class FineHistoryItem(BaseModel):
    """
    One historical fine record for the authenticated user.
    """

    fine_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440020")
    transaction_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440010")
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    amount: Decimal = Field(..., example=250)
    status: str = Field(..., example="waived")
    fine_created_at: datetime = Field(..., example="2026-03-16T09:00:00Z")
    resolved_at: Optional[datetime] = Field(None, example="2026-03-17T11:00:00Z")
    resolved_by: Optional[UUID] = Field(None, example="550e8400-e29b-41d4-a716-446655440099")
    resolved_by_name: Optional[str] = Field(None, example="Library Manager")
    waive_reason: Optional[str] = Field(None, example="Approved hardship waiver.")
    issue_date: datetime = Field(..., example="2026-03-01T10:00:00Z")
    due_date: datetime = Field(..., example="2026-03-15T10:00:00Z")
    return_date: Optional[datetime] = Field(None, example="2026-03-16T08:00:00Z")


class QueueEntryItem(BaseModel):
    """
    One queue entry record for the authenticated user.
    """

    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    status: str = Field(..., example="waiting")
    position: int = Field(..., example=2)
    notified_at: Optional[datetime] = Field(None, example="2026-03-16T09:00:00Z")
    hold_expires_at: Optional[datetime] = Field(None, example="2026-03-18T09:00:00Z")


class ActiveBorrowsData(BaseModel):
    items: List[ActiveBorrowItem]


class BorrowHistoryData(BaseModel):
    items: List[BorrowHistoryItem]


class FinesData(BaseModel):
    items: List[FineItem]


class FineHistoryData(BaseModel):
    items: List[FineHistoryItem]


class QueueEntriesData(BaseModel):
    items: List[QueueEntryItem]


class EmptyData(BaseModel):
    """
    Empty object payload for successful self-service mutations.
    """

    pass


class SimpleMessageResponse(BaseModel):
    """
    Normalized 200 response for successful self-service mutations.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Profile updated successfully")
    data: EmptyData = Field(default_factory=EmptyData)
    timestamp_ms: int = Field(..., example=1741348800000)


class ActiveBorrowsResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Active borrows retrieved successfully")
    data: ActiveBorrowsData
    timestamp_ms: int = Field(..., example=1741348800000)


class BorrowHistoryResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Borrow history retrieved successfully")
    data: BorrowHistoryData
    timestamp_ms: int = Field(..., example=1741348800000)


class FinesResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Fines retrieved successfully")
    data: FinesData
    timestamp_ms: int = Field(..., example=1741348800000)


class FineHistoryResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Fine history retrieved successfully")
    data: FineHistoryData
    timestamp_ms: int = Field(..., example=1741348800000)


class QueueEntriesResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Queue entries retrieved successfully")
    data: QueueEntriesData
    timestamp_ms: int = Field(..., example=1741348800000)


ACTIVE_BORROWS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Active borrows retrieved successfully",
    "data": {
        "items": [
            {
                "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "author": "Thomas H. Cormen",
                "category": "computer_science",
                "book_status": "borrowed",
                "issue_date": "2026-03-01T10:00:00Z",
                "due_date": "2026-03-15T10:00:00Z",
                "renewal_count": 0,
            }
        ]
    },
    "timestamp_ms": 1741348800000,
}

BORROW_HISTORY_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Borrow history retrieved successfully",
    "data": {
        "items": [
            {
                "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "author": "Thomas H. Cormen",
                "category": "computer_science",
                "book_status": "available",
                "issue_date": "2026-03-01T10:00:00Z",
                "due_date": "2026-03-15T10:00:00Z",
                "return_date": "2026-03-12T08:00:00Z",
                "renewal_count": 1,
            }
        ]
    },
    "timestamp_ms": 1741348800000,
}

FINES_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Fines retrieved successfully",
    "data": {
        "items": [
            {
                "fine_id": "550e8400-e29b-41d4-a716-446655440020",
                "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "amount": 250,
                "status": "pending",
                "fine_created_at": "2026-03-16T09:00:00Z",
                "issue_date": "2026-03-01T10:00:00Z",
                "due_date": "2026-03-15T10:00:00Z",
                "return_date": "2026-03-16T08:00:00Z",
                "resolved_at": None,
                "resolved_by": None,
                "waive_reason": None,
            }
        ]
    },
    "timestamp_ms": 1741348800000,
}

FINE_HISTORY_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Fine history retrieved successfully",
    "data": {
        "items": [
            {
                "fine_id": "550e8400-e29b-41d4-a716-446655440020",
                "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "amount": 250,
                "status": "waived",
                "fine_created_at": "2026-03-16T09:00:00Z",
                "resolved_at": "2026-03-17T11:00:00Z",
                "resolved_by": "550e8400-e29b-41d4-a716-446655440099",
                "resolved_by_name": "Library Manager",
                "waive_reason": "Approved hardship waiver.",
                "issue_date": "2026-03-01T10:00:00Z",
                "due_date": "2026-03-15T10:00:00Z",
                "return_date": "2026-03-16T08:00:00Z",
            }
        ]
    },
    "timestamp_ms": 1741348800000,
}

QUEUE_ENTRIES_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Queue entries retrieved successfully",
    "data": {
        "items": [
            {
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "status": "waiting",
                "position": 2,
                "notified_at": None,
                "hold_expires_at": None,
            }
        ]
    },
    "timestamp_ms": 1741348800000,
}

UPDATE_MY_PROFILE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Profile updated successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}

DELETE_MY_ACCOUNT_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Account deleted successfully",
    "data": {},
    "timestamp_ms": 1741348800000,
}
