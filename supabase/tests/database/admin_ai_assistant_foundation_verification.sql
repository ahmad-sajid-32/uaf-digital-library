-- supabase/tests/database/admin_ai_assistant_foundation_verification.sql
--
-- Verification script for the Admin AI Assistant database foundation.
--
-- Purpose:
-- - Assert that the assistant enum, tables, indexes, and RLS policies exist.
-- - Assert that assistant ownership and citation-retention foreign keys use the
--   expected delete behavior.
-- - Provide a tracked database verification artifact instead of relying on
--   ad-hoc manual inspection.

do $$
begin
    if not exists (
        select 1
        from pg_type t
        join pg_namespace n
            on n.oid = t.typnamespace
        where n.nspname = 'library'
          and t.typname = 'ai_message_role_enum'
    ) then
        raise exception 'Verification failed: library.ai_message_role_enum is missing';
    end if;

    if not exists (
        select 1
        from pg_class c
        join pg_namespace n
            on n.oid = c.relnamespace
        where n.nspname = 'library'
          and c.relname = 'ai_conversations'
          and c.relkind = 'r'
    ) then
        raise exception 'Verification failed: library.ai_conversations is missing';
    end if;

    if not exists (
        select 1
        from pg_class c
        join pg_namespace n
            on n.oid = c.relnamespace
        where n.nspname = 'library'
          and c.relname = 'ai_messages'
          and c.relkind = 'r'
    ) then
        raise exception 'Verification failed: library.ai_messages is missing';
    end if;

    if not exists (
        select 1
        from pg_class c
        join pg_namespace n
            on n.oid = c.relnamespace
        where n.nspname = 'library'
          and c.relname = 'ai_message_citations'
          and c.relkind = 'r'
    ) then
        raise exception 'Verification failed: library.ai_message_citations is missing';
    end if;
end;
$$;

do $$
begin
    if exists (
        select 1
        from pg_attribute
        where attrelid = 'library.ai_conversations'::regclass
          and attname = 'is_archived'
          and not attisdropped
    ) then
        raise exception 'Verification failed: ai_conversations.is_archived should not exist in the first-pass hard-delete contract';
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_class c
        where c.oid = 'library.ai_conversations'::regclass
          and c.relrowsecurity = true
          and c.relforcerowsecurity = true
    ) then
        raise exception 'Verification failed: ai_conversations RLS is not fully enabled';
    end if;

    if not exists (
        select 1
        from pg_class c
        where c.oid = 'library.ai_messages'::regclass
          and c.relrowsecurity = true
          and c.relforcerowsecurity = true
    ) then
        raise exception 'Verification failed: ai_messages RLS is not fully enabled';
    end if;

    if not exists (
        select 1
        from pg_class c
        where c.oid = 'library.ai_message_citations'::regclass
          and c.relrowsecurity = true
          and c.relforcerowsecurity = true
    ) then
        raise exception 'Verification failed: ai_message_citations RLS is not fully enabled';
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'library'
          and tablename = 'ai_conversations'
          and policyname = 'admin_owner_manage_ai_conversations'
    ) then
        raise exception 'Verification failed: conversation ownership policy is missing';
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'library'
          and tablename = 'ai_messages'
          and policyname = 'admin_owner_manage_ai_messages'
    ) then
        raise exception 'Verification failed: message ownership policy is missing';
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'library'
          and tablename = 'ai_message_citations'
          and policyname = 'admin_owner_manage_ai_message_citations'
    ) then
        raise exception 'Verification failed: citation ownership policy is missing';
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_indexes
        where schemaname = 'library'
          and indexname = 'idx_ai_conversations_owner_last_message_at'
    ) then
        raise exception 'Verification failed: conversation ordering index is missing';
    end if;

    if not exists (
        select 1
        from pg_indexes
        where schemaname = 'library'
          and indexname = 'idx_ai_messages_conversation_created_at'
    ) then
        raise exception 'Verification failed: message ordering index is missing';
    end if;

    if not exists (
        select 1
        from pg_indexes
        where schemaname = 'library'
          and indexname = 'idx_ai_message_citations_message_rank'
    ) then
        raise exception 'Verification failed: citation ordering index is missing';
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'library.ai_messages'::regclass
          and contype = 'f'
          and confrelid = 'library.ai_conversations'::regclass
          and confdeltype = 'c'
    ) then
        raise exception 'Verification failed: ai_messages -> ai_conversations must cascade on delete';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'library.ai_message_citations'::regclass
          and contype = 'f'
          and confrelid = 'library.ai_messages'::regclass
          and confdeltype = 'c'
    ) then
        raise exception 'Verification failed: ai_message_citations -> ai_messages must cascade on delete';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'library.ai_message_citations'::regclass
          and contype = 'f'
          and confrelid = 'library.university_documents'::regclass
          and confdeltype = 'n'
    ) then
        raise exception 'Verification failed: ai_message_citations.document_id must use on delete set null';
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'library.ai_message_citations'::regclass
          and contype = 'f'
          and confrelid = 'library.document_chunks'::regclass
          and confdeltype = 'n'
    ) then
        raise exception 'Verification failed: ai_message_citations.chunk_id must use on delete set null';
    end if;
end;
$$;

select 'admin_ai_assistant_foundation_verification: ok' as verification_status;
