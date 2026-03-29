# apps/api/modules/documents/routes.py
"""
Routes for the Documents Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose admin/librarian document management APIs.
- Keep file storage, extraction, and indexing logic out of route handlers.
- Map deterministic service failures to HTTP responses.
"""

import time
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import RateLimitTier, enforce_rate_limit, hash_sensitive_value
from modules.documents.schemas import (
    CREATE_UPLOAD_URL_REQUEST_EXAMPLE,
    CREATE_UPLOAD_URL_SUCCESS_EXAMPLE,
    CreateUploadUrlRequest,
    CreateUploadUrlResponse,
    DELETE_DOCUMENT_SUCCESS_EXAMPLE,
    DOCUMENT_DETAIL_SUCCESS_EXAMPLE,
    DOCUMENTS_LIST_SUCCESS_EXAMPLE,
    DocumentDetailData,
    DocumentDetailResponse,
    DocumentsListData,
    DocumentsListResponse,
    EmptyData,
    FINALIZE_DOCUMENT_SUCCESS_EXAMPLE,
    FinalizeDocumentData,
    FinalizeDocumentResponse,
    ReadUrlDisposition,
    SIGNED_READ_URL_SUCCESS_EXAMPLE,
    SignedReadUrlData,
    SignedReadUrlResponse,
    SimpleMessageResponse,
)
from modules.documents.service import DocumentsService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin/documents", tags=["Documents"])

UPLOAD_URL_ERROR_RESPONSES = {
    400: {"description": "Invalid upload request or unsupported file type"},
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    413: {"description": "File exceeds upload size limit"},
    422: {"description": "Request validation failed"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

FINALIZE_ERROR_RESPONSES = {
    400: {"description": "Stored object violates upload policy"},
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Document not found"},
    409: {
        "description": (
            "Stored upload object is missing, the upload intent expired, or the document is already processing"
        )
    },
    413: {"description": "Stored object exceeds upload size policy"},
    422: {"description": "Request validation failed"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

LIST_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

DETAIL_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Document not found"},
    422: {"description": "Request validation failed"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

DELETE_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Document not found"},
    422: {"description": "Request validation failed"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

READ_URL_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Document not found"},
    422: {"description": "Request validation failed"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user_id


def _resolve_runtime_error_status(message: str) -> int:
    if "Authentication required" in message:
        return status.HTTP_401_UNAUTHORIZED

    if "Insufficient privileges" in message:
        return status.HTTP_403_FORBIDDEN

    if "Document not found" in message:
        return status.HTTP_404_NOT_FOUND

    if "Unsupported file type" in message or "Invalid input" in message:
        return status.HTTP_400_BAD_REQUEST

    if "Stored object violates upload policy" in message:
        return status.HTTP_400_BAD_REQUEST

    if "File exceeds upload size limit" in message:
        return status.HTTP_413_REQUEST_ENTITY_TOO_LARGE

    if "Storage object missing" in message:
        return status.HTTP_409_CONFLICT

    if "Upload expired; re-upload required" in message:
        return status.HTTP_409_CONFLICT

    if "Document is already processing" in message:
        return status.HTTP_409_CONFLICT

    if "Indexing failure" in message:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _enforce_document_rate_limit(
    request: Request,
    *,
    user_id: str,
    tier: RateLimitTier,
    subject_hint: str | None = None,
) -> None:
    """
    Apply authenticated document-surface throttling by sensitivity tier.
    """

    await enforce_rate_limit(
        request=request,
        tier=tier,
        user_id=user_id,
        subject_hint=subject_hint,
    )


@router.post(
    "/upload-url",
    response_model=CreateUploadUrlResponse,
    responses={
        200: {
            "description": "Signed upload URL generated successfully",
            "content": {
                "application/json": {
                    "example": CREATE_UPLOAD_URL_SUCCESS_EXAMPLE
                }
            },
        },
        **UPLOAD_URL_ERROR_RESPONSES,
    },
)
async def create_upload_url(
    request: Request,
    payload: CreateUploadUrlRequest = Body(
        ...,
        openapi_examples={
            "default": {
                "summary": "Official university document upload",
                "value": CREATE_UPLOAD_URL_REQUEST_EXAMPLE,
            }
        },
    ),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CreateUploadUrlResponse:
    user_id = _require_user_id(request)
    rate_limit_tier = "document_upload"

    await _enforce_document_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=payload.filename,
    )

    logger.info(
        "DOCUMENTS: upload url request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "filename_hash": hash_sensitive_value(payload.filename),
            "outcome": "request",
        },
    )

    try:
        data = await DocumentsService.create_upload_url(user_id, payload)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "DOCUMENTS: upload url failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "rate_limit_tier": rate_limit_tier,
                "filename_hash": hash_sensitive_value(payload.filename),
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return CreateUploadUrlResponse(
        status=200,
        message="Signed upload URL generated successfully",
        data=data,
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/{document_id}/finalize",
    response_model=FinalizeDocumentResponse,
    responses={
        200: {
            "description": "Document finalized successfully",
            "content": {
                "application/json": {
                    "example": FINALIZE_DOCUMENT_SUCCESS_EXAMPLE
                }
            },
        },
        **FINALIZE_ERROR_RESPONSES,
    },
)
async def finalize_document(
    request: Request,
    document_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> FinalizeDocumentResponse:
    user_id = _require_user_id(request)
    rate_limit_tier = "document_finalize"

    await _enforce_document_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(document_id),
    )

    logger.info(
        "DOCUMENTS: finalize request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "document_id": str(document_id),
            "outcome": "request",
        },
    )

    try:
        result = await DocumentsService.finalize_document(user_id, document_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "DOCUMENTS: finalize failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "rate_limit_tier": rate_limit_tier,
                "document_id": str(document_id),
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return FinalizeDocumentResponse(
        status=200,
        message=result["message"],
        data=FinalizeDocumentData(
            document_id=result["document_id"],
            processing_status=result["processing_status"],
            is_upload_stale=result["is_upload_stale"],
            can_finalize=result["can_finalize"],
            can_retry_finalize=result["can_retry_finalize"],
            requires_reupload=result["requires_reupload"],
        ),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "",
    response_model=DocumentsListResponse,
    responses={
        200: {
            "description": "Documents retrieved successfully",
            "content": {
                "application/json": {
                    "example": DOCUMENTS_LIST_SUCCESS_EXAMPLE
                }
            },
        },
        **LIST_ERROR_RESPONSES,
    },
)
async def list_documents(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> DocumentsListResponse:
    user_id = _require_user_id(request)
    rate_limit_tier = "document_read"

    await _enforce_document_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
    )

    logger.info(
        "DOCUMENTS: list request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        items = await DocumentsService.list_documents(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "DOCUMENTS: list failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return DocumentsListResponse(
        status=200,
        message="Documents retrieved successfully",
        data=DocumentsListData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/{document_id}/read-url",
    response_model=SignedReadUrlResponse,
    responses={
        200: {
            "description": "Signed read URL generated successfully",
            "content": {
                "application/json": {
                    "example": SIGNED_READ_URL_SUCCESS_EXAMPLE
                }
            },
        },
        **READ_URL_ERROR_RESPONSES,
    },
)
async def get_document_read_url(
    request: Request,
    document_id: UUID,
    disposition: ReadUrlDisposition = Query(
        default="inline",
        description="Whether the signed URL should open inline or force download.",
    ),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SignedReadUrlResponse:
    user_id = _require_user_id(request)
    rate_limit_tier = "document_read"

    await _enforce_document_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(document_id),
    )

    logger.info(
        "DOCUMENTS: read url request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "document_id": str(document_id),
            "disposition": disposition,
            "outcome": "request",
        },
    )

    try:
        result = await DocumentsService.create_signed_read_url(
            user_id,
            document_id,
            disposition=disposition,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "DOCUMENTS: read url failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "rate_limit_tier": rate_limit_tier,
                "document_id": str(document_id),
                "disposition": disposition,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return SignedReadUrlResponse(
        status=200,
        message="Signed read URL generated successfully",
        data=SignedReadUrlData(
            document_id=result["document_id"],
            signed_read_url=result["signed_read_url"],
            expires_in_seconds=result["expires_in_seconds"],
            disposition=result["disposition"],
        ),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
    responses={
        200: {
            "description": "Document retrieved successfully",
            "content": {
                "application/json": {
                    "example": DOCUMENT_DETAIL_SUCCESS_EXAMPLE
                }
            },
        },
        **DETAIL_ERROR_RESPONSES,
    },
)
async def get_document(
    request: Request,
    document_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> DocumentDetailResponse:
    user_id = _require_user_id(request)
    rate_limit_tier = "document_read"

    await _enforce_document_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(document_id),
    )

    logger.info(
        "DOCUMENTS: detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "document_id": str(document_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        item = await DocumentsService.get_document(user_id, document_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "DOCUMENTS: detail failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "document_id": str(document_id),
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return DocumentDetailResponse(
        status=200,
        message="Document retrieved successfully",
        data=DocumentDetailData(item=item),
        timestamp_ms=int(time.time() * 1000),
    )


@router.delete(
    "/{document_id}",
    response_model=SimpleMessageResponse,
    responses={
        200: {
            "description": "Document deleted successfully",
            "content": {
                "application/json": {
                    "example": DELETE_DOCUMENT_SUCCESS_EXAMPLE
                }
            },
        },
        **DELETE_ERROR_RESPONSES,
    },
)
async def delete_document(
    request: Request,
    document_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)
    rate_limit_tier = "document_delete"

    await _enforce_document_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(document_id),
    )

    logger.info(
        "DOCUMENTS: delete request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "document_id": str(document_id),
            "rate_limit_tier": rate_limit_tier,
            "outcome": "request",
        },
    )

    try:
        await DocumentsService.delete_document(user_id, document_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "DOCUMENTS: delete failed",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "user_id": user_id,
                "document_id": str(document_id),
                "rate_limit_tier": rate_limit_tier,
                "error": str(exc),
                "status_code": http_status,
                "outcome": "failed",
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return SimpleMessageResponse(
        status=200,
        message="Document deleted successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
