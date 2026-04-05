# apps/api/core/rate_limit.py
"""
Shared rate-limit foundation for the UAF Smart E-Library backend.

Purpose:
- Define route sensitivity tiers and typed rate-limit policy resolution.
- Build proxy-aware client fingerprints for abuse controls.
- Enforce PostgreSQL-backed request ceilings across shared route tiers.
- Provide a stable JSON response envelope for rate-limit violations.
"""

import hashlib
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import asyncpg
from fastapi import Request
from fastapi.responses import JSONResponse

from core.config import settings
from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)


RateLimitTier = Literal[
    "auth_public",
    "admin_auth",
    "book_public_detail",
    "book_queue_read",
    "book_staff_read",
    "book_mutation",
    "circulation_read",
    "circulation_mutation",
    "fine_read",
    "fine_settlement",
    "ai_conversation_read",
    "ai_conversation_write",
    "ai_retrieval",
    "ai_generation",
    "document_upload",
    "document_finalize",
    "document_read",
    "document_delete",
]


@dataclass(frozen=True)
class RateLimitPolicy:
    """
    Typed rate-limit policy for a route sensitivity tier.
    """

    tier: RateLimitTier
    max_requests: int
    window_seconds: int


@dataclass(frozen=True)
class RequestFingerprint:
    """
    Shared request identity metadata for future throttling and abuse logging.
    """

    client_ip: str
    fingerprint: str
    user_agent: str
    route: str
    method: str
    user_id: Optional[str]


class RateLimitExceededError(Exception):
    """
    Raised when a request exceeds the configured rate-limit policy.
    """

    def __init__(
        self,
        *,
        tier: RateLimitTier,
        retry_after_seconds: int,
        message: str = "Too Many Requests",
    ) -> None:
        super().__init__(message)
        self.tier = tier
        self.retry_after_seconds = retry_after_seconds
        self.message = message


def get_rate_limit_policy(tier: RateLimitTier) -> RateLimitPolicy:
    """
    Resolve a typed rate-limit policy from settings.
    """

    policy_map: dict[RateLimitTier, RateLimitPolicy] = {
        "auth_public": RateLimitPolicy(
            tier="auth_public",
            max_requests=settings.auth_public_rate_limit_max_requests,
            window_seconds=settings.auth_public_rate_limit_window_seconds,
        ),
        "admin_auth": RateLimitPolicy(
            tier="admin_auth",
            max_requests=settings.admin_auth_rate_limit_max_requests,
            window_seconds=settings.admin_auth_rate_limit_window_seconds,
        ),
        "book_public_detail": RateLimitPolicy(
            tier="book_public_detail",
            max_requests=settings.book_public_detail_rate_limit_max_requests,
            window_seconds=settings.book_public_detail_rate_limit_window_seconds,
        ),
        "book_queue_read": RateLimitPolicy(
            tier="book_queue_read",
            max_requests=settings.book_queue_read_rate_limit_max_requests,
            window_seconds=settings.book_queue_read_rate_limit_window_seconds,
        ),
        "book_staff_read": RateLimitPolicy(
            tier="book_staff_read",
            max_requests=settings.book_staff_read_rate_limit_max_requests,
            window_seconds=settings.book_staff_read_rate_limit_window_seconds,
        ),
        "book_mutation": RateLimitPolicy(
            tier="book_mutation",
            max_requests=settings.book_mutation_rate_limit_max_requests,
            window_seconds=settings.book_mutation_rate_limit_window_seconds,
        ),
        "circulation_read": RateLimitPolicy(
            tier="circulation_read",
            max_requests=settings.circulation_read_rate_limit_max_requests,
            window_seconds=settings.circulation_read_rate_limit_window_seconds,
        ),
        "circulation_mutation": RateLimitPolicy(
            tier="circulation_mutation",
            max_requests=settings.circulation_mutation_rate_limit_max_requests,
            window_seconds=settings.circulation_mutation_rate_limit_window_seconds,
        ),
        "fine_read": RateLimitPolicy(
            tier="fine_read",
            max_requests=settings.fine_read_rate_limit_max_requests,
            window_seconds=settings.fine_read_rate_limit_window_seconds,
        ),
        "fine_settlement": RateLimitPolicy(
            tier="fine_settlement",
            max_requests=settings.fine_settlement_rate_limit_max_requests,
            window_seconds=settings.fine_settlement_rate_limit_window_seconds,
        ),
        "ai_conversation_read": RateLimitPolicy(
            tier="ai_conversation_read",
            max_requests=settings.ai_conversation_read_rate_limit_max_requests,
            window_seconds=settings.ai_conversation_read_rate_limit_window_seconds,
        ),
        "ai_conversation_write": RateLimitPolicy(
            tier="ai_conversation_write",
            max_requests=settings.ai_conversation_write_rate_limit_max_requests,
            window_seconds=settings.ai_conversation_write_rate_limit_window_seconds,
        ),
        "ai_retrieval": RateLimitPolicy(
            tier="ai_retrieval",
            max_requests=settings.ai_retrieval_rate_limit_max_requests,
            window_seconds=settings.ai_retrieval_rate_limit_window_seconds,
        ),
        "ai_generation": RateLimitPolicy(
            tier="ai_generation",
            max_requests=settings.ai_generation_rate_limit_max_requests,
            window_seconds=settings.ai_generation_rate_limit_window_seconds,
        ),
        "document_upload": RateLimitPolicy(
            tier="document_upload",
            max_requests=settings.document_upload_rate_limit_max_requests,
            window_seconds=settings.document_upload_rate_limit_window_seconds,
        ),
        "document_finalize": RateLimitPolicy(
            tier="document_finalize",
            max_requests=settings.document_finalize_rate_limit_max_requests,
            window_seconds=settings.document_finalize_rate_limit_window_seconds,
        ),
        "document_read": RateLimitPolicy(
            tier="document_read",
            max_requests=settings.document_read_rate_limit_max_requests,
            window_seconds=settings.document_read_rate_limit_window_seconds,
        ),
        "document_delete": RateLimitPolicy(
            tier="document_delete",
            max_requests=settings.document_delete_rate_limit_max_requests,
            window_seconds=settings.document_delete_rate_limit_window_seconds,
        ),
    }

    return policy_map[tier]


def resolve_client_ip(request: Request) -> str:
    """
    Resolve client IP using only configured trusted proxy headers.
    """

    for header_name in settings.trusted_client_ip_headers:
        raw_value = request.headers.get(header_name)

        if not raw_value:
            continue

        candidate = raw_value.split(",")[0].strip()

        if candidate:
            return candidate

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def build_request_fingerprint(
    request: Request,
    user_id: Optional[str] = None,
) -> RequestFingerprint:
    """
    Build a stable request fingerprint for future rate limiting and logging.
    """

    client_ip = resolve_client_ip(request)
    user_agent = request.headers.get("user-agent", "").strip() or "unknown"
    base_identity = "|".join(
        [
            client_ip,
            user_id or "anonymous",
            request.method.upper(),
            request.url.path,
            user_agent,
        ]
    )
    fingerprint = hashlib.sha256(base_identity.encode("utf-8")).hexdigest()[:24]

    return RequestFingerprint(
        client_ip=client_ip,
        fingerprint=fingerprint,
        user_agent=user_agent,
        route=request.url.path,
        method=request.method.upper(),
        user_id=user_id,
    )


def hash_sensitive_value(value: str) -> str:
    """
    Hash a sensitive user-controlled value for logs and secondary limiter keys.
    """

    normalized = value.strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]


async def consume_rate_limit(
    *,
    request: Request,
    tier: RateLimitTier,
    user_id: Optional[str] = None,
    subject_hint: Optional[str] = None,
) -> tuple[bool, int, int, RateLimitPolicy, RequestFingerprint]:
    """
    Consume one request against the shared PostgreSQL-backed limiter store.
    """

    policy = get_rate_limit_policy(tier)
    fingerprint = build_request_fingerprint(request, user_id=user_id)
    subject_hash = hash_sensitive_value(subject_hint) if subject_hint else "none"

    now = datetime.now(timezone.utc)
    window_epoch = int(now.timestamp()) // policy.window_seconds
    window_started_at = datetime.fromtimestamp(
        window_epoch * policy.window_seconds,
        tz=timezone.utc,
    )
    expires_at = window_started_at + timedelta(seconds=policy.window_seconds)
    key_material = "|".join(
        [
            tier,
            fingerprint.fingerprint,
            user_id or "anonymous",
            subject_hash,
        ]
    )
    key_hash = hashlib.sha256(key_material.encode("utf-8")).hexdigest()

    pool = Database.get_pool()

    try:
        async with pool.acquire() as connection:
            request_count = await connection.fetchval(
                """
                insert into library.rate_limit_counters (
                    tier,
                    key_hash,
                    window_started_at,
                    request_count,
                    expires_at,
                    last_seen_at
                )
                values ($1::text, $2::text, $3::timestamptz, 1, $4::timestamptz, now())
                on conflict (tier, key_hash, window_started_at)
                do update
                set
                    request_count = library.rate_limit_counters.request_count + 1,
                    expires_at = excluded.expires_at,
                    last_seen_at = now()
                returning request_count
                """,
                tier,
                key_hash,
                window_started_at,
                expires_at,
            )
    except asyncpg.PostgresError as exc:
        logger.error(
            "SECURITY: rate limit store failure",
            extra={
                "route": request.url.path,
                "method": request.method.upper(),
                "tier": tier,
                "user_id": user_id,
                "client_ip": fingerprint.client_ip,
                "fingerprint": fingerprint.fingerprint,
                "error": str(exc),
                "sqlstate": exc.sqlstate,
            },
        )
        raise RuntimeError("Rate limit store failure") from exc

    retry_after_seconds = max(1, int((expires_at - now).total_seconds()))
    allowed = bool(request_count <= policy.max_requests)

    return allowed, retry_after_seconds, int(request_count), policy, fingerprint


async def enforce_rate_limit(
    *,
    request: Request,
    tier: RateLimitTier,
    user_id: Optional[str] = None,
    subject_hint: Optional[str] = None,
) -> None:
    """
    Enforce a configured rate limit and raise a typed error on violation.
    """

    (
        allowed,
        retry_after_seconds,
        request_count,
        policy,
        fingerprint,
    ) = await consume_rate_limit(
        request=request,
        tier=tier,
        user_id=user_id,
        subject_hint=subject_hint,
    )

    if allowed:
        return

    logger.warning(
        "SECURITY: rate limit exceeded",
        extra={
            "route": request.url.path,
            "method": request.method.upper(),
            "tier": policy.tier,
            "request_count": request_count,
            "max_requests": policy.max_requests,
            "window_seconds": policy.window_seconds,
            "retry_after_seconds": retry_after_seconds,
            "user_id": user_id,
            "client_ip": fingerprint.client_ip,
            "fingerprint": fingerprint.fingerprint,
            "subject_hash": (
                hash_sensitive_value(subject_hint) if subject_hint else None
            ),
            "status_code": 429,
        },
    )

    raise RateLimitExceededError(
        tier=tier,
        retry_after_seconds=retry_after_seconds,
        message="Too Many Requests",
    )


def build_rate_limit_response(
    *,
    retry_after_seconds: int,
    message: str = "Too Many Requests",
) -> JSONResponse:
    """
    Build a standardized rate-limit error response.
    """

    return JSONResponse(
        status_code=429,
        headers={
            "Retry-After": str(max(retry_after_seconds, 1)),
        },
        content={
            "status": 429,
            "message": message,
            "data": {},
            "timestamp_ms": int(time.time() * 1000),
        },
    )
