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
    )


# Singleton settings instance.
# Imported by other modules.
settings: Settings = load_settings()
