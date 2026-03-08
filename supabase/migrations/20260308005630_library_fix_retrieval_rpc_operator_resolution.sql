create or replace function library.search_university_document_chunks(
    p_query_embedding extensions.vector,
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
language plpgsql
set search_path = library, extensions, public
as $$
declare
    v_match_count integer;
    v_similarity_threshold double precision;
begin
    v_match_count := greatest(1, least(coalesce(p_match_count, 5), 12));
    v_similarity_threshold := greatest(
        0::double precision,
        least(coalesce(p_similarity_threshold, 0.70), 1::double precision)
    );

    return query
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
        1 - (c.embedding <=> p_query_embedding) as similarity_score
    from library.document_chunks c
    join library.university_documents d
        on d.id = c.document_id
    where d.is_active = true
      and d.processing_status = 'indexed'
      and (p_document_type is null or d.document_type = p_document_type)
      and (p_audience_scope is null or d.audience_scope = p_audience_scope)
      and (p_department is null or d.department = p_department)
      and 1 - (c.embedding <=> p_query_embedding) >= v_similarity_threshold
    order by c.embedding <=> p_query_embedding asc
    limit v_match_count;
end;
$$;
