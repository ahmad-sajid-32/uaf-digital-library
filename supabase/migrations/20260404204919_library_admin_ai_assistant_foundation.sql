begin;

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
        create type library.ai_message_role_enum as enum ('user', 'assistant');
    end if;
end;
$$;

create table if not exists library.ai_conversations (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references library.profiles(id) on delete cascade,
    title text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_message_at timestamptz not null default now(),
    constraint ai_conversations_title_not_blank
        check (char_length(btrim(title)) between 1 and 160)
);

create table if not exists library.ai_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references library.ai_conversations(id) on delete cascade,
    role library.ai_message_role_enum not null,
    content text not null,
    intent_profile text,
    fallback_used boolean,
    retrieved_chunks_count integer,
    created_at timestamptz not null default now(),
    constraint ai_messages_content_not_blank
        check (char_length(btrim(content)) > 0),
    constraint ai_messages_retrieved_chunks_count_non_negative
        check (retrieved_chunks_count is null or retrieved_chunks_count >= 0)
);

create table if not exists library.ai_message_citations (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references library.ai_messages(id) on delete cascade,
    document_id uuid references library.university_documents(id) on delete set null,
    document_title text not null,
    original_filename text not null,
    chunk_id uuid references library.document_chunks(id) on delete set null,
    chunk_index integer not null,
    section_label text,
    page_number integer,
    similarity_score numeric(6,5) not null,
    rank integer not null,
    content_hash text,
    created_at timestamptz not null default now(),
    constraint ai_message_citations_chunk_index_non_negative
        check (chunk_index >= 0),
    constraint ai_message_citations_rank_positive
        check (rank > 0),
    constraint ai_message_citations_page_number_positive
        check (page_number is null or page_number > 0),
    constraint ai_message_citations_similarity_score_range
        check (similarity_score >= 0 and similarity_score <= 1)
);

create or replace function library.set_ai_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_ai_conversations_updated_at on library.ai_conversations;

create trigger trg_ai_conversations_updated_at
before update on library.ai_conversations
for each row
execute function library.set_ai_conversations_updated_at();

create index if not exists idx_ai_conversations_owner_last_message_at
    on library.ai_conversations (owner_user_id, last_message_at desc, id desc);

create index if not exists idx_ai_messages_conversation_created_at
    on library.ai_messages (conversation_id, created_at asc, id asc);

create index if not exists idx_ai_message_citations_message_rank
    on library.ai_message_citations (message_id, rank asc);

alter table library.ai_conversations enable row level security;
alter table library.ai_messages enable row level security;
alter table library.ai_message_citations enable row level security;

alter table library.ai_conversations force row level security;
alter table library.ai_messages force row level security;
alter table library.ai_message_citations force row level security;

revoke all on table library.ai_conversations from public;
revoke all on table library.ai_messages from public;
revoke all on table library.ai_message_citations from public;

drop policy if exists admin_owner_manage_ai_conversations on library.ai_conversations;
create policy admin_owner_manage_ai_conversations
on library.ai_conversations
for all
using (
    owner_user_id = auth.uid()
    and exists (
        select 1
        from library.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
    )
)
with check (
    owner_user_id = auth.uid()
    and exists (
        select 1
        from library.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
    )
);

drop policy if exists admin_owner_manage_ai_messages on library.ai_messages;
create policy admin_owner_manage_ai_messages
on library.ai_messages
for all
using (
    exists (
        select 1
        from library.ai_conversations c
        join library.profiles p
            on p.id = auth.uid()
        where c.id = conversation_id
          and c.owner_user_id = auth.uid()
          and p.role = 'admin'
    )
)
with check (
    exists (
        select 1
        from library.ai_conversations c
        join library.profiles p
            on p.id = auth.uid()
        where c.id = conversation_id
          and c.owner_user_id = auth.uid()
          and p.role = 'admin'
    )
);

drop policy if exists admin_owner_manage_ai_message_citations on library.ai_message_citations;
create policy admin_owner_manage_ai_message_citations
on library.ai_message_citations
for all
using (
    exists (
        select 1
        from library.ai_messages m
        join library.ai_conversations c
            on c.id = m.conversation_id
        join library.profiles p
            on p.id = auth.uid()
        where m.id = message_id
          and c.owner_user_id = auth.uid()
          and p.role = 'admin'
    )
)
with check (
    exists (
        select 1
        from library.ai_messages m
        join library.ai_conversations c
            on c.id = m.conversation_id
        join library.profiles p
            on p.id = auth.uid()
        where m.id = message_id
          and c.owner_user_id = auth.uid()
          and p.role = 'admin'
    )
);

commit;
