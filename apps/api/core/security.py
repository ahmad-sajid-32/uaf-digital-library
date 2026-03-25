# apps/api/core/security.py
"""
Shared security middleware for the UAF Smart E-Library backend.

Purpose:
- Apply safe default security headers to backend responses.
- Keep security-header policy centralized and environment-driven.
- Avoid duplicating header logic across routes or exception handlers.

This middleware is intentionally conservative so it does not interfere with
current Supabase-authenticated flows or local Swagger usage.
"""

from __future__ import annotations

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Apply baseline security headers to all backend responses.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if not settings.security_headers_enabled:
            return response

        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()",
        )
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")

        if settings.security_hsts_enabled:
            response.headers.setdefault(
                "Strict-Transport-Security",
                (
                    f"max-age={settings.security_hsts_max_age_seconds}; "
                    "includeSubDomains; preload"
                ),
            )

        return response
