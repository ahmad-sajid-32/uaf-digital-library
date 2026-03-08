# apps/api/core/middleware.py
"""
Authentication & Request Context Middleware for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Enforce JWT validation (RS256 via Supabase JWKS).
- Apply path exemptions (/health, GET /api/books).
- Validate issuer and audience.
- Extract user_id (sub) ONLY.
- Inject request_id into request context.
- Provide 1-hour JWKS in-memory caching with forced refresh fallback.
- Return clean JSON errors on authentication failure.

Architectural Constraints:
- No business logic.
- No database interaction.
- No authorization decisions.
- Role authority lives in library.profiles (RLS enforced).
"""

import time
import uuid
from typing import Any, Dict, Optional

import httpx
from jose import jwt, JWTError
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

JWKS_TTL_SECONDS = 3600


class JWKSCache:
    """
    In-memory JWKS cache with TTL and forced refresh capability.
    """

    def __init__(self) -> None:
        self._jwks: Optional[Dict[str, Any]] = None
        self._last_fetched: float = 0

    async def get_jwks(self, force_refresh: bool = False) -> Dict[str, Any]:
        now = time.time()

        if (
            self._jwks is None
            or force_refresh
            or (now - self._last_fetched) > JWKS_TTL_SECONDS
        ):
            await self._refresh()

        return self._jwks  # type: ignore

    async def _refresh(self) -> None:
        jwks_url = f"{settings.supabase_project_url}/auth/v1/.well-known/jwks.json"

        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(jwks_url)
                response.raise_for_status()
                self._jwks = response.json()
                self._last_fetched = time.time()

            logger.info(
                "AUTH: JWKS refreshed",
                extra={"route": "jwks_refresh"},
            )

        except Exception as exc:
            logger.error(
                "AUTH: JWKS refresh failed",
                extra={"error": str(exc)},
            )
            raise RuntimeError("Unable to refresh JWKS") from exc


jwks_cache = JWKSCache()


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware enforcing JWT validation and request identity injection.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = self._resolve_request_id(request)
        request.state.request_id = request_id

        if self._is_public_route(request):
            return await call_next(request)

        token = self._extract_token(request)

        if not token:
            return self._unauthorized("Missing Authorization header", request_id)

        try:
            payload = await self._validate_token(token)
        except Exception:
            return self._unauthorized("Invalid or expired token", request_id)

        user_id = payload.get("sub")

        if not user_id:
            return self._forbidden("Missing required identity claim", request_id)

        # Identity-only mode
        request.state.user_id = user_id

        response = await call_next(request)
        return response

    def _is_public_route(self, request: Request) -> bool:
        """
        Determine whether route should bypass JWT validation.

        Public routes:
        - /health (always public)
        - GET /api/books (public catalog read)
        - GET /api/public/result (public LMS result lookup)
        - Swagger routes (only in non-production environments)
        """

        path = request.url.path
        method = request.method.upper()

        # Health endpoint (always public)
        if path == "/health":
            return True

        # Public book catalog read
        if method == "GET" and path == "/api/books":
            return True

        # Public LMS result lookup
        if method == "GET" and path == "/api/public/result":
            return True

        # Swagger & OpenAPI (allowed only outside production)
        if settings.environment != "production":
            swagger_prefixes = [
                "/docs",
                "/redoc",
                "/openapi.json",
            ]

            for prefix in swagger_prefixes:
                if path.startswith(prefix):
                    return True

        return False

    def _extract_token(self, request: Request) -> Optional[str]:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        return auth_header.split(" ")[1]

    async def _validate_token(self, token: str) -> Dict[str, Any]:
        jwks = await jwks_cache.get_jwks()

        try:
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["ES256", "RS256"],
                audience=settings.supabase_jwt_audience,
                issuer=f"{settings.supabase_project_url}/auth/v1",
            )
            return payload

        except JWTError:
            # Force refresh once (possible key rotation)
            jwks = await jwks_cache.get_jwks(force_refresh=True)

            payload = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                audience=settings.supabase_jwt_audience,
                issuer=f"{settings.supabase_project_url}/auth/v1",
            )
            return payload

    def _resolve_request_id(self, request: Request) -> str:
        request_id = request.headers.get("X-Request-ID")

        if request_id:
            return request_id

        return str(uuid.uuid4())

    def _unauthorized(self, message: str, request_id: str) -> JSONResponse:
        logger.warning(
            "AUTH: unauthorized",
            extra={"request_id": request_id, "status_code": 401},
        )
        return JSONResponse(
            status_code=401,
            content={
                "status": 401,
                "message": message,
                "data": {},
                "timestamp_ms": int(time.time() * 1000),
            },
        )

    def _forbidden(self, message: str, request_id: str) -> JSONResponse:
        logger.warning(
            "AUTH: forbidden",
            extra={"request_id": request_id, "status_code": 403},
        )
        return JSONResponse(
            status_code=403,
            content={
                "status": 403,
                "message": message,
                "data": {},
                "timestamp_ms": int(time.time() * 1000),
            },
        )
