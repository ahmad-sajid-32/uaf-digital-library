# apps/api/core/database.py
"""
Async PostgreSQL connection pool manager for the
UAF Smart E-Library & University Information Assistant.

Purpose:
- Establish and manage asyncpg connection pool via Supavisor.
- Provide controlled acquisition and release of DB connections.
- Expose safe pool accessor for service layer orchestration.
- Enforce fail-fast startup if database is unreachable.
- Ensure clean shutdown of connections.

Architectural Role:
FastAPI → core.database → asyncpg → Supavisor → PostgreSQL (library schema).

Critical Constraints:
- No business logic here.
- No SQL queries here.
- No RPC logic here.
- Pure connection lifecycle management only.

Security & Integrity:
- Uses DATABASE_URL from environment.
- SSL enforced (Supabase requires TLS).
- Pool sizing controlled to prevent free-tier exhaustion.

Failure Model:
If database connection fails at startup → application must crash.
Partial startup is not allowed.
"""

from typing import Optional

import asyncpg

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)


class Database:
    """
    Asyncpg connection pool manager.

    Responsibilities:
    - Create and maintain asyncpg connection pool.
    - Provide safe access to pool.
    - Provide controlled connection acquisition.
    - Close pool during shutdown.

    This class does NOT:
    - Execute SQL.
    - Contain business logic.
    - Interpret database errors.
    """

    _pool: Optional[asyncpg.Pool] = None

    # --------------------------------------------------
    # Initialization
    # --------------------------------------------------

    @classmethod
    async def initialize(cls) -> None:
        """
        Initialize asyncpg connection pool.

        Raises:
            RuntimeError: If pool creation fails.

        Execution Flow:
            1. Attempt to create pool.
            2. Validate connectivity with a simple query.
            3. Log success.
        """

        if cls._pool is not None:
            return

        try:
            cls._pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=1,
                max_size=5,  # Conservative for Supabase free-tier
                command_timeout=30,
                ssl="require",
            )

            # Connectivity validation
            async with cls._pool.acquire() as conn:
                await conn.execute("SELECT 1;")

            logger.info(
                "DB: connection pool initialized",
                extra={"environment": settings.environment},
            )

        except Exception as exc:
            logger.error(
                "DB: failed to initialize pool",
                extra={"error": str(exc)},
            )
            raise RuntimeError("Database initialization failed") from exc

    # --------------------------------------------------
    # Pool Accessor (NEW)
    # --------------------------------------------------

    @classmethod
    def get_pool(cls) -> asyncpg.Pool:
        """
        Return active asyncpg pool.

        Returns:
            asyncpg.Pool: Initialized connection pool.

        Raises:
            RuntimeError: If pool not initialized.

        Rationale:
            Service layer requires direct pool access
            for async context-managed acquisition:
                async with pool.acquire()
        """

        if cls._pool is None:
            raise RuntimeError("Database pool not initialized")

        return cls._pool

    # --------------------------------------------------
    # Manual Connection Handling (Optional Usage)
    # --------------------------------------------------

    @classmethod
    async def get_connection(cls) -> asyncpg.Connection:
        """
        Acquire a database connection from the pool.

        Returns:
            asyncpg.Connection: Active database connection.

        Raises:
            RuntimeError: If pool is not initialized.
        """

        if cls._pool is None:
            raise RuntimeError("Database pool not initialized")

        return await cls._pool.acquire()

    @classmethod
    async def release_connection(cls, connection: asyncpg.Connection) -> None:
        """
        Release a database connection back to the pool.

        Args:
            connection (asyncpg.Connection): Active connection.
        """

        if cls._pool is None:
            raise RuntimeError("Database pool not initialized")

        await cls._pool.release(connection)

    # --------------------------------------------------
    # Shutdown
    # --------------------------------------------------

    @classmethod
    async def close(cls) -> None:
        """
        Close the connection pool gracefully.

        Called during application shutdown.
        """

        if cls._pool is not None:
            await cls._pool.close()
            cls._pool = None

            logger.info(
                "DB: connection pool closed",
                extra={"environment": settings.environment},
            )