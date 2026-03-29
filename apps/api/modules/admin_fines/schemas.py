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
from typing import Annotated, Any, List, Literal, Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)


class StrictRequestModel(BaseModel):
    """
    Shared strict request base model for admin-fines query validation.
    """

    model_config = ConfigDict(extra="forbid")


class AdminFinesListQueryParams(StrictRequestModel):
    """
    Query parameters for the staff fine-management list.
    """

    status: Literal["pending", "paid", "waived", "cancelled"] | None = Field(
        default=None,
        description="Optional exact fine-status filter.",
        example="pending",
    )
    search: Annotated[
        str | None,
        StringConstraints(min_length=1, max_length=100),
    ] = Field(
        default=None,
        description=(
            "Case-insensitive search across borrower full name and book title. "
            "If the value parses as a UUID, an exact fine-id match is also applied."
        ),
        example="ahmad",
    )
    created_from: datetime | None = Field(
        default=None,
        description="Inclusive lower bound for fine_created_at.",
        example="2026-03-01T00:00:00Z",
    )
    created_to: datetime | None = Field(
        default=None,
        description="Exclusive upper bound for fine_created_at.",
        example="2026-04-01T00:00:00Z",
    )
    resolved_from: datetime | None = Field(
        default=None,
        description="Inclusive lower bound for resolved_at.",
        example="2026-03-10T00:00:00Z",
    )
    resolved_to: datetime | None = Field(
        default=None,
        description="Exclusive upper bound for resolved_at.",
        example="2026-04-01T00:00:00Z",
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=200,
        description="Number of records to fetch (max 200).",
        example=50,
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Number of matching records to skip.",
        example=0,
    )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: Any) -> Any:
        """
        Normalize optional status filters to stable lowercase tokens.
        """

        if isinstance(value, str):
            normalized = value.strip().lower()
            return normalized or None

        return value

    @field_validator("search", mode="before")
    @classmethod
    def normalize_search(cls, value: Any) -> Any:
        """
        Trim and collapse meaningless search whitespace.
        """

        if isinstance(value, str):
            normalized = " ".join(value.strip().split())
            return normalized or None

        return value

    @model_validator(mode="after")
    def validate_date_windows(self) -> "AdminFinesListQueryParams":
        """
        Ensure each date window has a valid lower/upper ordering.
        """

        if (
            self.created_from is not None
            and self.created_to is not None
            and self.created_from >= self.created_to
        ):
            raise ValueError("created_from must be earlier than created_to")

        if (
            self.resolved_from is not None
            and self.resolved_to is not None
            and self.resolved_from >= self.resolved_to
        ):
            raise ValueError("resolved_from must be earlier than resolved_to")

        return self


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
    total: int = Field(..., example=1)
    limit: int = Field(..., example=50)
    offset: int = Field(..., example=0)


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
        ],
        "total": 1,
        "limit": 50,
        "offset": 0,
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
