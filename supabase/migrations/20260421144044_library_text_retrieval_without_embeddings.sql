begin;

create extension if not exists pg_trgm;

create index if not exists idx_document_chunks_content_fts
    on library.document_chunks
    using gin (to_tsvector('english', coalesce(content, '')));

create index if not exists idx_document_chunks_section_label_fts
    on library.document_chunks
    using gin (to_tsvector('english', coalesce(section_label, '')));

create index if not exists idx_university_documents_title_fts
    on library.university_documents
    using gin (to_tsvector('english', coalesce(title, '')));

create index if not exists idx_document_chunks_content_trgm
    on library.document_chunks
    using gin (lower(content) gin_trgm_ops);

create index if not exists idx_document_chunks_section_label_trgm
    on library.document_chunks
    using gin (lower(section_label) gin_trgm_ops);

create index if not exists idx_university_documents_title_trgm
    on library.university_documents
    using gin (lower(title) gin_trgm_ops);

drop function if exists library.search_university_document_chunks_text(
    text,
    integer,
    double precision,
    text,
    text,
    text
);

create or replace function library.search_university_document_chunks_text(
    p_query text,
    p_match_count integer default 5,
    p_similarity_threshold double precision default 0.70,
    p_document_type text default null,
    p_audience_scope text default null,
    p_department text default null
)
returns table (
    document_id uuid,
    document_title text,
    original_filename text,
    document_type text,
    audience_scope text,
    department text,
    chunk_id uuid,
    chunk_index integer,
    section_label text,
    page_number integer,
    content text,
    content_hash text,
    token_count integer,
    similarity_score double precision
)
language sql
stable
set search_path = library, public
as $$
with normalized as (
    select trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')) as query_text
),
query_terms as (
    select
        query_text,
        plainto_tsquery('english', query_text) as ts_query
    from normalized
),
candidates as (
    select
        d.id as document_id,
        d.title as document_title,
        d.original_filename,
        d.document_type,
        d.audience_scope,
        d.department,
        c.id as chunk_id,
        c.chunk_index,
        c.section_label,
        c.page_number,
        c.content,
        c.content_hash,
        c.token_count,
        greatest(
            ts_rank_cd(
                setweight(to_tsvector('english', coalesce(d.title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(c.section_label, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(c.content, '')), 'C'),
                qt.ts_query
            ),
            similarity(lower(coalesce(c.section_label, '')), lower(qt.query_text)) * 0.80 +
            similarity(lower(coalesce(d.title, '')), lower(qt.query_text)) * 0.40 +
            similarity(lower(coalesce(c.content, '')), lower(qt.query_text)) * 0.20
        )::double precision as similarity_score
    from library.document_chunks c
    join library.university_documents d
        on d.id = c.document_id
    cross join query_terms qt
    where
        d.is_active = true
        and d.processing_status = 'indexed'
        and (p_document_type is null or d.document_type = p_document_type)
        and (p_audience_scope is null or d.audience_scope = p_audience_scope)
        and (p_department is null or d.department = p_department)
        and (
            (
                setweight(to_tsvector('english', coalesce(d.title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(c.section_label, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(c.content, '')), 'C')
            ) @@ qt.ts_query
            or similarity(lower(coalesce(c.section_label, '')), lower(qt.query_text)) > 0.08
            or similarity(lower(coalesce(d.title, '')), lower(qt.query_text)) > 0.08
            or similarity(lower(coalesce(c.content, '')), lower(qt.query_text)) > 0.08
        )
)
select
    document_id,
    document_title,
    original_filename,
    document_type,
    audience_scope,
    department,
    chunk_id,
    chunk_index,
    section_label,
    page_number,
    content,
    content_hash,
    token_count,
    similarity_score
from candidates
where similarity_score >= greatest(p_similarity_threshold * 0.35, 0.02)
order by similarity_score desc, chunk_index asc
limit greatest(p_match_count, 1);
$$;

commit;
