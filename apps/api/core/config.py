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
        environment (EnvironmentType): Deployment environment.
        log_level (str): Logging verbosity level.
    """

    database_url: str
    supabase_project_url: str
    supabase_jwt_audience: str
    supabase_service_role_key: str
    environment: EnvironmentType
    log_level: str


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
        environment=environment,  # type: ignore
        log_level=_get_required_env("LOG_LEVEL"),
    )


# Singleton settings instance.
# Imported by other modules.
settings: Settings = load_settings()