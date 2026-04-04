# apps/api/core/config.py
"""
Centralized application configuration loader for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
1. Load environment variables from:
   - .env file (local development only)
   - OS environment (production via Render)
2. Validate required configuration variables at startup.
3. Provide typed access to configuration values.
4. Fail fast if misconfigured.

This file does NOT:
- Contain business logic
- Connect to the database
- Perform authentication
- Call Supabase APIs

It is purely configuration governance.

Architectural Role:
FastAPI → core.config → environment validation → system boot control.

Security Considerations:
- No secrets are hardcoded.
- .env loading only applies to local development.
- Production relies strictly on injected environment variables.
- SUPABASE_SERVICE_ROLE_KEY is highly privileged and must never be logged.
"""

import os
from dataclasses import dataclass
from typing import Literal

from dotenv import load_dotenv


# Load .env only if present (local development safety).
# In production (Render), environment variables are injected and .env is absent.
load_dotenv()


EnvironmentType = Literal["local", "staging", "production"]


@dataclass(frozen=True)
class Settings:
    """
    Immutable application configuration.

    All required environment variables are validated at instantiation.
    If any required variable is missing, the application will fail fast.

    Attributes:
        database_url (str): Supavisor PostgreSQL connection string (port 6543).
        supabase_project_url (str): Base Supabase project URL.
        supabase_jwt_audience (str): Expected JWT audience claim.
        supabase_service_role_key (str): Privileged key for Supabase Admin API.
        supabase_storage_bucket_university_documents (str): Private bucket for official documents.
        environment (EnvironmentType): Deployment environment.
        log_level (str): Logging verbosity level.
        bytez_api_key (str): Bytez API key used for embeddings.
        bytez_embedding_model (str): Embedding model identifier.
        document_embedding_dimensions (int): Embedding vector dimension persisted in PostgreSQL.
        document_chunk_size (int): Character size for deterministic document chunking.
        document_chunk_overlap (int): Character overlap for adjacent document chunks.
        document_retrieval_default_top_k (int): Default retrieval result count.
        document_retrieval_max_top_k (int): Maximum retrieval result count allowed by API.
        document_retrieval_similarity_threshold (float): Default cosine similarity threshold.
        bytez_chat_model (str): Grounded answer generation model identifier.
        bytez_chat_temperature (float): Low-temperature setting for grounded generation.
        bytez_chat_max_tokens (int): Maximum answer token budget.
        lms_result_url (str): UAF LMS result page URL used by Selenium.
        selenium_timeout_seconds (int): Browser wait timeout for scraping.
        reg_input_selector (str): Selector spec for registration number input.
        submit_selector (str): Selector spec for result submit control.
    """

    database_url: str
    supabase_project_url: str
    supabase_jwt_audience: str
    supabase_service_role_key: str
    supabase_storage_bucket_university_documents: str
    environment: EnvironmentType
    log_level: str
    bytez_api_key: str
    bytez_embedding_model: str
    document_embedding_dimensions: int
    document_chunk_size: int
    document_chunk_overlap: int
    document_retrieval_default_top_k: int
    document_retrieval_max_top_k: int
    document_retrieval_similarity_threshold: float
    bytez_chat_model: str
    bytez_chat_temperature: float
    bytez_chat_max_tokens: int
    lms_result_url: str
    selenium_timeout_seconds: int
    reg_input_selector: str
    submit_selector: str
    cors_allowed_origins: tuple[str, ...]
    cors_allowed_methods: tuple[str, ...]
    cors_allowed_headers: tuple[str, ...]
    frontend_app_url: str
    security_headers_enabled: bool
    security_hsts_enabled: bool
    security_hsts_max_age_seconds: int
    trusted_client_ip_headers: tuple[str, ...]
    auth_public_rate_limit_window_seconds: int
    auth_public_rate_limit_max_requests: int
    admin_auth_rate_limit_window_seconds: int
    admin_auth_rate_limit_max_requests: int
    book_public_detail_rate_limit_window_seconds: int
    book_public_detail_rate_limit_max_requests: int
    book_queue_read_rate_limit_window_seconds: int
    book_queue_read_rate_limit_max_requests: int
    book_staff_read_rate_limit_window_seconds: int
    book_staff_read_rate_limit_max_requests: int
    book_mutation_rate_limit_window_seconds: int
    book_mutation_rate_limit_max_requests: int
    fine_read_rate_limit_window_seconds: int
    fine_read_rate_limit_max_requests: int
    fine_settlement_rate_limit_window_seconds: int
    fine_settlement_rate_limit_max_requests: int
    ai_retrieval_rate_limit_window_seconds: int
    ai_retrieval_rate_limit_max_requests: int
    ai_generation_rate_limit_window_seconds: int
    ai_generation_rate_limit_max_requests: int
    document_upload_rate_limit_window_seconds: int
    document_upload_rate_limit_max_requests: int
    document_finalize_rate_limit_window_seconds: int
    document_finalize_rate_limit_max_requests: int
    document_read_rate_limit_window_seconds: int
    document_read_rate_limit_max_requests: int
    document_delete_rate_limit_window_seconds: int
    document_delete_rate_limit_max_requests: int
    document_upload_max_file_size_bytes: int
    document_signed_read_url_ttl_seconds: int
    document_upload_stale_after_seconds: int


def _get_required_env(var_name: str) -> str:
    """
    Fetch a required environment variable.

    Args:
        var_name (str): Name of the environment variable.

    Returns:
        str: Environment variable value.

    Raises:
        RuntimeError: If variable is missing or empty.

    Rationale:
        Fail fast during startup instead of failing during request handling.
        Configuration errors must crash the service immediately.
    """
    value = os.getenv(var_name)

    if value is None or value.strip() == "":
        raise RuntimeError(
            f"CONFIG ERROR: Required environment variable '{var_name}' is missing."
        )

    return value


def _get_env(var_name: str, default: str) -> str:
    """
    Fetch an optional environment variable with a fallback default.

    Args:
        var_name (str): Name of the environment variable.
        default (str): Fallback value.

    Returns:
        str: Resolved environment variable value.
    """

    value = os.getenv(var_name)

    if value is None or value.strip() == "":
        return default

    return value


def _get_list_env(var_name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    """
    Fetch a comma-separated environment variable as a normalized tuple.
    """

    value = os.getenv(var_name)

    if value is None or value.strip() == "":
        return default

    return tuple(
        item.strip().rstrip("/")
        for item in value.split(",")
        if item.strip()
    )


def _get_bool_env(var_name: str, default: bool) -> bool:
    """
    Fetch a boolean environment variable with a safe default.
    """

    value = os.getenv(var_name)

    if value is None or value.strip() == "":
        return default

    normalized = value.strip().lower()

    if normalized in {"1", "true", "yes", "on"}:
        return True

    if normalized in {"0", "false", "no", "off"}:
        return False

    raise ValueError(
        f"CONFIG ERROR: Environment variable '{var_name}' must be a boolean value."
    )


def _normalize_methods(values: tuple[str, ...]) -> tuple[str, ...]:
    """
    Normalize CORS method values to uppercase tokens.
    """

    return tuple(value.strip().upper() for value in values if value.strip())


def _normalize_headers(values: tuple[str, ...]) -> tuple[str, ...]:
    """
    Normalize CORS header values while preserving canonical formatting.
    """

    return tuple(value.strip() for value in values if value.strip())


def _validate_cors_settings(
    *,
    environment: str,
    origins: tuple[str, ...],
    methods: tuple[str, ...],
    headers: tuple[str, ...],
) -> None:
    """
    Validate CORS configuration with stricter production safety rules.
    """

    if not origins:
        raise ValueError("CONFIG ERROR: CORS_ALLOWED_ORIGINS must not be empty.")

    if any(origin == "*" for origin in origins):
        raise ValueError(
            "CONFIG ERROR: Wildcard CORS origin '*' is not allowed."
        )

    if not methods:
        raise ValueError("CONFIG ERROR: CORS_ALLOWED_METHODS must not be empty.")

    if not headers:
        raise ValueError("CONFIG ERROR: CORS_ALLOWED_HEADERS must not be empty.")

    if environment == "production":
        if os.getenv("CORS_ALLOWED_ORIGINS", "").strip() == "":
            raise RuntimeError(
                "CONFIG ERROR: CORS_ALLOWED_ORIGINS must be explicitly set in production."
            )

        for origin in origins:
            lowered = origin.lower()

            if lowered.startswith("http://"):
                raise ValueError(
                    "CONFIG ERROR: Production CORS origins must use HTTPS."
                )

            if "localhost" in lowered or "127.0.0.1" in lowered:
                raise ValueError(
                    "CONFIG ERROR: Localhost origins are not allowed in production CORS policy."
                )


def load_settings() -> Settings:
    """
    Load and validate application configuration.

    Returns:
        Settings: Immutable configuration object.

    Raises:
        RuntimeError: If required environment variables are missing.
        ValueError: If environment value is invalid.

    Execution Flow:
        1. Read required variables.
        2. Validate environment type.
        3. Return frozen Settings instance.
    """

    environment = _get_required_env("ENVIRONMENT")

    if environment not in {"local", "staging", "production"}:
        raise ValueError(
            "CONFIG ERROR: ENVIRONMENT must be one of: local | staging | production"
        )

    cors_allowed_origins = _get_list_env(
        "CORS_ALLOWED_ORIGINS",
        (
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ),
    )
    cors_allowed_methods = _normalize_methods(
        _get_list_env(
            "CORS_ALLOWED_METHODS",
            ("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"),
        )
    )
    cors_allowed_headers = _normalize_headers(
        _get_list_env(
            "CORS_ALLOWED_HEADERS",
            ("Authorization", "Content-Type", "Accept", "X-Request-ID"),
        )
    )

    _validate_cors_settings(
        environment=environment,
        origins=cors_allowed_origins,
        methods=cors_allowed_methods,
        headers=cors_allowed_headers,
    )

    return Settings(
        database_url=_get_required_env("DATABASE_URL"),
        supabase_project_url=_get_required_env("SUPABASE_PROJECT_URL"),
        supabase_jwt_audience=_get_required_env("SUPABASE_JWT_AUDIENCE"),
        supabase_service_role_key=_get_required_env("SUPABASE_SERVICE_ROLE_KEY"),
        supabase_storage_bucket_university_documents=_get_env(
            "SUPABASE_STORAGE_BUCKET_UNIVERSITY_DOCUMENTS",
            "university-documents",
        ),
        environment=environment,  # type: ignore
        log_level=_get_required_env("LOG_LEVEL"),
        bytez_api_key=_get_env("BYTEZ_API_KEY", ""),
        bytez_embedding_model=_get_env(
            "BYTEZ_EMBEDDING_MODEL",
            "BAAI/bge-small-en-v1.5",
        ),
        document_embedding_dimensions=int(
            _get_env("DOCUMENT_EMBEDDING_DIMENSIONS", "384")
        ),
        document_chunk_size=int(_get_env("DOCUMENT_CHUNK_SIZE", "1400")),
        document_chunk_overlap=int(_get_env("DOCUMENT_CHUNK_OVERLAP", "200")),
        document_retrieval_default_top_k=int(
            _get_env("DOCUMENT_RETRIEVAL_DEFAULT_TOP_K", "5")
        ),
        document_retrieval_max_top_k=int(
            _get_env("DOCUMENT_RETRIEVAL_MAX_TOP_K", "12")
        ),
        document_retrieval_similarity_threshold=float(
            _get_env("DOCUMENT_RETRIEVAL_SIMILARITY_THRESHOLD", "0.70")
        ),
        bytez_chat_model=_get_env(
            "BYTEZ_CHAT_MODEL",
            "Qwen/Qwen3-4B-Instruct-2507",
        ),
        bytez_chat_temperature=float(_get_env("BYTEZ_CHAT_TEMPERATURE", "0.1")),
        bytez_chat_max_tokens=int(_get_env("BYTEZ_CHAT_MAX_TOKENS", "500")),
        lms_result_url=_get_env(
            "LMS_RESULT_URL",
            "https://lms.uaf.edu.pk/login/index.php",
        ),
        selenium_timeout_seconds=int(_get_env("SELENIUM_TIMEOUT_SECONDS", "45")),
        reg_input_selector=_get_env("REG_INPUT_SELECTOR", "id=REG"),
        submit_selector=_get_env(
            "SUBMIT_SELECTOR",
            "xpath=//input[@type='submit'][@value='Result']",
        ),
        cors_allowed_origins=cors_allowed_origins,
        cors_allowed_methods=cors_allowed_methods,
        cors_allowed_headers=cors_allowed_headers,
        frontend_app_url=_get_env("FRONTEND_APP_URL", "http://localhost:3000"),
        security_headers_enabled=_get_bool_env("SECURITY_HEADERS_ENABLED", True),
        security_hsts_enabled=_get_bool_env(
            "SECURITY_HSTS_ENABLED",
            environment == "production",
        ),
        security_hsts_max_age_seconds=int(
            _get_env("SECURITY_HSTS_MAX_AGE_SECONDS", "31536000")
        ),
        trusted_client_ip_headers=_get_list_env(
            "TRUSTED_CLIENT_IP_HEADERS",
            (),
        ),
        auth_public_rate_limit_window_seconds=int(
            _get_env("AUTH_PUBLIC_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        auth_public_rate_limit_max_requests=int(
            _get_env("AUTH_PUBLIC_RATE_LIMIT_MAX_REQUESTS", "12")
        ),
        admin_auth_rate_limit_window_seconds=int(
            _get_env("ADMIN_AUTH_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        admin_auth_rate_limit_max_requests=int(
            _get_env("ADMIN_AUTH_RATE_LIMIT_MAX_REQUESTS", "40")
        ),
        book_public_detail_rate_limit_window_seconds=int(
            _get_env("BOOK_PUBLIC_DETAIL_RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
        book_public_detail_rate_limit_max_requests=int(
            _get_env("BOOK_PUBLIC_DETAIL_RATE_LIMIT_MAX_REQUESTS", "60")
        ),
        book_queue_read_rate_limit_window_seconds=int(
            _get_env("BOOK_QUEUE_READ_RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
        book_queue_read_rate_limit_max_requests=int(
            _get_env("BOOK_QUEUE_READ_RATE_LIMIT_MAX_REQUESTS", "30")
        ),
        book_staff_read_rate_limit_window_seconds=int(
            _get_env("BOOK_STAFF_READ_RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
        book_staff_read_rate_limit_max_requests=int(
            _get_env("BOOK_STAFF_READ_RATE_LIMIT_MAX_REQUESTS", "60")
        ),
        book_mutation_rate_limit_window_seconds=int(
            _get_env("BOOK_MUTATION_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        book_mutation_rate_limit_max_requests=int(
            _get_env("BOOK_MUTATION_RATE_LIMIT_MAX_REQUESTS", "20")
        ),
        fine_read_rate_limit_window_seconds=int(
            _get_env("FINE_READ_RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
        fine_read_rate_limit_max_requests=int(
            _get_env("FINE_READ_RATE_LIMIT_MAX_REQUESTS", "30")
        ),
        fine_settlement_rate_limit_window_seconds=int(
            _get_env("FINE_SETTLEMENT_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        fine_settlement_rate_limit_max_requests=int(
            _get_env("FINE_SETTLEMENT_RATE_LIMIT_MAX_REQUESTS", "15")
        ),
        ai_retrieval_rate_limit_window_seconds=int(
            _get_env("AI_RETRIEVAL_RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
        ai_retrieval_rate_limit_max_requests=int(
            _get_env("AI_RETRIEVAL_RATE_LIMIT_MAX_REQUESTS", "20")
        ),
        ai_generation_rate_limit_window_seconds=int(
            _get_env("AI_GENERATION_RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
        ai_generation_rate_limit_max_requests=int(
            _get_env("AI_GENERATION_RATE_LIMIT_MAX_REQUESTS", "10")
        ),
        document_upload_rate_limit_window_seconds=int(
            _get_env("DOCUMENT_UPLOAD_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        document_upload_rate_limit_max_requests=int(
            _get_env("DOCUMENT_UPLOAD_RATE_LIMIT_MAX_REQUESTS", "20")
        ),
        document_finalize_rate_limit_window_seconds=int(
            _get_env("DOCUMENT_FINALIZE_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        document_finalize_rate_limit_max_requests=int(
            _get_env("DOCUMENT_FINALIZE_RATE_LIMIT_MAX_REQUESTS", "15")
        ),
        document_read_rate_limit_window_seconds=int(
            _get_env("DOCUMENT_READ_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        document_read_rate_limit_max_requests=int(
            _get_env("DOCUMENT_READ_RATE_LIMIT_MAX_REQUESTS", "60")
        ),
        document_delete_rate_limit_window_seconds=int(
            _get_env("DOCUMENT_DELETE_RATE_LIMIT_WINDOW_SECONDS", "300")
        ),
        document_delete_rate_limit_max_requests=int(
            _get_env("DOCUMENT_DELETE_RATE_LIMIT_MAX_REQUESTS", "15")
        ),
        document_upload_max_file_size_bytes=int(
            _get_env("DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES", "26214400")
        ),
        document_signed_read_url_ttl_seconds=int(
            _get_env("DOCUMENT_SIGNED_READ_URL_TTL_SECONDS", "300")
        ),
        document_upload_stale_after_seconds=int(
            _get_env("DOCUMENT_UPLOAD_STALE_AFTER_SECONDS", "86400")
        ),
    )


# Singleton settings instance.
# Imported by other modules.
settings: Settings = load_settings()
