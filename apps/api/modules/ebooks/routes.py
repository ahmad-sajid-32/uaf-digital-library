"""Authenticated staff and student E-Book routes."""

import time
from typing import Awaitable, Callable
from uuid import UUID

from fastapi import APIRouter, Body, File, Form, HTTPException, Query, Request, UploadFile, status

from core.rate_limit import RateLimitTier, enforce_rate_limit
from core.logging import get_logger
from modules.ebooks.schemas import ApiResponse, EBookAccessRequest, EBookUpdateRequest, EBookUploadRequest
from modules.ebooks.service import EBooksService

router = APIRouter(prefix="/api/ebooks", tags=["E-Books"])
admin_router = APIRouter(prefix="/api/admin/ebooks", tags=["E-Books Management"])
logger = get_logger(__name__)


def _user_id(request: Request) -> str:
    value = getattr(request.state, "user_id", None)
    if not value:
        raise HTTPException(status_code=401, detail="Authentication required")
    return value


def _status(message: str) -> int:
    if "Authentication required" in message or "Active user profile" in message:
        return status.HTTP_401_UNAUTHORIZED
    if "Insufficient privileges" in message or "access denied" in message:
        return status.HTTP_403_FORBIDDEN
    if "not found" in message:
        return status.HTTP_404_NOT_FOUND
    if "blocked" in message or "Only " in message or "incomplete" in message or "Ready " in message:
        return status.HTTP_409_CONFLICT
    if "size" in message or "exceeds" in message:
        return status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    if "invalid" in message.lower() or "unsupported" in message.lower():
        return status.HTTP_422_UNPROCESSABLE_ENTITY
    if "Stored object violates upload policy" in message:
        return status.HTTP_400_BAD_REQUEST
    if "Storage request failed" in message:
        return status.HTTP_502_BAD_GATEWAY
    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _run(request: Request, tier: RateLimitTier, operation: Callable[[], Awaitable[object]], message: str) -> ApiResponse:
    user_id = _user_id(request)
    await enforce_rate_limit(request=request, tier=tier, user_id=user_id)
    try:
        data = await operation()
    except RuntimeError as exc:
        code = _status(str(exc))
        logger.error(
            "EBOOKS: request failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "rate_limit_tier": tier,
                "status_code": code,
                "error": str(exc),
            },
        )
        raise HTTPException(code, str(exc) if code < 500 else "Internal Server Error") from exc
    return ApiResponse(status=200, message=message, data=data or {}, timestamp_ms=int(time.time() * 1000))


@admin_router.get("", response_model=ApiResponse)
async def staff_list(request: Request, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_staff_read", lambda: EBooksService.list_staff(user_id, limit, offset), "E-Books retrieved successfully")


@admin_router.get("/{ebook_id}", response_model=ApiResponse)
async def staff_detail(request: Request, ebook_id: UUID) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_staff_read", lambda: EBooksService.get_staff(user_id, ebook_id), "E-Book retrieved successfully")


@admin_router.post("/upload-url", response_model=ApiResponse)
async def upload_url(request: Request, payload: EBookUploadRequest = Body(...)) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_upload", lambda: EBooksService.create_upload_url(user_id, payload), "Signed upload URL generated successfully")


@admin_router.post("/{ebook_id}/finalize", response_model=ApiResponse)
async def finalize(request: Request, ebook_id: UUID) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_finalize", lambda: EBooksService.finalize(user_id, ebook_id), "E-Book file finalized successfully")


@admin_router.patch("/{ebook_id}", response_model=ApiResponse)
async def update(request: Request, ebook_id: UUID, payload: EBookUpdateRequest = Body(...)) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_mutation", lambda: EBooksService.update(user_id, ebook_id, payload), "E-Book updated successfully")


@admin_router.post("/{ebook_id}/publish", response_model=ApiResponse)
async def publish(request: Request, ebook_id: UUID) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_mutation", lambda: EBooksService.lifecycle(user_id, ebook_id, "publish"), "E-Book published successfully")


@admin_router.post("/{ebook_id}/archive", response_model=ApiResponse)
async def archive(request: Request, ebook_id: UUID) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_mutation", lambda: EBooksService.lifecycle(user_id, ebook_id, "archive"), "E-Book archived successfully")


@admin_router.delete("/{ebook_id}", response_model=ApiResponse)
async def delete(request: Request, ebook_id: UUID) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_mutation", lambda: EBooksService.delete(user_id, ebook_id), "E-Book deleted successfully")


@admin_router.post("/{ebook_id}/cover", response_model=ApiResponse)
async def set_cover(
    request: Request,
    ebook_id: UUID,
    file: UploadFile = File(...),
    alt_text: str | None = Form(default=None),
) -> ApiResponse:
    user_id = _user_id(request)

    async def operation() -> object:
        content = await file.read()
        mime_type = EBooksService.resolve_cover_mime_type(
            file.filename or "",
            file.content_type or "",
        )
        return await EBooksService.set_cover(
            user_id,
            ebook_id,
            content,
            mime_type,
            alt_text,
        )

    return await _run(request, "ebook_cover", operation, "E-Book cover updated successfully")


@admin_router.delete("/{ebook_id}/cover", response_model=ApiResponse)
async def clear_cover(request: Request, ebook_id: UUID) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_cover", lambda: EBooksService.clear_cover(user_id, ebook_id), "E-Book cover removed successfully")


@admin_router.post("/{ebook_id}/access-url", response_model=ApiResponse)
async def staff_access(request: Request, ebook_id: UUID, payload: EBookAccessRequest = Body(...)) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_access_url", lambda: EBooksService.access_url(user_id, ebook_id, payload.event_type), "E-Book access URL generated successfully")


@admin_router.get("/{ebook_id}/access-events", response_model=ApiResponse)
async def access_events(request: Request, ebook_id: UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_staff_read", lambda: EBooksService.events(user_id, ebook_id, limit, offset), "E-Book access activity retrieved successfully")


@router.get("", response_model=ApiResponse)
async def student_list(request: Request, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_student_read", lambda: EBooksService.list_student(user_id, limit, offset), "E-Books retrieved successfully")


@router.get("/{ebook_id}", response_model=ApiResponse)
async def student_detail(request: Request, ebook_id: UUID) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_student_read", lambda: EBooksService.get_student(user_id, ebook_id), "E-Book retrieved successfully")


@router.post("/{ebook_id}/access-url", response_model=ApiResponse)
async def student_access(request: Request, ebook_id: UUID, payload: EBookAccessRequest = Body(...)) -> ApiResponse:
    user_id = _user_id(request)
    return await _run(request, "ebook_access_url", lambda: EBooksService.access_url(user_id, ebook_id, payload.event_type), "E-Book access URL generated successfully")
