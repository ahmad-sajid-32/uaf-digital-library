# apps/api/modules/borrow/schemas.py
"""
Pydantic schemas for the Borrow Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Validate authenticated borrow action payloads.
- Define normalized success envelopes for Swagger and route responses.
- Keep the request contract minimal and deterministic.
"""

from uuid import UUID

from pydantic import BaseModel, Field


class BorrowActionRequest(BaseModel):
    """
    Request model for borrow, return, and renew actions.
    """

    book_id: UUID = Field(
        ...,
        example="550e8400-e29b-41d4-a716-446655440000",
    )


class EmptyData(BaseModel):
    """
    Empty object payload for successful borrow mutations.
    """

    pass


class SimpleMessageResponse(BaseModel):
    """
    Normalized 200 response for borrow actions.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Borrowed")
    data: EmptyData = Field(default_factory=EmptyData)
    timestamp_ms: int = Field(..., example=1741348800000)


BORROW_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Borrowed",
    "data": {},
    "timestamp_ms": 1741348800000,
}

RETURN_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Returned",
    "data": {},
    "timestamp_ms": 1741348800000,
}

RENEW_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Renewed",
    "data": {},
    "timestamp_ms": 1741348800000,
}
