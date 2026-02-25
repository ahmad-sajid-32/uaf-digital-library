# apps/api/core/logging.py
"""
Centralized structured JSON logging configuration for the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Enforce JSON-only structured logging.
- Provide consistent log schema across all modules.
- Support contextual metadata via `extra={}`.
- Output logs to stdout (Render-compatible).
- Prevent duplicate handlers.
- Respect environment-driven log level.

Architectural Role:
FastAPI → core.logging → global structured logging → observability pipeline.

Design Decisions:
- No file logging (containerized deployment).
- No wrapper logger classes.
- No message mutation.
- Root logger configured once at startup.
- Environment context always included.
"""

import json
import logging
import sys
import time
from typing import Any, Dict

from core.config import settings


class StructuredJSONFormatter(logging.Formatter):
    """
    Production-grade JSON formatter.

    Output Schema:
        timestamp_ms: int
        level: str
        logger: str
        message: str
        environment: str
        request_id: Optional[str]
        user_id: Optional[str]
        route: Optional[str]
        status_code: Optional[int]
        latency_ms: Optional[int]

    All additional structured fields must be passed via `extra={}`.
    """

    RESERVED_ATTRS = {
        "name", "msg", "args", "levelname", "levelno", "pathname",
        "filename", "module", "exc_info", "exc_text", "stack_info",
        "lineno", "funcName", "created", "msecs", "relativeCreated",
        "thread", "threadName", "processName", "process"
    }

    def format(self, record: logging.LogRecord) -> str:
        base_log: Dict[str, Any] = {
            "timestamp_ms": int(time.time() * 1000),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "environment": settings.environment,
        }

        # Attach structured metadata (only non-reserved attributes)
        for key, value in record.__dict__.items():
            if key not in self.RESERVED_ATTRS and not key.startswith("_"):
                base_log[key] = value

        return json.dumps(base_log, ensure_ascii=False)


def configure_logging() -> None:
    """
    Configure root logger for entire application.

    This function:
    - Sets global log level from environment.
    - Clears existing handlers (important during reload).
    - Attaches JSON formatter to stdout.
    - Silences noisy third-party loggers.

    Must be called once during FastAPI startup.
    """

    root_logger = logging.getLogger()
    root_logger.setLevel(settings.log_level.upper())

    # Remove existing handlers (prevents duplicate logs on reload)
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(StructuredJSONFormatter())
    root_logger.addHandler(stream_handler)

    # Silence overly verbose libraries unless debugging
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("asyncpg").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Retrieve a module-specific logger.

    Args:
        name (str): Usually __name__ of module.

    Returns:
        logging.Logger: Logger instance.

    Usage Example:
        logger = get_logger(__name__)
        logger.info(
            "API: borrow request",
            extra={"user_id": user_id, "request_id": request_id}
        )
    """
    return logging.getLogger(name)