begin;

alter table library.university_documents
    add column if not exists original_filename text not null default '',
    add column if not exists bucket_name text not null default 'university-documents',
    add column if not exists storage_object_path text not null default '',
    add column if not exists mime_type text,
    add column if not exists file_size_bytes bigint,
    add column if not exists checksum_sha256 text,
    add column if not exists processing_status text not null default 'uploaded',
    add column if not exists indexing_error text,
    add column if not exists is_active boolean not null default true,
    add column if not exists updated_at timestamptz not null default now(),
    add column if not exists document_type text,
    add column if not exists audience_scope text,
    add column if not exists department text;

update library.university_documents
set
    original_filename = case
        when coalesce(original_filename, '') = '' then split_part(file_path, '/', array_length(string_to_array(file_path, '/'), 1))
        else original_filename
    end,
    storage_object_path = case
        when coalesce(storage_object_path, '') = '' then file_path
        else storage_object_path
    end,
    updated_at = coalesce(updated_at, created_at, now());

alter table library.university_documents
    drop constraint if exists university_documents_processing_status_check;

alter table library.university_documents
    add constraint university_documents_processing_status_check
    check (processing_status in ('uploaded', 'processing', 'indexed', 'failed'));

alter table library.document_chunks
    add column if not exists chunk_index integer not null default 0,
    add column if not exists section_label text,
    add column if not exists page_number integer,
    add column if not exists content_hash text,
    add column if not exists token_count integer;

create or replace function library.set_university_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_university_documents_updated_at on library.university_documents;

create trigger trg_university_documents_updated_at
before update on library.university_documents
for each row
execute function library.set_university_documents_updated_at();

create index if not exists idx_university_documents_processing_status
    on library.university_documents(processing_status);

create index if not exists idx_university_documents_is_active
    on library.university_documents(is_active);

create index if not exists idx_university_documents_uploaded_by
    on library.university_documents(uploaded_by);

create index if not exists idx_university_documents_checksum_sha256
    on library.university_documents(checksum_sha256);

create index if not exists idx_document_chunks_document_id
    on library.document_chunks(document_id);

create index if not exists idx_document_chunks_document_id_chunk_index
    on library.document_chunks(document_id, chunk_index);

commit;
