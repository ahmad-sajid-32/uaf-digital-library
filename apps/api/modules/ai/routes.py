# apps/api/modules/ai/routes.py
"""
Routes for the AI Module of the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Expose authenticated retrieval and grounded-answer APIs over the shared university corpus.
- Keep embedding, pgvector search, and generation logic out of route handlers.
- Map deterministic service failures to HTTP responses.
"""

import time

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.logging import get_logger
from core.rate_limit import RateLimitTier, enforce_rate_limit
from modules.ai.schemas import (
    AI_QUERY_FALLBACK_EXAMPLE,
    AI_QUERY_REQUEST_EXAMPLE,
    AI_QUERY_SUCCESS_EXAMPLE,
    AIQueryRequest,
    AIQueryResponse,
    RETRIEVAL_SEARCH_REQUEST_EXAMPLE,
    RETRIEVAL_SEARCH_SUCCESS_EXAMPLE,
    RetrievalSearchRequest,
    RetrievalSearchResponse,
)
from modules.ai.service import AIService

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/ai", tags=["AI"])


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

    if "Invalid input" in message:
        return status.HTTP_400_BAD_REQUEST

    if "Embedding generation failed" in message:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    if "Retrieval RPC failed" in message:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    if "Generation failed" in message:
        return status.HTTP_500_INTERNAL_SERVER_ERROR

    return status.HTTP_500_INTERNAL_SERVER_ERROR


async def _enforce_ai_rate_limit(
    request: Request,
    *,
    user_id: str,
    tier: RateLimitTier,
) -> None:
    """
    Apply authenticated AI throttling using the configured route sensitivity tier.
    """

    await enforce_rate_limit(
        request=request,
        tier=tier,
        user_id=user_id,
    )


@router.post(
    "/retrieval/search",
    response_model=RetrievalSearchResponse,
    responses={
        200: {
            "description": "Document retrieval completed successfully",
            "content": {
                "application/json": {
                    "example": RETRIEVAL_SEARCH_SUCCESS_EXAMPLE
                }
            },
        },
        429: {"description": "Too Many Requests"},
    },
)
async def search_retrieval_corpus(
    request: Request,
    payload: RetrievalSearchRequest = Body(
        ...,
        openapi_examples={
            "default": {
                "summary": "Shared university corpus retrieval",
                "value": RETRIEVAL_SEARCH_REQUEST_EXAMPLE,
            }
        },
    ),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> RetrievalSearchResponse:
    user_id = _require_user_id(request)
    request_id = getattr(request.state, "request_id", None)
    started_at = time.perf_counter()
    rate_limit_tier = "ai_retrieval"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
    )

    logger.info(
        "AI: retrieval request started",
        extra={
            "request_id": request_id,
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "query_length": len(payload.query),
            "top_k": payload.top_k,
            "similarity_threshold": payload.similarity_threshold,
            "document_type": payload.document_type,
            "audience_scope": payload.audience_scope,
            "department": payload.department,
        },
    )

    try:
        data = await AIService.search_document_corpus(
            user_id=user_id,
            request_id=request_id,
            payload=payload,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AI: retrieval failure",
            extra={
                "request_id": request_id,
                "route": request.url.path,
                "user_id": user_id,
                "rate_limit_tier": rate_limit_tier,
                "query_length": len(payload.query),
                "top_k": payload.top_k,
                "similarity_threshold": payload.similarity_threshold,
                "document_type": payload.document_type,
                "audience_scope": payload.audience_scope,
                "department": payload.department,
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    latency_ms = int((time.perf_counter() - started_at) * 1000)

    logger.info(
        "AI: retrieval request completed",
        extra={
            "request_id": request_id,
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "query_length": len(data["query"]),
            "top_k": data["applied_top_k"],
            "similarity_threshold": data["applied_similarity_threshold"],
            "document_type": payload.document_type,
            "audience_scope": payload.audience_scope,
            "department": payload.department,
            "matches_returned": len(data["items"]),
            "latency_ms": latency_ms,
            "status_code": 200,
        },
    )

    return RetrievalSearchResponse(
        status=200,
        message="Document retrieval completed successfully",
        data=data,
        timestamp_ms=int(time.time() * 1000),
    )


@router.post(
    "/query",
    response_model=AIQueryResponse,
    responses={
        200: {
            "description": "Grounded answer generated successfully",
            "content": {
                "application/json": {
                    "examples": {
                        "grounded_answer": {"value": AI_QUERY_SUCCESS_EXAMPLE},
                        "fallback": {"value": AI_QUERY_FALLBACK_EXAMPLE},
                    }
                }
            },
        },
        429: {"description": "Too Many Requests"},
    },
)
async def query_grounded_answer(
    request: Request,
    payload: AIQueryRequest = Body(
        ...,
        openapi_examples={
            "default": {
                "summary": "Grounded answer generation request",
                "value": AI_QUERY_REQUEST_EXAMPLE,
            }
        },
    ),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AIQueryResponse:
    user_id = _require_user_id(request)
    request_id = getattr(request.state, "request_id", None)
    started_at = time.perf_counter()
    rate_limit_tier = "ai_generation"

    await _enforce_ai_rate_limit(
        request,
        user_id=user_id,
        tier=rate_limit_tier,
    )

    logger.info(
        "AI: answer request started",
        extra={
            "request_id": request_id,
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "query_length": len(payload.query),
            "top_k": payload.top_k,
            "similarity_threshold": payload.similarity_threshold,
            "document_type": payload.document_type,
            "audience_scope": payload.audience_scope,
            "department": payload.department,
        },
    )

    try:
        data = await AIService.generate_grounded_answer(
            user_id=user_id,
            request_id=request_id,
            payload=payload,
        )
    except RuntimeError as exc:
        http_status = _resolve_runtime_error_status(str(exc))
        logger.error(
            "AI: answer request failed",
            extra={
                "request_id": request_id,
                "route": request.url.path,
                "user_id": user_id,
                "rate_limit_tier": rate_limit_tier,
                "query_length": len(payload.query),
                "top_k": payload.top_k,
                "similarity_threshold": payload.similarity_threshold,
                "document_type": payload.document_type,
                "audience_scope": payload.audience_scope,
                "department": payload.department,
                "error": str(exc),
                "status_code": http_status,
            },
        )
        raise HTTPException(
            status_code=http_status,
            detail=str(exc) if http_status != 500 else "Internal Server Error",
        ) from exc

    latency_ms = int((time.perf_counter() - started_at) * 1000)

    logger.info(
        "AI: answer request completed",
        extra={
            "request_id": request_id,
            "route": request.url.path,
            "user_id": user_id,
            "rate_limit_tier": rate_limit_tier,
            "query_length": len(data["query"]),
            "top_k": data["applied_top_k"],
            "similarity_threshold": data["applied_similarity_threshold"],
            "document_type": payload.document_type,
            "audience_scope": payload.audience_scope,
            "department": payload.department,
            "retrieved_chunks_count": data["retrieved_chunks_count"],
            "fallback_used": data["fallback_used"],
            "latency_ms": latency_ms,
            "status_code": 200,
        },
    )

    return AIQueryResponse(
        status=200,
        message="Grounded answer generated successfully",
        data=data,
        timestamp_ms=int(time.time() * 1000),
    )
