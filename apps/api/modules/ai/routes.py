"""
Routes for the AI assistant module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose the shared assistant contract through persisted conversation APIs.
- Keep generation, retrieval, and persistence orchestration out of route handlers.
- Preserve one stable router export for existing app wiring.
"""

import time
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.rate_limit import RateLimitTier, enforce_rate_limit
from modules.ai.assistant_service import AssistantService
from modules.ai.schemas import (
    ASSISTANT_CREATE_CONVERSATION_REQUEST_EXAMPLE,
    ASSISTANT_CREATE_CONVERSATION_SUCCESS_EXAMPLE,
    ASSISTANT_GET_MESSAGES_SUCCESS_EXAMPLE,
    ASSISTANT_LIST_CONVERSATIONS_SUCCESS_EXAMPLE,
    ASSISTANT_RENAME_CONVERSATION_REQUEST_EXAMPLE,
    AssistantAskRequest,
    AssistantConversationData,
    AssistantConversationListData,
    AssistantConversationListResponse,
    AssistantConversationMessagesData,
    AssistantConversationMessagesResponse,
    AssistantConversationResponse,
    AssistantDeleteConversationResponse,
    AssistantRenameConversationRequest,
    AssistantTurnData,
    AssistantTurnResponse,
    EmptyData,
)

bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])
assistant_router = router

ASSISTANT_LIST_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    429: {"description": "Too Many Requests"},
    500: {"description": "Internal Server Error"},
}

ASSISTANT_ITEM_ERROR_RESPONSES = {
    401: {"description": "Authentication required"},
    403: {"description": "Insufficient privileges"},
    404: {"description": "Conversation not found"},
    422: {"description": "Validation Error"},
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
    normalized = message.lower()

    if "authentication required" in normalized:
        return status.HTTP_401_UNAUTHORIZED

    if "insufficient privileges" in normalized:
        return status.HTTP_403_FORBIDDEN

    if "conversation not found" in normalized:
        return status.HTTP_404_NOT_FOUND

    if "invalid input" in normalized or "title is required" in normalized or "title is too long" in normalized:
        return status.HTTP_422_UNPROCESSABLE_ENTITY

    if "embedding generation failed" in normalized:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    if "retrieval rpc failed" in normalized:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    if "generation failed" in normalized:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _enforce_ai_rate_limit(
    request: Request,
    *,
    user_id: str,
    tier: RateLimitTier,
    subject_hint: str | None = None,
) -> None:
    await enforce_rate_limit(
        request=request,
        tier=tier,
        user_id=user_id,
        subject_hint=subject_hint,
    )


@router.get(
    "/conversations",
    response_model=AssistantConversationListResponse,
    responses={
        200: {
            "description": "Assistant conversations retrieved successfully",
            "content": {
                "application/json": {
                    "example": ASSISTANT_LIST_CONVERSATIONS_SUCCESS_EXAMPLE,
                }
            },
        },
        **ASSISTANT_LIST_ERROR_RESPONSES,
    },
)
async def list_assistant_conversations(
    request: Request,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AssistantConversationListResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "ai_conversation_read"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
    )

    try:
        items = await AssistantService.list_conversations(user_id)
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AssistantConversationListResponse(
        status=200,
        message="Assistant conversations retrieved successfully",
        data=AssistantConversationListData(items=items),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/conversations",
    response_model=AssistantTurnResponse,
    responses={
        200: {
            "description": "Assistant turn completed successfully",
            "content": {
                "application/json": {
                    "example": ASSISTANT_CREATE_CONVERSATION_SUCCESS_EXAMPLE,
                }
            },
        },
        **ASSISTANT_ITEM_ERROR_RESPONSES,
    },
)
async def create_assistant_conversation(
    request: Request,
    payload: AssistantAskRequest = Body(
        ...,
        openapi_examples={
            "default": {
                "summary": "Create conversation with the first assistant query",
                "value": ASSISTANT_CREATE_CONVERSATION_REQUEST_EXAMPLE,
            }
        },
    ),
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AssistantTurnResponse:
    user_id = _require_user_id(request)
    request_id = getattr(request.state, "request_id", None)
    rate_limit_tier: RateLimitTier = "ai_generation"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=payload.query,
    )

    try:
        result = await AssistantService.create_conversation_turn(
            user_id=user_id,
            request_id=request_id,
            query=payload.query,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AssistantTurnResponse(
        status=200,
        message="Assistant turn completed successfully",
        data=AssistantTurnData(**result),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=AssistantConversationResponse,
    responses={
        200: {
            "description": "Assistant conversation retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "status": 200,
                        "message": "Assistant conversation retrieved successfully",
                        "data": {
                            "conversation": ASSISTANT_CREATE_CONVERSATION_SUCCESS_EXAMPLE[
                                "data"
                            ]["conversation"],
                        },
                        "timestamp_ms": 1775385000000,
                    },
                }
            },
        },
        **ASSISTANT_ITEM_ERROR_RESPONSES,
    },
)
async def get_assistant_conversation(
    request: Request,
    conversation_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AssistantConversationResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "ai_conversation_read"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(conversation_id),
    )

    try:
        conversation = await AssistantService.get_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AssistantConversationResponse(
        status=200,
        message="Assistant conversation retrieved successfully",
        data=AssistantConversationData(conversation=conversation),
        timestamp_ms=int(time.time() * 1000),
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=AssistantConversationMessagesResponse,
    responses={
        200: {
            "description": "Assistant messages retrieved successfully",
            "content": {
                "application/json": {
                    "example": ASSISTANT_GET_MESSAGES_SUCCESS_EXAMPLE,
                }
            },
        },
        **ASSISTANT_ITEM_ERROR_RESPONSES,
    },
)
async def get_assistant_messages(
    request: Request,
    conversation_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AssistantConversationMessagesResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "ai_conversation_read"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(conversation_id),
    )

    try:
        items = await AssistantService.get_messages(
            user_id=user_id,
            conversation_id=conversation_id,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AssistantConversationMessagesResponse(
        status=200,
        message="Assistant messages retrieved successfully",
        data=AssistantConversationMessagesData(
            conversation_id=conversation_id,
            items=items,
        ),
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=AssistantTurnResponse,
    responses={
        200: {
            "description": "Assistant turn completed successfully",
            "content": {
                "application/json": {
                    "example": ASSISTANT_CREATE_CONVERSATION_SUCCESS_EXAMPLE,
                }
            },
        },
        **ASSISTANT_ITEM_ERROR_RESPONSES,
    },
)
async def append_assistant_message(
    request: Request,
    conversation_id: UUID,
    payload: AssistantAskRequest = Body(
        ...,
        openapi_examples={
            "default": {
                "summary": "Append one query to an existing assistant conversation",
                "value": ASSISTANT_CREATE_CONVERSATION_REQUEST_EXAMPLE,
            }
        },
    ),
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AssistantTurnResponse:
    user_id = _require_user_id(request)
    request_id = getattr(request.state, "request_id", None)
    rate_limit_tier: RateLimitTier = "ai_generation"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=f"{conversation_id}:{payload.query}",
    )

    try:
        result = await AssistantService.append_conversation_turn(
            user_id=user_id,
            request_id=request_id,
            conversation_id=conversation_id,
            query=payload.query,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AssistantTurnResponse(
        status=200,
        message="Assistant turn completed successfully",
        data=AssistantTurnData(**result),
        timestamp_ms=int(time.time() * 1000),
    )


@router.patch(
    "/conversations/{conversation_id}",
    response_model=AssistantConversationResponse,
    responses={
        200: {
            "description": "Assistant conversation renamed successfully",
            "content": {
                "application/json": {
                    "example": {
                        "status": 200,
                        "message": "Assistant conversation renamed successfully",
                        "data": {
                            "conversation": ASSISTANT_CREATE_CONVERSATION_SUCCESS_EXAMPLE[
                                "data"
                            ]["conversation"],
                        },
                        "timestamp_ms": 1775385000000,
                    },
                }
            },
        },
        **ASSISTANT_ITEM_ERROR_RESPONSES,
    },
)
async def rename_assistant_conversation(
    request: Request,
    conversation_id: UUID,
    payload: AssistantRenameConversationRequest = Body(
        ...,
        openapi_examples={
            "default": {
                "summary": "Rename an existing assistant conversation",
                "value": ASSISTANT_RENAME_CONVERSATION_REQUEST_EXAMPLE,
            }
        },
    ),
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AssistantConversationResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "ai_conversation_write"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(conversation_id),
    )

    try:
        conversation = await AssistantService.rename_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
            title=payload.title,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AssistantConversationResponse(
        status=200,
        message="Assistant conversation renamed successfully",
        data=AssistantConversationData(conversation=conversation),
        timestamp_ms=int(time.time() * 1000),
    )


@router.delete(
    "/conversations/{conversation_id}",
    response_model=AssistantDeleteConversationResponse,
    responses={
        200: {
            "description": "Assistant conversation deleted successfully",
        },
        **ASSISTANT_ITEM_ERROR_RESPONSES,
    },
)
async def delete_assistant_conversation(
    request: Request,
    conversation_id: UUID,
    _credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AssistantDeleteConversationResponse:
    user_id = _require_user_id(request)
    rate_limit_tier: RateLimitTier = "ai_conversation_write"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
        subject_hint=str(conversation_id),
    )

    try:
        await AssistantService.delete_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    return AssistantDeleteConversationResponse(
        status=200,
        message="Assistant conversation deleted successfully",
        data=EmptyData(),
        timestamp_ms=int(time.time() * 1000),
    )
