# apps/api/modules/circulation/service.py
"""
Staff circulation service layer for the
UAF Smart E-Library & University Information Assistant.

Responsibilities:
- Execute PostgreSQL RPC calls for staff circulation reads and actions.
- Set authenticated request identity in the database session context.
- Preserve deterministic database errors for truthful route-level mapping.

Architectural Constraints:
- No circulation business logic in Python.
- No raw circulation state transitions outside PostgreSQL RPCs.
- No authorization policy implemented in FastAPI.
- PostgreSQL remains the source of truth for circulation rules.
"""

from __future__ import annotations

import json
from typing import Any, Dict
from uuid import UUID

import asyncpg

from core.database import Database
from core.logging import get_logger
from modules.circulation.schemas import (
    AdjustDueDateRequest,
    StaffCirculationLoanListQueryParams,
)

logger = get_logger(__name__)


class CirculationService:
    @staticmethod
    async def get_loans(
        user_id: str,
        query: StaffCirculationLoanListQueryParams,
    ) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                raw = await connection.fetchval(
                    """
                    select library.get_staff_circulation_loans(
                        $1::uuid,
                        $2::text,
                        $3::text,
                        $4::library.role_enum,
                        $5::library.book_status_enum,
                        $6::timestamptz,
                        $7::timestamptz,
                        $8::integer,
                        $9::integer
                    )
                    """,
                    user_id,
                    query.scope,
                    query.search,
                    query.role,
                    query.book_status,
                    query.due_from,
                    query.due_to,
                    query.limit,
                    query.offset,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "CIRCULATION: list RPC failed",
                extra={
                    "user_id": user_id,
                    "scope": query.scope,
                    "search": query.search,
                    "role_filter": query.role,
                    "book_status": query.book_status,
                    "due_from": (
                        query.due_from.isoformat() if query.due_from else None
                    ),
                    "due_to": query.due_to.isoformat() if query.due_to else None,
                    "limit": query.limit,
                    "offset": query.offset,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return CirculationService._normalize_jsonb_mapping(
            raw,
            null_message="Staff circulation RPC returned null",
            invalid_json_message="Staff circulation RPC returned invalid JSON",
            invalid_shape_message="Staff circulation RPC returned non-object JSON",
            unexpected_type_message="Staff circulation RPC returned unexpected payload type",
            log_context={
                "user_id": user_id,
                "scope": query.scope,
                "search": query.search,
                "role_filter": query.role,
                "book_status": query.book_status,
                "limit": query.limit,
                "offset": query.offset,
            },
        )

    @staticmethod
    async def get_loan_by_id(user_id: str, transaction_id: UUID) -> Dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )

                row = await connection.fetchrow(
                    """
                    select *
                    from library.get_staff_circulation_loan_detail(
                        $1::uuid,
                        $2::uuid
                    )
                    """,
                    user_id,
                    transaction_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "CIRCULATION: detail RPC failed",
                extra={
                    "user_id": user_id,
                    "transaction_id": str(transaction_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Loan not found")

        return dict(row)

    @staticmethod
    async def adjust_due_date(
        user_id: str,
        transaction_id: UUID,
        payload: AdjustDueDateRequest,
    ) -> None:
        await CirculationService._execute_void_rpc(
            user_id=user_id,
            action="adjust due date",
            query="""
                select library.adjust_loan_due_date(
                    $1::uuid,
                    $2::uuid,
                    $3::timestamptz
                );
            """,
            parameters=(user_id, transaction_id, payload.due_date),
            log_context={
                "transaction_id": str(transaction_id),
                "due_date": payload.due_date.isoformat(),
            },
        )

    @staticmethod
    async def return_loan(user_id: str, transaction_id: UUID) -> None:
        await CirculationService._execute_void_rpc(
            user_id=user_id,
            action="return loan",
            query="""
                select library.return_loan_by_transaction(
                    $1::uuid,
                    $2::uuid
                );
            """,
            parameters=(user_id, transaction_id),
            log_context={"transaction_id": str(transaction_id)},
        )

    @staticmethod
    async def renew_loan(user_id: str, transaction_id: UUID) -> None:
        await CirculationService._execute_void_rpc(
            user_id=user_id,
            action="renew loan",
            query="""
                select library.renew_loan_by_transaction(
                    $1::uuid,
                    $2::uuid
                );
            """,
            parameters=(user_id, transaction_id),
            log_context={"transaction_id": str(transaction_id)},
        )

    @staticmethod
    async def _execute_void_rpc(
        *,
        user_id: str,
        action: str,
        query: str,
        parameters: tuple[Any, ...],
        log_context: Dict[str, Any],
    ) -> None:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await connection.execute(
                    "select set_config('request.jwt.claim.sub', $1, true)",
                    user_id,
                )
                await connection.execute(query, *parameters)
        except asyncpg.PostgresError as exc:
            logger.error(
                f"CIRCULATION: {action} RPC failed",
                extra={
                    "user_id": user_id,
                    **log_context,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

    @staticmethod
    def _normalize_jsonb_mapping(
        raw: Any,
        *,
        null_message: str,
        invalid_json_message: str,
        invalid_shape_message: str,
        unexpected_type_message: str,
        log_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        if raw is None:
            logger.error("CIRCULATION: jsonb RPC returned null", extra=log_context)
            raise RuntimeError(null_message)

        if isinstance(raw, dict):
            return raw

        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as exc:
                logger.error(
                    "CIRCULATION: failed to decode jsonb RPC payload",
                    extra={
                        **log_context,
                        "error": str(exc),
                        "raw_preview": raw[:200],
                    },
                )
                raise RuntimeError(invalid_json_message) from exc

            if not isinstance(parsed, dict):
                logger.error(
                    "CIRCULATION: decoded jsonb payload is not an object",
                    extra={
                        **log_context,
                        "decoded_type": type(parsed).__name__,
                    },
                )
                raise RuntimeError(invalid_shape_message)

            return parsed

        logger.error(
            "CIRCULATION: unexpected jsonb RPC return type",
            extra={
                **log_context,
                "return_type": type(raw).__name__,
            },
        )
        raise RuntimeError(unexpected_type_message)
