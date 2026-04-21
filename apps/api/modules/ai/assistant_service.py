# apps/api/modules/ai/assistant_service.py
"""
Conversation orchestration service for the AI assistant module.

Responsibilities:
- Enforce authenticated owner access for assistant conversations.
- Persist assistant conversations, messages, and citations in PostgreSQL.
- Reuse the existing retrieval and grounded-generation stack for each turn.
- Keep route handlers thin and return normalized conversation/message payloads.
"""

from typing import Any, Optional
from uuid import UUID

import asyncpg

from core.database import Database
from core.logging import get_logger
from modules.ai.service import AIService
from services.retrieval_service import RetrievalService

logger = get_logger(__name__)
MAX_TITLE_CHARS = 160
MAX_PREVIEW_CHARS = 140
RECENT_HISTORY_LIMIT = 8


class AssistantService:
    @staticmethod
    async def list_conversations(user_id: str) -> list[dict[str, Any]]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await AssistantService._set_request_identity(connection, user_id)
                rows = await connection.fetch(
                    """
                    select
                        c.id,
                        c.title,
                        c.created_at,
                        c.updated_at,
                        c.last_message_at,
                        case
                            when coalesce(lam.content, lm.content) is null then null
                            when char_length(coalesce(lam.content, lm.content)) > $2::integer
                                then left(coalesce(lam.content, lm.content), $2::integer - 3) || '...'
                            else coalesce(lam.content, lm.content)
                        end as last_message_preview
                    from library.ai_conversations c
                    left join lateral (
                        select m.content
                        from library.ai_messages m
                        where m.conversation_id = c.id
                          and m.role = 'assistant'
                        order by m.created_at desc, m.id desc
                        limit 1
                    ) lam on true
                    left join lateral (
                        select m.content
                        from library.ai_messages m
                        where m.conversation_id = c.id
                        order by m.created_at desc, m.id desc
                        limit 1
                    ) lm on true
                    where c.owner_user_id = $1::uuid
                    order by c.last_message_at desc, c.id desc
                    """,
                    user_id,
                    MAX_PREVIEW_CHARS,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: list conversations failed",
                extra={
                    "user_id": user_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return [dict(row) for row in rows]

    @staticmethod
    async def get_conversation(
        user_id: str,
        conversation_id: UUID,
    ) -> dict[str, Any]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await AssistantService._set_request_identity(connection, user_id)
                row = await AssistantService._fetch_conversation_summary_row(
                    connection,
                    user_id=user_id,
                    conversation_id=conversation_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: get conversation failed",
                extra={
                    "user_id": user_id,
                    "conversation_id": str(conversation_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Conversation not found")

        return dict(row)

    @staticmethod
    async def get_messages(
        user_id: str,
        conversation_id: UUID,
    ) -> list[dict[str, Any]]:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await AssistantService._set_request_identity(connection, user_id)
                await AssistantService._require_conversation_owner(
                    connection,
                    user_id=user_id,
                    conversation_id=conversation_id,
                )

                message_rows = await connection.fetch(
                    """
                    select
                        id,
                        conversation_id,
                        role::text as role,
                        content,
                        intent_profile,
                        fallback_used,
                        retrieved_chunks_count,
                        created_at
                    from library.ai_messages
                    where conversation_id = $1::uuid
                    order by created_at asc, id asc
                    """,
                    conversation_id,
                )

                message_ids = [row["id"] for row in message_rows]
                citations_by_message = await AssistantService._fetch_citations_by_message(
                    connection,
                    message_ids,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: get messages failed",
                extra={
                    "user_id": user_id,
                    "conversation_id": str(conversation_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return [
            AssistantService._build_message_payload(
                dict(row),
                citations_by_message.get(row["id"], []),
            )
            for row in message_rows
        ]

    @staticmethod
    async def rename_conversation(
        user_id: str,
        conversation_id: UUID,
        title: str,
    ) -> dict[str, Any]:
        normalized_title = AssistantService._normalize_title(title)
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await AssistantService._set_request_identity(connection, user_id)
                await AssistantService._require_conversation_owner(
                    connection,
                    user_id=user_id,
                    conversation_id=conversation_id,
                )
                await connection.execute(
                    """
                    update library.ai_conversations
                    set title = $2::text
                    where id = $1::uuid
                    """,
                    conversation_id,
                    normalized_title,
                )
                row = await AssistantService._fetch_conversation_summary_row(
                    connection,
                    user_id=user_id,
                    conversation_id=conversation_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: rename conversation failed",
                extra={
                    "user_id": user_id,
                    "conversation_id": str(conversation_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if row is None:
            raise RuntimeError("Conversation not found")

        return dict(row)

    @staticmethod
    async def delete_conversation(
        user_id: str,
        conversation_id: UUID,
    ) -> None:
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await AssistantService._set_request_identity(connection, user_id)
                result = await connection.execute(
                    """
                    delete from library.ai_conversations
                    where id = $1::uuid
                      and owner_user_id = $2::uuid
                    """,
                    conversation_id,
                    user_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: delete conversation failed",
                extra={
                    "user_id": user_id,
                    "conversation_id": str(conversation_id),
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if result.endswith("0"):
            raise RuntimeError("Conversation not found")

    @staticmethod
    async def create_conversation_turn(
        *,
        user_id: str,
        request_id: Optional[str],
        query: str,
    ) -> dict[str, Any]:
        normalized_query = RetrievalService.normalize_assistant_query(query)
        generated_turn = await AIService.generate_assistant_turn(
            user_id=user_id,
            request_id=request_id,
            query=normalized_query,
            conversation_messages=[],
        )
        conversation_title = AssistantService._build_conversation_title(normalized_query)
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await AssistantService._set_request_identity(connection, user_id)

                    conversation_row = await connection.fetchrow(
                        """
                        insert into library.ai_conversations (
                            owner_user_id,
                            title,
                            last_message_at
                        )
                        values (
                            $1::uuid,
                            $2::text,
                            now()
                        )
                        returning
                            id,
                            title,
                            created_at,
                            updated_at,
                            last_message_at
                        """,
                        user_id,
                        conversation_title,
                    )

                    conversation_id = conversation_row["id"]
                    user_message_row = await AssistantService._insert_message(
                        connection,
                        conversation_id=conversation_id,
                        role="user",
                        content=normalized_query,
                    )
                    assistant_message_row = await AssistantService._insert_message(
                        connection,
                        conversation_id=conversation_id,
                        role="assistant",
                        content=generated_turn["answer"],
                        intent_profile=generated_turn["intent_profile"],
                        fallback_used=generated_turn["fallback_used"],
                        retrieved_chunks_count=generated_turn["retrieved_chunks_count"],
                    )
                    await AssistantService._insert_citations(
                        connection,
                        message_id=assistant_message_row["id"],
                        citations=generated_turn["citations"],
                    )
                    await connection.execute(
                        """
                        update library.ai_conversations
                        set last_message_at = $2::timestamptz
                        where id = $1::uuid
                        """,
                        conversation_id,
                        assistant_message_row["created_at"],
                    )
                    summary_row = await AssistantService._fetch_conversation_summary_row(
                        connection,
                        user_id=user_id,
                        conversation_id=conversation_id,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: create conversation turn failed",
                extra={
                    "user_id": user_id,
                    "request_id": request_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        return {
            "conversation": dict(summary_row) if summary_row is not None else dict(conversation_row),
            "user_message": AssistantService._build_message_payload(
                dict(user_message_row),
                [],
            ),
            "assistant_message": AssistantService._build_message_payload(
                dict(assistant_message_row),
                generated_turn["citations"],
            ),
        }

    @staticmethod
    async def append_conversation_turn(
        *,
        user_id: str,
        request_id: Optional[str],
        conversation_id: UUID,
        query: str,
    ) -> dict[str, Any]:
        normalized_query = RetrievalService.normalize_assistant_query(query)
        pool = Database.get_pool()

        try:
            async with pool.acquire() as connection:
                await AssistantService._set_request_identity(connection, user_id)
                await AssistantService._require_conversation_owner(
                    connection,
                    user_id=user_id,
                    conversation_id=conversation_id,
                )
                recent_messages = await AssistantService._fetch_recent_messages(
                    connection,
                    conversation_id=conversation_id,
                )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: load append conversation context failed",
                extra={
                    "user_id": user_id,
                    "conversation_id": str(conversation_id),
                    "request_id": request_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        generated_turn = await AIService.generate_assistant_turn(
            user_id=user_id,
            request_id=request_id,
            query=normalized_query,
            conversation_messages=recent_messages,
        )

        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    await AssistantService._set_request_identity(connection, user_id)
                    await AssistantService._require_conversation_owner(
                        connection,
                        user_id=user_id,
                        conversation_id=conversation_id,
                    )

                    user_message_row = await AssistantService._insert_message(
                        connection,
                        conversation_id=conversation_id,
                        role="user",
                        content=normalized_query,
                    )
                    assistant_message_row = await AssistantService._insert_message(
                        connection,
                        conversation_id=conversation_id,
                        role="assistant",
                        content=generated_turn["answer"],
                        intent_profile=generated_turn["intent_profile"],
                        fallback_used=generated_turn["fallback_used"],
                        retrieved_chunks_count=generated_turn["retrieved_chunks_count"],
                    )
                    await AssistantService._insert_citations(
                        connection,
                        message_id=assistant_message_row["id"],
                        citations=generated_turn["citations"],
                    )
                    await connection.execute(
                        """
                        update library.ai_conversations
                        set last_message_at = $2::timestamptz
                        where id = $1::uuid
                        """,
                        conversation_id,
                        assistant_message_row["created_at"],
                    )
                    summary_row = await AssistantService._fetch_conversation_summary_row(
                        connection,
                        user_id=user_id,
                        conversation_id=conversation_id,
                    )
        except asyncpg.PostgresError as exc:
            logger.error(
                "AI: append conversation turn failed",
                extra={
                    "user_id": user_id,
                    "conversation_id": str(conversation_id),
                    "request_id": request_id,
                    "sqlstate": exc.sqlstate,
                    "error": str(exc),
                },
            )
            raise RuntimeError(str(exc)) from exc

        if summary_row is None:
            raise RuntimeError("Conversation not found")

        return {
            "conversation": dict(summary_row),
            "user_message": AssistantService._build_message_payload(
                dict(user_message_row),
                [],
            ),
            "assistant_message": AssistantService._build_message_payload(
                dict(assistant_message_row),
                generated_turn["citations"],
            ),
        }

    @staticmethod
    async def _set_request_identity(
        connection: asyncpg.Connection,
        user_id: str,
    ) -> None:
        await connection.execute(
            "select set_config('request.jwt.claim.sub', $1, true)",
            user_id,
        )

    @staticmethod
    async def _require_conversation_owner(
        connection: asyncpg.Connection,
        *,
        user_id: str,
        conversation_id: UUID,
    ) -> None:
        owner_id = await connection.fetchval(
            """
            select owner_user_id
            from library.ai_conversations
            where id = $1::uuid
            """,
            conversation_id,
        )

        if owner_id is None or str(owner_id) != user_id:
            raise RuntimeError("Conversation not found")

    @staticmethod
    async def _fetch_recent_messages(
        connection: asyncpg.Connection,
        *,
        conversation_id: UUID,
    ) -> list[dict[str, Any]]:
        rows = await connection.fetch(
            """
            select role::text as role, content
            from library.ai_messages
            where conversation_id = $1::uuid
            order by created_at desc, id desc
            limit $2::integer
            """,
            conversation_id,
            RECENT_HISTORY_LIMIT,
        )

        return [dict(row) for row in reversed(rows)]

    @staticmethod
    async def _fetch_conversation_summary_row(
        connection: asyncpg.Connection,
        *,
        user_id: str,
        conversation_id: UUID,
    ) -> Optional[asyncpg.Record]:
        return await connection.fetchrow(
            """
            select
                c.id,
                c.title,
                c.created_at,
                c.updated_at,
                c.last_message_at,
                case
                    when coalesce(lam.content, lm.content) is null then null
                    when char_length(coalesce(lam.content, lm.content)) > $3::integer
                        then left(coalesce(lam.content, lm.content), $3::integer - 3) || '...'
                    else coalesce(lam.content, lm.content)
                end as last_message_preview
            from library.ai_conversations c
            left join lateral (
                select m.content
                from library.ai_messages m
                where m.conversation_id = c.id
                  and m.role = 'assistant'
                order by m.created_at desc, m.id desc
                limit 1
            ) lam on true
            left join lateral (
                select m.content
                from library.ai_messages m
                where m.conversation_id = c.id
                order by m.created_at desc, m.id desc
                limit 1
            ) lm on true
            where c.id = $1::uuid
              and c.owner_user_id = $2::uuid
            """,
            conversation_id,
            user_id,
            MAX_PREVIEW_CHARS,
        )

    @staticmethod
    async def _insert_message(
        connection: asyncpg.Connection,
        *,
        conversation_id: UUID,
        role: str,
        content: str,
        intent_profile: Optional[str] = None,
        fallback_used: Optional[bool] = None,
        retrieved_chunks_count: Optional[int] = None,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            insert into library.ai_messages (
                conversation_id,
                role,
                content,
                intent_profile,
                fallback_used,
                retrieved_chunks_count
            )
            values (
                $1::uuid,
                $2::library.ai_message_role_enum,
                $3::text,
                $4::text,
                $5::boolean,
                $6::integer
            )
            returning
                id,
                conversation_id,
                role::text as role,
                content,
                intent_profile,
                fallback_used,
                retrieved_chunks_count,
                created_at
            """,
            conversation_id,
            role,
            content,
            intent_profile,
            fallback_used,
            retrieved_chunks_count,
        )

    @staticmethod
    async def _insert_citations(
        connection: asyncpg.Connection,
        *,
        message_id: UUID,
        citations: list[dict[str, Any]],
    ) -> None:
        if not citations:
            return

        await connection.executemany(
            """
            insert into library.ai_message_citations (
                message_id,
                document_id,
                document_title,
                original_filename,
                chunk_id,
                chunk_index,
                section_label,
                page_number,
                similarity_score,
                rank,
                content_hash
            )
            values (
                $1::uuid,
                $2::uuid,
                $3::text,
                $4::text,
                $5::uuid,
                $6::integer,
                $7::text,
                $8::integer,
                $9::numeric,
                $10::integer,
                $11::text
            )
            """,
            [
                (
                    message_id,
                    citation["document_id"],
                    citation["document_title"],
                    citation["original_filename"],
                    citation["chunk_id"],
                    citation["chunk_index"],
                    citation.get("section_label"),
                    citation.get("page_number"),
                    citation["similarity_score"],
                    citation["rank"],
                    citation.get("content_hash"),
                )
                for citation in citations
            ],
        )

    @staticmethod
    async def _fetch_citations_by_message(
        connection: asyncpg.Connection,
        message_ids: list[UUID],
    ) -> dict[UUID, list[dict[str, Any]]]:
        if not message_ids:
            return {}

        rows = await connection.fetch(
            """
            select
                message_id,
                document_id,
                document_title,
                original_filename,
                chunk_id,
                chunk_index,
                section_label,
                page_number,
                similarity_score::double precision as similarity_score,
                rank
            from library.ai_message_citations
            where message_id = any($1::uuid[])
            order by rank asc, id asc
            """,
            message_ids,
        )

        citations_by_message: dict[UUID, list[dict[str, Any]]] = {}

        for row in rows:
            message_id = row["message_id"]
            citations_by_message.setdefault(message_id, []).append(
                {
                    "document_id": row["document_id"],
                    "document_title": row["document_title"],
                    "original_filename": row["original_filename"],
                    "chunk_id": row["chunk_id"],
                    "chunk_index": row["chunk_index"],
                    "section_label": row["section_label"],
                    "page_number": row["page_number"],
                    "similarity_score": row["similarity_score"],
                    "rank": row["rank"],
                }
            )

        return citations_by_message

    @staticmethod
    def _build_message_payload(
        message_row: dict[str, Any],
        citations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "id": message_row["id"],
            "role": message_row["role"],
            "content": message_row["content"],
            "intent_profile": message_row.get("intent_profile"),
            "fallback_used": message_row.get("fallback_used"),
            "retrieved_chunks_count": message_row.get("retrieved_chunks_count"),
            "created_at": message_row["created_at"],
            "citations": citations,
        }

    @staticmethod
    def _build_conversation_title(query: str) -> str:
        normalized = RetrievalService.normalize_assistant_query(query)
        trimmed = normalized.rstrip("?.! ")

        if not trimmed:
            return "New Conversation"

        short_greetings = {"hi", "hello", "hey", "ok", "okay", "thanks", "thank you"}
        if trimmed.lower() in short_greetings:
            return "New Conversation"

        if len(trimmed) <= MAX_TITLE_CHARS:
            return trimmed

        candidate = trimmed[: MAX_TITLE_CHARS - 3].rstrip()
        if " " in candidate:
            candidate = candidate.rsplit(" ", 1)[0].rstrip()

        return f"{candidate}..."

    @staticmethod
    def _normalize_title(title: str) -> str:
        normalized = " ".join(title.strip().split())

        if not normalized:
            raise RuntimeError("Title is required")

        if len(normalized) > MAX_TITLE_CHARS:
            raise RuntimeError("Title is too long")

        return normalized
