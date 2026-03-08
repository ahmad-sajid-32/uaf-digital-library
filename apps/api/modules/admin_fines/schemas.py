# apps/api/modules/admin_fines/schemas.py
"""
Pydantic schemas for the Admin Fine History Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define typed response models for admin/librarian fine history reads.
- Mirror PostgreSQL RPC return shapes without adding business logic.
- Provide normalized success envelopes for Swagger and runtime responses.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AdminFineListItem(BaseModel):
    """
    One fine record in the admin/librarian fine history list.
    """

    fine_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440020")
    transaction_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440010")
    user_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440001")
    user_full_name: str = Field(..., example="Ahmad Sajid")
    book_id: UUID = Field(..., example="550e8400-e29b-41d4-a716-446655440000")
    title: str = Field(..., example="Introduction to Algorithms")
    amount: Decimal = Field(..., example=250)
    status: str = Field(..., example="pending")
    fine_created_at: datetime = Field(..., example="2026-03-16T09:00:00Z")
    resolved_at: Optional[datetime] = Field(None, example="2026-03-17T11:00:00Z")
    resolved_by: Optional[UUID] = Field(None, example="550e8400-e29b-41d4-a716-446655440099")
    resolved_by_name: Optional[str] = Field(None, example="Library Manager")
    waive_reason: Optional[str] = Field(None, example="Approved hardship waiver.")


class AdminFineDetailItem(AdminFineListItem):
    """
    One fully detailed fine record for admin/librarian reads.
    """

    issue_date: datetime = Field(..., example="2026-03-01T10:00:00Z")
    due_date: datetime = Field(..., example="2026-03-15T10:00:00Z")
    return_date: Optional[datetime] = Field(None, example="2026-03-16T08:00:00Z")


class AdminFinesData(BaseModel):
    items: List[AdminFineListItem]


class AdminFineDetailData(BaseModel):
    item: AdminFineDetailItem


class AdminFinesResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Fine history retrieved successfully")
    data: AdminFinesData
    timestamp_ms: int = Field(..., example=1741348800000)


class AdminFineDetailResponse(BaseModel):
    status: int = Field(..., example=200)
    message: str = Field(..., example="Fine detail retrieved successfully")
    data: AdminFineDetailData
    timestamp_ms: int = Field(..., example=1741348800000)


ADMIN_FINES_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Fine history retrieved successfully",
    "data": {
        "items": [
            {
                "fine_id": "550e8400-e29b-41d4-a716-446655440020",
                "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
                "user_id": "550e8400-e29b-41d4-a716-446655440001",
                "user_full_name": "Ahmad Sajid",
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "title": "Introduction to Algorithms",
                "amount": 250,
                "status": "pending",
                "fine_created_at": "2026-03-16T09:00:00Z",
                "resolved_at": None,
                "resolved_by": None,
                "resolved_by_name": None,
                "waive_reason": None,
            }
        ]
    },
    "timestamp_ms": 1741348800000,
}


ADMIN_FINE_DETAIL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Fine detail retrieved successfully",
    "data": {
        "item": {
            "fine_id": "550e8400-e29b-41d4-a716-446655440020",
            "transaction_id": "550e8400-e29b-41d4-a716-446655440010",
            "user_id": "550e8400-e29b-41d4-a716-446655440001",
            "user_full_name": "Ahmad Sajid",
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
    },
    "timestamp_ms": 1741348800000,
}
