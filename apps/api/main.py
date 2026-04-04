# apps/api/main.py
"""
Application bootstrap for the UAF Smart E-Library & University Information Assistant.

This module is the composition root of the backend system.

Responsibilities:
- Initialize structured logging.
- Create and configure FastAPI application.
- Register global middleware.
- Register module routers.
- Manage database connection lifecycle.
- Configure Swagger (disabled in production).
- Provide health endpoint for liveness probes.
- Enforce standardized JSON error envelope.

This file contains NO business logic.
All core domain logic resides inside PostgreSQL RPC functions.
"""

import time
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from core.config import settings
from core.logging import configure_logging, get_logger
from core.database import Database
from core.account_access import AccountAccessMiddleware
from core.middleware import AuthenticationMiddleware
from core.rate_limit import RateLimitExceededError, build_rate_limit_response
from core.security import SecurityHeadersMiddleware

from modules.books.routes import admin_router as admin_books_router
from modules.books.routes import router as books_router
from modules.auth.routes import (
    public_router as public_auth_router,
    router as auth_router,
)
from modules.queue.routes import router as queue_router
from modules.borrow.routes import router as borrow_router
from modules.me.routes import router as me_router
from modules.fines.routes import router as fines_router
from modules.admin_fines.routes import router as admin_fines_router
from modules.admin_metrics.routes import router as admin_metrics_router
from modules.results.routes import (
    public_router as public_results_router,
    router as results_router,
)
from modules.documents.routes import router as documents_router
from modules.ai.routes import admin_router as admin_ai_router
from modules.ai.routes import router as ai_router


# --------------------------------------------------
# Logging Initialization
# --------------------------------------------------

configure_logging()
logger = get_logger(__name__)


# --------------------------------------------------
# Application Lifespan
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Startup:
        - Initialize asyncpg connection pool.
        - Fail fast if database unavailable.

    Shutdown:
        - Close connection pool cleanly.
    """

    logger.info(
        "APP: starting up",
        extra={"environment": settings.environment},
    )

    await Database.initialize()

    yield

    logger.info("APP: shutting down")
    await Database.close()


# --------------------------------------------------
# Swagger Configuration
# --------------------------------------------------

docs_url = None if settings.environment == "production" else "/docs"
redoc_url = None if settings.environment == "production" else "/redoc"
openapi_url = None if settings.environment == "production" else "/openapi.json"


app = FastAPI(
    title="UAF Smart E-Library & University Information Assistant API",
    description="Production-grade backend for UAF digital library system.",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
    lifespan=lifespan,
)

# --------------------------------------------------
# Middleware Registration
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allowed_origins),
    allow_credentials=True,
    allow_methods=list(settings.cors_allowed_methods),
    allow_headers=list(settings.cors_allowed_headers),
)
app.add_middleware(AccountAccessMiddleware)
app.add_middleware(AuthenticationMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# --------------------------------------------------
# Router Registration
# --------------------------------------------------

app.include_router(books_router)
app.include_router(admin_books_router)
app.include_router(auth_router)
app.include_router(public_auth_router)
app.include_router(queue_router)
app.include_router(borrow_router)
app.include_router(me_router)
app.include_router(fines_router)
app.include_router(admin_fines_router)
app.include_router(admin_metrics_router)
app.include_router(results_router)
app.include_router(public_results_router)
app.include_router(documents_router)
app.include_router(ai_router)
app.include_router(admin_ai_router)


# --------------------------------------------------
# Standardized Error Envelope
# --------------------------------------------------

def build_error_response(
    status_code: int,
    message: str,
    request: Request,
) -> JSONResponse:
    """
    Construct standardized JSON error response.

    Structure:
    {
        "status": int,
        "message": str,
        "data": {},
        "timestamp_ms": int
    }
    """

    request_id = getattr(request.state, "request_id", None)

    logger.warning(
        "APP: error response generated",
        extra={
            "request_id": request_id,
            "status_code": status_code,
            "route": request.url.path,
        },
    )

    return JSONResponse(
        status_code=status_code,
        content={
            "status": status_code,
            "message": message,
            "data": {},
            "timestamp_ms": int(time.time() * 1000),
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
):
    return build_error_response(exc.status_code, exc.detail, request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    return build_error_response(422, "Validation Error", request)


@app.exception_handler(RateLimitExceededError)
async def rate_limit_exception_handler(
    request: Request,
    exc: RateLimitExceededError,
):
    return build_rate_limit_response(
        retry_after_seconds=exc.retry_after_seconds,
        message=exc.message,
    )


@app.exception_handler(Exception)
async def global_exception_handler(
    request: Request,
    exc: Exception,
):
    logger.error(
        "APP: unhandled exception",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "route": request.url.path,
            "error": str(exc),
        },
    )

    return build_error_response(500, "Internal Server Error", request)


# --------------------------------------------------
# Public Health Endpoint
# --------------------------------------------------

@app.get("/health", tags=["System"])
async def health() -> Dict[str, Any]:
    """
    Health check endpoint.

    Public.
    Used by hosting provider for liveness probe.
    Does not require authentication.
    Does not access database.
    """

    return {
        "status": 200,
        "message": "Health check successful",
        "data": {
            "service_status": "ok",
            "environment": settings.environment,
        },
        "timestamp_ms": int(time.time() * 1000),
    }
