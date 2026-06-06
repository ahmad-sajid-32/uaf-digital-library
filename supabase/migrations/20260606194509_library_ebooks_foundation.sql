-- E-Books foundation: isolated free-only digital reading domain.

begin;

create type library.ebook_status_enum as enum ('draft', 'published', 'archived');
create type library.ebook_file_status_enum as enum ('uploaded', 'ready', 'failed');
create type library.ebook_file_format_enum as enum ('pdf', 'epub');
create type library.ebook_access_scope_enum as enum (
  'all_authenticated',
  'students_only',
  'staff_only'
);
create type library.ebook_access_event_type_enum as enum ('preview', 'download');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ebooks-private',
  'ebooks-private',
  false,
  52428800,
  array['application/pdf', 'application/epub+zip']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ebook-covers',
  'ebook-covers',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

create table library.ebooks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  subtitle text,
  authors text not null check (length(trim(authors)) > 0),
  description text,
  isbn text,
  publisher text,
  publication_year integer check (
    publication_year is null
    or publication_year between 1000 and extract(year from now())::integer + 1
  ),
  edition text,
  language text not null default 'English' check (length(trim(language)) > 0),
  category library.book_category_enum not null,
  keywords text[] not null default '{}',
  linked_book_id uuid references library.books(id) on delete set null,
  status library.ebook_status_enum not null default 'draft',
  access_scope library.ebook_access_scope_enum not null default 'all_authenticated',
  allow_preview boolean not null default true,
  allow_download boolean not null default true,
  cover_image_path text,
  cover_image_alt text,
  cover_image_mime_type text,
  cover_image_size_bytes integer,
  cover_image_updated_at timestamptz,
  uploaded_by uuid references library.profiles(id) on delete set null,
  published_by uuid references library.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ebooks_cover_metadata_consistent check (
    (cover_image_path is null and cover_image_mime_type is null and cover_image_size_bytes is null and cover_image_updated_at is null)
    or (
      cover_image_path ~ '^ebooks/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'
      and cover_image_mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and cover_image_size_bytes between 1 and 2097152
      and cover_image_updated_at is not null
    )
  ),
  constraint ebooks_lifecycle_consistent check (
    (status = 'draft' and published_at is null and archived_at is null)
    or (status = 'published' and published_at is not null and archived_at is null)
    or (status = 'archived' and published_at is not null and archived_at is not null)
  )
);

create table library.ebook_files (
  id uuid primary key default gen_random_uuid(),
  ebook_id uuid not null references library.ebooks(id) on delete cascade,
  bucket_name text not null,
  storage_object_path text not null,
  original_filename text not null check (length(trim(original_filename)) > 0),
  file_format library.ebook_file_format_enum not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes between 1 and 52428800),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  file_status library.ebook_file_status_enum not null default 'uploaded',
  validation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ebook_id),
  unique (bucket_name, storage_object_path),
  constraint ebook_files_path_valid check (
    bucket_name = 'ebooks-private'
    and storage_object_path ~ '^ebooks/[0-9a-f-]{36}/files/[0-9a-f-]{36}/book\.(pdf|epub)$'
  ),
  constraint ebook_files_ready_metadata check (
    file_status <> 'ready'
    or (
      mime_type in ('application/pdf', 'application/epub+zip')
      and file_size_bytes is not null
      and checksum_sha256 is not null
      and validation_error is null
    )
  ),
  constraint ebook_files_failure_note check (
    file_status <> 'failed' or length(trim(validation_error)) > 0
  )
);

create table library.ebook_access_events (
  id uuid primary key default gen_random_uuid(),
  ebook_id uuid not null references library.ebooks(id) on delete cascade,
  user_id uuid references library.profiles(id) on delete set null,
  event_type library.ebook_access_event_type_enum not null,
  created_at timestamptz not null default now()
);

create index idx_ebooks_status_created on library.ebooks(status, created_at desc);
create index idx_ebooks_category on library.ebooks(category);
create index idx_ebooks_scope on library.ebooks(access_scope);
create index idx_ebook_access_events_ebook_created
  on library.ebook_access_events(ebook_id, created_at desc);
create index idx_ebook_access_events_user_created
  on library.ebook_access_events(user_id, created_at desc)
  where user_id is not null;

alter table library.ebooks enable row level security;
alter table library.ebook_files enable row level security;
alter table library.ebook_access_events enable row level security;

create or replace function library._require_ebook_identity(p_user_id uuid)
returns library.role_enum
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_claim_user_id uuid;
  v_role library.role_enum;
begin
  v_claim_user_id := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  if v_claim_user_id is null or v_claim_user_id <> p_user_id then
    raise exception 'Authentication required';
  end if;

  select role into v_role
  from library.profiles
  where id = p_user_id and is_active = true;

  if v_role is null then
    raise exception 'Active user profile not found';
  end if;

  return v_role;
end;
$$;

create or replace function library._require_ebook_manager(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
begin
  v_role := library._require_ebook_identity(p_user_id);
  if v_role not in ('librarian', 'admin') then
    raise exception 'Insufficient privileges';
  end if;
end;
$$;

create or replace function library._ebook_json(p_ebook_id uuid, p_include_internal boolean default false)
returns jsonb
language sql
security definer
set search_path = library, public
stable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'subtitle', e.subtitle,
    'authors', e.authors,
    'description', e.description,
    'isbn', e.isbn,
    'publisher', e.publisher,
    'publication_year', e.publication_year,
    'edition', e.edition,
    'language', e.language,
    'category', e.category,
    'keywords', e.keywords,
    'linked_book_id', e.linked_book_id,
    'status', e.status,
    'access_scope', e.access_scope,
    'allow_preview', e.allow_preview,
    'allow_download', e.allow_download,
    'cover_image_path', e.cover_image_path,
    'cover_image_alt', e.cover_image_alt,
    'cover_image_mime_type', e.cover_image_mime_type,
    'cover_image_size_bytes', e.cover_image_size_bytes,
    'cover_image_updated_at', e.cover_image_updated_at,
    'uploaded_by', e.uploaded_by,
    'published_by', e.published_by,
    'published_at', e.published_at,
    'archived_at', e.archived_at,
    'created_at', e.created_at,
    'updated_at', e.updated_at,
    'file', case when f.id is null then null else jsonb_strip_nulls(jsonb_build_object(
      'id', f.id,
      'original_filename', f.original_filename,
      'file_format', f.file_format,
      'mime_type', f.mime_type,
      'file_size_bytes', f.file_size_bytes,
      'file_status', f.file_status,
      'validation_error', case when p_include_internal then f.validation_error else null end,
      'checksum_sha256', case when p_include_internal then f.checksum_sha256 else null end,
      'bucket_name', case when p_include_internal then f.bucket_name else null end,
      'storage_object_path', case when p_include_internal then f.storage_object_path else null end,
      'created_at', f.created_at,
      'updated_at', f.updated_at
    )) end
  ))
  from library.ebooks e
  left join library.ebook_files f on f.ebook_id = e.id
  where e.id = p_ebook_id;
$$;

create or replace function library.get_staff_ebooks(
  p_user_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_items jsonb;
begin
  perform library._require_ebook_manager(p_user_id);
  select count(*) into v_total from library.ebooks;
  select coalesce(jsonb_agg(library._ebook_json(id, true) order by created_at desc, id desc), '[]'::jsonb)
  into v_items
  from (
    select id, created_at from library.ebooks
    order by created_at desc, id desc
    limit v_limit offset v_offset
  ) page;
  return jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
end;
$$;

create or replace function library.get_staff_ebook_by_id(p_user_id uuid, p_ebook_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare v_item jsonb;
begin
  perform library._require_ebook_manager(p_user_id);
  v_item := library._ebook_json(p_ebook_id, true);
  if v_item is null then raise exception 'E-Book not found'; end if;
  return v_item;
end;
$$;

create or replace function library.create_ebook_upload_intent(
  p_user_id uuid,
  p_ebook_id uuid,
  p_file_id uuid,
  p_title text,
  p_authors text,
  p_category library.book_category_enum,
  p_filename text,
  p_file_format library.ebook_file_format_enum,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_bucket_name text,
  p_storage_object_path text
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_ebook_manager(p_user_id);
  if p_file_size_bytes < 1 or p_file_size_bytes > 52428800 then
    raise exception 'File exceeds upload size limit';
  end if;
  insert into library.ebooks(id, title, authors, category, uploaded_by)
  values (p_ebook_id, trim(p_title), trim(p_authors), p_category, p_user_id);
  insert into library.ebook_files(
    id, ebook_id, bucket_name, storage_object_path, original_filename,
    file_format, mime_type, file_size_bytes
  )
  values (
    p_file_id, p_ebook_id, p_bucket_name, p_storage_object_path, trim(p_filename),
    p_file_format, p_mime_type, p_file_size_bytes
  );
  return library._ebook_json(p_ebook_id, true);
end;
$$;

create or replace function library.finalize_ebook_file(
  p_user_id uuid,
  p_ebook_id uuid,
  p_file_status library.ebook_file_status_enum,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_checksum_sha256 text,
  p_validation_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_ebook_manager(p_user_id);
  if not exists (select 1 from library.ebook_files where ebook_id = p_ebook_id) then
    raise exception 'E-Book not found';
  end if;
  update library.ebook_files
  set file_status = p_file_status,
      mime_type = p_mime_type,
      file_size_bytes = p_file_size_bytes,
      checksum_sha256 = p_checksum_sha256,
      validation_error = nullif(trim(p_validation_error), ''),
      updated_at = now()
  where ebook_id = p_ebook_id;
  return library._ebook_json(p_ebook_id, true);
end;
$$;

create or replace function library.update_ebook(
  p_user_id uuid,
  p_ebook_id uuid,
  p_title text,
  p_subtitle text,
  p_authors text,
  p_description text,
  p_isbn text,
  p_publisher text,
  p_publication_year integer,
  p_edition text,
  p_language text,
  p_category library.book_category_enum,
  p_keywords text[],
  p_linked_book_id uuid,
  p_access_scope library.ebook_access_scope_enum,
  p_allow_preview boolean,
  p_allow_download boolean
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_ebook_manager(p_user_id);
  update library.ebooks
  set title = trim(p_title),
      subtitle = nullif(trim(p_subtitle), ''),
      authors = trim(p_authors),
      description = nullif(trim(p_description), ''),
      isbn = nullif(trim(p_isbn), ''),
      publisher = nullif(trim(p_publisher), ''),
      publication_year = p_publication_year,
      edition = nullif(trim(p_edition), ''),
      language = trim(p_language),
      category = p_category,
      keywords = coalesce(p_keywords, '{}'),
      linked_book_id = p_linked_book_id,
      access_scope = p_access_scope,
      allow_preview = p_allow_preview,
      allow_download = p_allow_download,
      updated_at = now()
  where id = p_ebook_id;
  if not found then raise exception 'E-Book not found'; end if;
  return library._ebook_json(p_ebook_id, true);
end;
$$;

create or replace function library.publish_ebook(p_user_id uuid, p_ebook_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare v_ready boolean;
begin
  perform library._require_ebook_manager(p_user_id);
  select exists(
    select 1 from library.ebook_files
    where ebook_id = p_ebook_id and file_status = 'ready'
  ) into v_ready;
  if not v_ready then raise exception 'Ready E-Book file required'; end if;
  update library.ebooks
  set status = 'published',
      published_by = p_user_id,
      published_at = coalesce(published_at, now()),
      archived_at = null,
      updated_at = now()
  where id = p_ebook_id
    and length(trim(title)) > 0
    and length(trim(authors)) > 0
    and length(trim(language)) > 0
    and (allow_preview or allow_download);
  if not found then raise exception 'E-Book is incomplete or unavailable'; end if;
  return library._ebook_json(p_ebook_id, true);
end;
$$;

create or replace function library.archive_ebook(p_user_id uuid, p_ebook_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_ebook_manager(p_user_id);
  update library.ebooks
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_ebook_id and status = 'published';
  if not found then raise exception 'Only published E-Books can be archived'; end if;
  return library._ebook_json(p_ebook_id, true);
end;
$$;

create or replace function library.delete_ebook_draft(p_user_id uuid, p_ebook_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare v_file jsonb;
begin
  perform library._require_ebook_manager(p_user_id);
  if exists (select 1 from library.ebook_access_events where ebook_id = p_ebook_id) then
    raise exception 'E-Book has access history; deletion blocked';
  end if;
  select jsonb_build_object('bucket_name', bucket_name, 'storage_object_path', storage_object_path)
  into v_file from library.ebook_files where ebook_id = p_ebook_id;
  delete from library.ebooks where id = p_ebook_id and status = 'draft';
  if not found then raise exception 'Only draft E-Books can be deleted'; end if;
  return coalesce(v_file, '{}'::jsonb);
end;
$$;

create or replace function library.set_ebook_cover_metadata(
  p_user_id uuid,
  p_ebook_id uuid,
  p_cover_image_path text,
  p_cover_image_alt text,
  p_cover_image_mime_type text,
  p_cover_image_size_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_ebook_manager(p_user_id);
  update library.ebooks
  set cover_image_path = trim(p_cover_image_path),
      cover_image_alt = nullif(trim(p_cover_image_alt), ''),
      cover_image_mime_type = p_cover_image_mime_type,
      cover_image_size_bytes = p_cover_image_size_bytes,
      cover_image_updated_at = now(),
      updated_at = now()
  where id = p_ebook_id;
  if not found then raise exception 'E-Book not found'; end if;
  return library._ebook_json(p_ebook_id, true);
end;
$$;

create or replace function library.clear_ebook_cover_metadata(p_user_id uuid, p_ebook_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare v_path text;
begin
  perform library._require_ebook_manager(p_user_id);
  select cover_image_path into v_path from library.ebooks where id = p_ebook_id;
  update library.ebooks
  set cover_image_path = null, cover_image_alt = null, cover_image_mime_type = null,
      cover_image_size_bytes = null, cover_image_updated_at = null, updated_at = now()
  where id = p_ebook_id;
  if not found then raise exception 'E-Book not found'; end if;
  return jsonb_build_object('cover_image_path', v_path);
end;
$$;

create or replace function library.get_student_ebooks(
  p_user_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_items jsonb;
begin
  v_role := library._require_ebook_identity(p_user_id);
  select count(*) into v_total
  from library.ebooks
  where status = 'published'
    and (access_scope = 'all_authenticated' or (access_scope = 'students_only' and v_role = 'student'));
  select coalesce(jsonb_agg(library._ebook_json(id, false) order by title, id), '[]'::jsonb)
  into v_items
  from (
    select id, title from library.ebooks
    where status = 'published'
      and (access_scope = 'all_authenticated' or (access_scope = 'students_only' and v_role = 'student'))
    order by title, id
    limit v_limit offset v_offset
  ) page;
  return jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
end;
$$;

create or replace function library.get_student_ebook_by_id(p_user_id uuid, p_ebook_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare v_role library.role_enum; v_item jsonb;
begin
  v_role := library._require_ebook_identity(p_user_id);
  if not exists (
    select 1 from library.ebooks
    where id = p_ebook_id and status = 'published'
      and (access_scope = 'all_authenticated' or (access_scope = 'students_only' and v_role = 'student'))
  ) then raise exception 'E-Book not found'; end if;
  v_item := library._ebook_json(p_ebook_id, false);
  return v_item;
end;
$$;

create or replace function library.can_access_ebook(
  p_user_id uuid,
  p_ebook_id uuid,
  p_event_type library.ebook_access_event_type_enum
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare v_role library.role_enum; v_result jsonb;
begin
  v_role := library._require_ebook_identity(p_user_id);
  select jsonb_build_object(
    'bucket_name', f.bucket_name,
    'storage_object_path', f.storage_object_path,
    'original_filename', f.original_filename,
    'file_format', f.file_format
  ) into v_result
  from library.ebooks e
  join library.ebook_files f on f.ebook_id = e.id and f.file_status = 'ready'
  where e.id = p_ebook_id
    and (
      v_role in ('librarian', 'admin')
      or (
        e.status = 'published'
        and (e.access_scope = 'all_authenticated' or (e.access_scope = 'students_only' and v_role = 'student'))
        and ((p_event_type = 'preview' and e.allow_preview) or (p_event_type = 'download' and e.allow_download))
      )
    );
  if v_result is null then raise exception 'E-Book access denied'; end if;
  return v_result;
end;
$$;

create or replace function library.record_ebook_access_event(
  p_user_id uuid,
  p_ebook_id uuid,
  p_event_type library.ebook_access_event_type_enum
)
returns uuid
language plpgsql
security definer
set search_path = library, public
as $$
declare v_event_id uuid;
begin
  perform library.can_access_ebook(p_user_id, p_ebook_id, p_event_type);
  insert into library.ebook_access_events(ebook_id, user_id, event_type)
  values (p_ebook_id, p_user_id, p_event_type)
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function library.get_ebook_access_events(
  p_user_id uuid,
  p_ebook_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  v_items jsonb;
begin
  perform library._require_ebook_manager(p_user_id);
  if not exists (select 1 from library.ebooks where id = p_ebook_id) then
    raise exception 'E-Book not found';
  end if;
  select count(*) into v_total from library.ebook_access_events where ebook_id = p_ebook_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ev.id,
    'ebook_id', ev.ebook_id,
    'user_id', ev.user_id,
    'user_name', p.full_name,
    'event_type', ev.event_type,
    'created_at', ev.created_at
  ) order by ev.created_at desc, ev.id desc), '[]'::jsonb)
  into v_items
  from (
    select * from library.ebook_access_events
    where ebook_id = p_ebook_id
    order by created_at desc, id desc
    limit v_limit offset v_offset
  ) ev
  left join library.profiles p on p.id = ev.user_id;
  return jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
end;
$$;

revoke all on library.ebooks, library.ebook_files, library.ebook_access_events from anon, authenticated;
revoke all on function library._require_ebook_identity(uuid) from public, anon, authenticated;
revoke all on function library._require_ebook_manager(uuid) from public, anon, authenticated;
revoke all on function library._ebook_json(uuid, boolean) from public, anon, authenticated;

commit;
