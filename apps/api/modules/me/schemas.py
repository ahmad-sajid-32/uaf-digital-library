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


class SelfAvatarItem(BaseModel):
    """
    Current authenticated user's avatar metadata and runtime render URL.
    """

    avatar_image_path: Optional[str] = Field(
        None,
        example="profiles/550e8400-e29b-41d4-a716-446655440000/avatar.webp",
    )
    avatar_image_url: Optional[str] = Field(
        None,
        example="https://example.supabase.co/storage/v1/object/sign/profile-avatars/profiles/550e8400-e29b-41d4-a716-446655440000/avatar.webp?token=example",
    )
    avatar_image_mime_type: Optional[str] = Field(None, example="image/webp")
    avatar_image_size_bytes: Optional[int] = Field(None, example=124000)
    avatar_image_updated_at: Optional[datetime] = Field(
        None,
        example="2026-05-26T10:30:00Z",
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


class StudentDashboardSummary(BaseModel):
    """
    KPI strip summary for the authenticated student's dashboard.
    """

    active_borrow_count: int = Field(..., example=2)
    overdue_borrow_count: int = Field(..., example=1)
    pending_fine_count: int = Field(..., example=1)
    pending_fine_amount: Decimal = Field(..., example=250)
    active_queue_count: int = Field(..., example=2)
    hold_assigned_count: int = Field(..., example=1)


class StudentDashboardNextDueBorrow(BaseModel):
    """
    Nearest due active borrow for dashboard attention.
    """

    transaction_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440010")
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    due_date: datetime = Field(..., example="2026-03-15T10:00:00Z")


class StudentDashboardCurrentHold(BaseModel):
    """
    Current hold-ready queue item for dashboard attention.
    """

    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Database Systems")
    hold_expires_at: Optional[datetime] = Field(
        None,
        example="2026-03-18T09:00:00Z",
    )
    notified_at: Optional[datetime] = Field(
        None,
        example="2026-03-16T09:00:00Z",
    )


class StudentDashboardActiveBorrowPreviewItem(BaseModel):
    """
    Small active-borrows preview row for the student dashboard.
    """

    transaction_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440010")
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    due_date: datetime = Field(..., example="2026-03-15T10:00:00Z")
    renewal_count: int = Field(..., example=1)
    is_overdue: bool = Field(..., example=False)


class StudentDashboardQueuePreviewItem(BaseModel):
    """
    Small queue preview row for the student dashboard.
    """

    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Database Systems")
    status: str = Field(..., example="waiting")
    position: Optional[int] = Field(None, example=2)
    hold_expires_at: Optional[datetime] = Field(
        None,
        example="2026-03-18T09:00:00Z",
    )


class StudentDashboardFinePreviewItem(BaseModel):
    """
    Small fine preview row for the student dashboard.
    """

    fine_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440020")
    title: str = Field(..., example="Introduction to Algorithms")
    amount: Decimal = Field(..., example=250)
    status: str = Field(..., example="pending")
    fine_created_at: datetime = Field(..., example="2026-03-16T09:00:00Z")


class StudentDashboardResultSummary(BaseModel):
    """
    Optional compact academic summary for the student dashboard.
    """

    cgpa: Optional[Decimal] = Field(None, example=3.42)
    latest_semester_label: Optional[str] = Field(None, example="Semester 6")
    latest_semester_gpa: Optional[Decimal] = Field(None, example=3.61)


class StudentDashboardData(BaseModel):
    summary: StudentDashboardSummary
    next_due_borrow: Optional[StudentDashboardNextDueBorrow] = None
    current_hold: Optional[StudentDashboardCurrentHold] = None
    active_borrows_preview: List[StudentDashboardActiveBorrowPreviewItem] = (
        Field(default_factory=list)
    )
    queue_preview: List[StudentDashboardQueuePreviewItem] = Field(default_factory=list)
    fine_preview: List[StudentDashboardFinePreviewItem] = Field(default_factory=list)
    result_summary: Optional[StudentDashboardResultSummary] = None


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


class SelfAvatarData(BaseModel):
    avatar: SelfAvatarItem


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


class StudentDashboardResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Student dashboard retrieved successfully")
    data: StudentDashboardData
    timestamp_ms: int = Field(..., example=1741348800000)


class SelfAvatarResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Avatar retrieved successfully")
    data: SelfAvatarData
    timestamp_ms: int = Field(..., example=1741348800000)


class SelfAvatarUploadResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Avatar uploaded successfully")
    data: SelfAvatarData
    timestamp_ms: int = Field(..., example=1741348800000)


class SelfAvatarDeleteResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Avatar deleted successfully")
    data: SelfAvatarData
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

STUDENT_DASHBOARD_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Student dashboard retrieved successfully",
    "data": {
        "summary": {
            "active_borrow_count": 2,
            "overdue_borrow_count": 1,
            "pending_fine_count": 1,
            "pending_fine_amount": 250,
            "active_queue_count": 2,
            "hold_assigned_count": 1,
        },
        "next_due_borrow": {
            "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
            "book_id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Introduction to Algorithms",
            "due_date": "2026-03-15T10:00:00Z",
        },
        "current_hold": {
            "book_id": "550e8400-e29b-41d4-a716-446655440001",
            "title": "Database Systems",
            "hold_expires_at": "2026-03-18T09:00:00Z",
            "notified_at": "2026-03-16T09:00:00Z",
        },
        "active_borrows_preview": [
            {
                "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "due_date": "2026-03-15T10:00:00Z",
                "renewal_count": 1,
                "is_overdue": False,
            }
        ],
        "queue_preview": [
            {
                "book_id": "550e8400-e29b-41d4-a716-446655440001",
                "title": "Database Systems",
                "status": "notified",
                "position": 1,
                "hold_expires_at": "2026-03-18T09:00:00Z",
            }
        ],
        "fine_preview": [
            {
                "fine_id": "550e8400-e29b-41d4-a716-446655440020",
                "title": "Introduction to Algorithms",
                "amount": 250,
                "status": "pending",
                "fine_created_at": "2026-03-16T09:00:00Z",
            }
        ],
        "result_summary": None,
    },
    "timestamp_ms": 1741348800000,
}

SELF_AVATAR_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Avatar retrieved successfully",
    "data": {
        "avatar": {
            "avatar_image_path": (
                "profiles/550e8400-e29b-41d4-a716-446655440000/avatar.webp"
            ),
            "avatar_image_url": (
                "https://example.supabase.co/storage/v1/object/sign/"
                "profile-avatars/profiles/550e8400-e29b-41d4-a716-446655440000/"
                "avatar.webp?token=example"
            ),
            "avatar_image_mime_type": "image/webp",
            "avatar_image_size_bytes": 124000,
            "avatar_image_updated_at": "2026-05-26T10:30:00Z",
        }
    },
    "timestamp_ms": 1741348800000,
}

SELF_AVATAR_UPLOAD_SUCCESS_EXAMPLE = {
    **SELF_AVATAR_SUCCESS_EXAMPLE,
    "message": "Avatar uploaded successfully",
}

SELF_AVATAR_DELETE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Avatar deleted successfully",
    "data": {
        "avatar": {
            "avatar_image_path": None,
            "avatar_image_url": None,
            "avatar_image_mime_type": None,
            "avatar_image_size_bytes": None,
            "avatar_image_updated_at": None,
        }
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
