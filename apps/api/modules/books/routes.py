# apps/api/modules/books/routes.py
"""
Books Module - Routes

Responsibilities:
- Expose HTTP endpoint for public catalog listing.
- Validate query parameters.
- Call service layer only.
- Return structured response model.
- Provide explicit Swagger documentation (200 example only).

Architectural Constraints:
- No business logic.
- No raw SQL.
- No direct database interaction.
- All DB operations go through BooksService → RPC.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Query, Request, status

from core.logging import get_logger
from modules.books.schemas import (
    BooksListResponse,
    BOOKS_LIST_SUCCESS_EXAMPLE,
)
from modules.books.service import BooksService

logger = get_logger(__name__)

router = APIRouter(
    prefix="/api/books",
    tags=["Books"],
)


@router.get(
    "",
    response_model=BooksListResponse,
    status_code=status.HTTP_200_OK,
    responses={
        200: {
            "description": "Public catalog retrieved successfully",
            "content": {
                "application/json": {
                    "example": BOOKS_LIST_SUCCESS_EXAMPLE
                }
            },
        },
        400: {"description": "Invalid request parameters"},
        500: {"description": "Internal server error"},
    },
)
async def get_public_books(
    request: Request,
    cursor_created_at: Optional[datetime] = Query(
        None,
        description="Composite cursor timestamp for pagination.",
    ),
    cursor_id: Optional[UUID] = Query(
        None,
        description="Composite cursor UUID for pagination.",
    ),
    limit: int = Query(
        20,
        ge=1,
        le=100,
        description="Number of records to fetch (max 100).",
    ),
) -> BooksListResponse:
    """
    Public Catalog Endpoint.

    Returns a cursor-based paginated list of books.

    Query Parameters:
        cursor_created_at (optional):
            Timestamp pointer from previous page.
        cursor_id (optional):
            UUID pointer from previous page.
        limit:
            Number of items to retrieve (1–100).

    Authentication:
        Public endpoint (no JWT required).

    Returns:
        BooksListResponse
    """

    logger.info(
        "BOOKS: GET /api/books",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "cursor_created_at": str(cursor_created_at),
            "cursor_id": str(cursor_id),
            "limit": limit,
        },
    )

    result = await BooksService.get_public_catalog(
        cursor_created_at=cursor_created_at,
        cursor_id=cursor_id,
        limit=limit,
        user_id=getattr(request.state, "user_id", None),
        role=getattr(request.state, "role", None),
    )

    return BooksListResponse(**result)