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

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
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
    SimpleMessageResponse,
)
from modules.documents.service import DocumentsService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/admin/documents", tags=["Documents"])


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

    if "Storage object missing" in message:
        return status.HTTP_409_CONFLICT

    if "Indexing failure" in message:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    return status.HTTP_500_INTERNAL_SERVER_ERROR


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
        }
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

    logger.info(
        "DOCUMENTS: upload url request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "filename": payload.filename,
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
                "filename": payload.filename,
                "error": str(exc),
                "status_code": http_status,
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
            "description": "Document indexed successfully",
            "content": {
                "application/json": {
                    "example": FINALIZE_DOCUMENT_SUCCESS_EXAMPLE
                }
            },
        }
    },
)
async def finalize_document(
    request: Request,
    document_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> FinalizeDocumentResponse:
    user_id = _require_user_id(request)

    logger.info(
        "DOCUMENTS: finalize request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "document_id": str(document_id),
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
                "document_id": str(document_id),
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return FinalizeDocumentResponse(
        status=200,
        message="Document indexed successfully",
        data=FinalizeDocumentData(
            document_id=result["document_id"],
            processing_status=result["processing_status"],
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
        }
    },
)
async def list_documents(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> DocumentsListResponse:
    user_id = _require_user_id(request)

    logger.info(
        "DOCUMENTS: list request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
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
                "error": str(exc),
                "status_code": http_status,
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
        }
    },
)
async def get_document(
    request: Request,
    document_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> DocumentDetailResponse:
    user_id = _require_user_id(request)

    logger.info(
        "DOCUMENTS: detail request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "document_id": str(document_id),
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
                "error": str(exc),
                "status_code": http_status,
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
        }
    },
)
async def delete_document(
    request: Request,
    document_id: UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> SimpleMessageResponse:
    user_id = _require_user_id(request)

    logger.info(
        "DOCUMENTS: delete request",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "user_id": user_id,
            "document_id": str(document_id),
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
                "error": str(exc),
                "status_code": http_status,
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
