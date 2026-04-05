# apps/api/modules/circulation/schemas.py
"""
Pydantic schemas for the Staff Circulation Management Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define normalized response envelopes for staff circulation list/detail reads
  and transaction-scoped circulation actions.
- Validate circulation query inputs and due-date adjustment payloads without
  moving circulation rules out of PostgreSQL.
- Keep OpenAPI examples aligned with the circulation read model used by the UI.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


CirculationScopeValue = Literal["active", "overdue", "history"]
RoleValue = Literal["student", "librarian", "admin"]
BookStatusValue = Literal["available", "borrowed", "reserved", "maintenance"]
FineStatusValue = Literal["pending", "paid", "waived", "cancelled"]
QueueStatusValue = Literal["waiting", "notified"]


def _normalize_optional_text(value: Any) -> Any:
    if isinstance(value, str):
        normalized = " ".join(value.strip().split())
        return normalized or None

    return value


def _normalize_enum_token(value: Any) -> Any:
    if isinstance(value, str):
        normalized = value.strip().lower()
        return normalized or None

    return value


class StrictRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StaffCirculationLoanListQueryParams(StrictRequestModel):
    scope: CirculationScopeValue = Field(default="active", example="active")
    search: Annotated[
        str | None,
        StringConstraints(min_length=1, max_length=100),
    ] = Field(default=None, example="ahmad")
    role: RoleValue | None = Field(default=None, example="student")
    book_status: BookStatusValue | None = Field(default=None, example="borrowed")
    due_from: datetime | None = Field(default=None, example="2026-04-01T00:00:00Z")
    due_to: datetime | None = Field(default=None, example="2026-05-01T00:00:00Z")
    limit: int = Field(default=100, ge=1, le=200, example=100)
    offset: int = Field(default=0, ge=0, example=0)

    @field_validator("scope", "role", "book_status", mode="before")
    @classmethod
    def normalize_enums(cls, value: Any) -> Any:
        return _normalize_enum_token(value)

    @field_validator("search", mode="before")
    @classmethod
    def normalize_search(cls, value: Any) -> Any:
        return _normalize_optional_text(value)


class StaffCirculationLoanItemResponse(BaseModel):
    transaction_id: UUID
    user_id: UUID
    user_full_name: str
    user_email: str | None
    user_role: RoleValue
    roll_number: str | None
    employee_code: str | None
    book_id: UUID
    book_title: str
    book_author: str
    book_category: str
    book_status: BookStatusValue
    issue_date: datetime
    due_date: datetime
    return_date: datetime | None
    renewal_count: int
    is_overdue: bool
    fine_amount: Decimal
    fine_status: FineStatusValue | None
    waiting_count: int
    queue_status: QueueStatusValue | None
    hold_expires_at: datetime | None
    can_return: bool
    can_adjust_due_date: bool
    can_renew: bool


class StaffCirculationLoanDetailItemResponse(StaffCirculationLoanItemResponse):
    pass


class StaffCirculationLoansData(BaseModel):
    items: list[StaffCirculationLoanItemResponse]
    total: int
    limit: int
    offset: int


class StaffCirculationLoansResponse(BaseModel):
    status: int
    message: str
    data: StaffCirculationLoansData
    timestamp_ms: int


class StaffCirculationLoanDetailData(BaseModel):
    item: StaffCirculationLoanDetailItemResponse


class StaffCirculationLoanDetailResponse(BaseModel):
    status: int
    message: str
    data: StaffCirculationLoanDetailData
    timestamp_ms: int


class AdjustDueDateRequest(StrictRequestModel):
    due_date: datetime = Field(..., example="2026-04-20T09:00:00Z")


class EmptyData(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SimpleMessageResponse(BaseModel):
    status: int
    message: str
    data: EmptyData = Field(default_factory=EmptyData)
    timestamp_ms: int


STAFF_CIRCULATION_LOANS_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Circulation loans retrieved successfully",
    "data": {
        "items": [
            {
                "transaction_id": "550e8400-e29b-41d4-a716-446655440301",
                "user_id": "550e8400-e29b-41d4-a716-446655440001",
                "user_full_name": "Ahmad Sajid",
                "user_email": "ahmad@uaf.edu.pk",
                "user_role": "student",
                "roll_number": "2021-ag-101",
                "employee_code": None,
                "book_id": "550e8400-e29b-41d4-a716-446655440000",
                "book_title": "Introduction to Algorithms",
                "book_author": "Thomas H. Cormen",
                "book_category": "computer_science",
                "book_status": "borrowed",
                "issue_date": "2026-04-01T09:00:00Z",
                "due_date": "2026-04-15T09:00:00Z",
                "return_date": None,
                "renewal_count": 1,
                "is_overdue": False,
                "fine_amount": 0,
                "fine_status": None,
                "waiting_count": 2,
                "queue_status": "waiting",
                "hold_expires_at": None,
                "can_return": True,
                "can_adjust_due_date": True,
                "can_renew": False,
            }
        ],
        "total": 1,
        "limit": 100,
        "offset": 0,
    },
    "timestamp_ms": 1775400000000,
}


STAFF_CIRCULATION_LOAN_DETAIL_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Circulation loan retrieved successfully",
    "data": STAFF_CIRCULATION_LOANS_SUCCESS_EXAMPLE["data"] | {},
    "timestamp_ms": 1775400000000,
}
STAFF_CIRCULATION_LOAN_DETAIL_SUCCESS_EXAMPLE["data"] = {
    "item": STAFF_CIRCULATION_LOANS_SUCCESS_EXAMPLE["data"]["items"][0]
}


CIRCULATION_RETURN_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Loan returned successfully",
    "data": {},
    "timestamp_ms": 1775400000000,
}


CIRCULATION_DUE_DATE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Loan due date adjusted successfully",
    "data": {},
    "timestamp_ms": 1775400000000,
}


CIRCULATION_RENEW_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Loan renewed successfully",
    "data": {},
    "timestamp_ms": 1775400000000,
}
