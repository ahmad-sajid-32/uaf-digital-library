# apps/api/core/account_access.py
"""
Account access enforcement middleware for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Resolve the authenticated user's current profile access context from PostgreSQL.
- Attach resolved role and activity state to request context for downstream use.
- Deny protected requests for users whose library profile is missing.
- Deny protected requests for users whose account is inactive.

Architectural Constraints:
- No route logic.
- No core library business rules.
- Only account-access enforcement for already-authenticated requests.
- Persistent source of truth remains PostgreSQL.
"""

import time

import asyncpg
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from core.database import Database
from core.logging import get_logger

logger = get_logger(__name__)


class AccountAccessMiddleware(BaseHTTPMiddleware):
    """
    Enforce application-level account activity after JWT identity validation.
    """

    async def dispatch(self, request: Request, call_next):
        user_id = getattr(request.state, "user_id", None)

        if not user_id:
            return await call_next(request)

        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                row = await connection.fetchrow(
                    """
                    select role, is_active
                    from library.get_profile_access_context($1::uuid)
                    """,
                    user_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AUTH: profile access context lookup failed",
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "route": request.url.path,
                    "user_id": user_id,
                    "error": str(exc),
                    "sqlstate": exc.sqlstate,
                    "status_code": 500,
                },
            )
            return self._build_error_response(
                status_code=500,
                message="Internal Server Error",
            )

        if row is None:
            logger.warning(
                "AUTH: protected request profile missing",
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "route": request.url.path,
                    "user_id": user_id,
                    "status_code": 403,
                },
            )
            return self._build_error_response(
                status_code=403,
                message="Profile not found",
            )

        request.state.role = row["role"]
        request.state.is_active = row["is_active"]

        if not row["is_active"]:
            logger.warning(
                "AUTH: inactive account blocked",
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "route": request.url.path,
                    "user_id": user_id,
                    "role": row["role"],
                    "status_code": 403,
                },
            )
            return self._build_error_response(
                status_code=403,
                message="Account is inactive",
            )

        return await call_next(request)

    @staticmethod
    def _build_error_response(
        *,
        status_code: int,
        message: str,
    ) -> JSONResponse:
        """
        Return a standardized JSON error envelope for access denials.
        """

        return JSONResponse(
            status_code=status_code,
            content={
                "status": status_code,
                "message": message,
                "data": {},
                "timestamp_ms": int(time.time() * 1000),
            },
        )
