# apps/api/modules/fines/schemas.py
"""
Pydantic schemas for the Fines Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Validate fine-settlement request payloads.
- Define normalized success envelopes for fine settlement endpoints.
- Keep API serialization separate from settlement business logic.
"""

from typing import Optional

from pydantic import BaseModel, Field


class WaiveFineRequest(BaseModel):
    """
    Request payload for waiving a pending fine.
    """

    reason: Optional[str] = Field(
        default=None,
        max_length=300,
        example="Late return waived due to verified system outage.",
    )


class EmptyData(BaseModel):
    """
    Empty object payload for successful fine settlement mutations.
    """

    pass


class SimpleMessageResponse(BaseModel):
    """
    Normalized 200 response for successful fine settlement operations.
    """

    status: int = Field(..., example=200)
    message: str = Field(..., example="Fine marked as paid")
    data: EmptyData = Field(default_factory=EmptyData)
    timestamp_ms: int = Field(..., example=1741348800000)


PAY_FINE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Fine marked as paid",
    "data": {},
    "timestamp_ms": 1741348800000,
}


WAIVE_FINE_SUCCESS_EXAMPLE = {
    "status": 200,
    "message": "Fine waived",
    "data": {},
    "timestamp_ms": 1741348800000,
}
