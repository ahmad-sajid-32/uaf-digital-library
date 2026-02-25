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
from starlette.exceptions import HTTPException as StarletteHTTPException

from core.config import settings
from core.logging import configure_logging, get_logger
from core.database import Database
from core.middleware import AuthenticationMiddleware

from modules.books.routes import router as books_router
from modules.auth.routes import router as auth_router


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

app.add_middleware(AuthenticationMiddleware)

# --------------------------------------------------
# Router Registration
# --------------------------------------------------

app.include_router(books_router)
app.include_router(auth_router)


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
        "status_code": int,
        "message": str,
        "timestamp_ms": int,
        "request_id": str
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
            "status_code": status_code,
            "message": message,
            "timestamp_ms": int(time.time() * 1000),
            "request_id": request_id,
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
        "status": "ok",
        "environment": settings.environment,
    }