# apps/api/modules/queue/schemas.py
"""
Pydantic schemas for the Queue Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Define request validation models for queue actions.
- Define normalized 200 response envelopes.
- Enforce UUID validation for book identifiers.
"""

from uuid import UUID

from pydantic import BaseModel, Field


class JoinQueueRequest(BaseModel):
    """
    Request model for joining a book waiting queue.
    """

    book_id: UUID = Field(
        ...,
        example="550e8400-e29b-41d4-a716-446655440000",
    )


class CancelQueueRequest(BaseModel):
    """
    Request model for cancelling an active queue entry.
    """

    book_id: UUID = Field(
        ...,
        example="550e8400-e29b-41d4-a716-446655440000",
    )


class EmptyData(BaseModel):
    """
    Empty object payload for successful queue mutations.
    """

    pass


class SimpleMessageResponse(BaseModel):
    """
    Normalized 200 response for queue actions.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Joined queue")
    data: EmptyData = Field(default_factory=EmptyData)
    timestamp_ms: int = Field(..., example=1741348800000)


JOIN_QUEUE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Joined queue",
    "data": {},
    "timestamp_ms": 1741348800000,
}

CANCEL_QUEUE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Queue entry cancelled",
    "data": {},
    "timestamp_ms": 1741348800000,
}
