-- supabase\migrations\20260525181631_library_book_covers_metadata.sql
/*
  Book cover metadata support.

  Purpose:
  - Register/normalize the public Supabase Storage bucket used for book covers.
  - Add cover-image metadata columns to library.books.
  - Expose cover metadata through existing public and staff book read RPCs.
  - Add staff-only RPCs for setting and clearing cover metadata after the
    backend uploads/deletes the object in Supabase Storage.

  Architecture:
  - The file binary lives in Supabase Storage bucket: book-covers.
  - PostgreSQL stores only object metadata/path.
  - Frontend does not upload directly to Storage in this phase.
  - FastAPI uploads/deletes the object, then calls the metadata RPC.
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Storage bucket normalization
-- ---------------------------------------------------------------------------
-- The bucket may already exist because it was created manually from Supabase UI.
-- This upsert makes the schema reproducible for local/staging/prod migration runs.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'book-covers',
  'book-covers',
  true,
  2097152,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Book cover metadata columns
-- ---------------------------------------------------------------------------

alter table library.books
  add column if not exists cover_image_path text,
  add column if not exists cover_image_alt text,
  add column if not exists cover_image_mime_type text,
  add column if not exists cover_image_size_bytes integer,
  add column if not exists cover_image_updated_at timestamptz;

comment on column library.books.cover_image_path is
  'Supabase Storage object path for the public book cover image inside the book-covers bucket.';

comment on column library.books.cover_image_alt is
  'Human-readable alternative text for the book cover image.';

comment on column library.books.cover_image_mime_type is
  'Validated MIME type for the uploaded book cover image.';

comment on column library.books.cover_image_size_bytes is
  'Validated file size in bytes for the uploaded book cover image.';

comment on column library.books.cover_image_updated_at is
  'Timestamp when the book cover metadata was last changed.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'books_cover_image_mime_type_allowed'
      and conrelid = 'library.books'::regclass
  ) then
    alter table library.books
      add constraint books_cover_image_mime_type_allowed
      check (
        cover_image_mime_type is null
        or cover_image_mime_type in (
          'image/jpeg',
          'image/png',
          'image/webp'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'books_cover_image_size_bytes_valid'
      and conrelid = 'library.books'::regclass
  ) then
    alter table library.books
      add constraint books_cover_image_size_bytes_valid
      check (
        cover_image_size_bytes is null
        or (
          cover_image_size_bytes > 0
          and cover_image_size_bytes <= 2097152
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'books_cover_image_path_valid'
      and conrelid = 'library.books'::regclass
  ) then
    alter table library.books
      add constraint books_cover_image_path_valid
      check (
        cover_image_path is null
        or cover_image_path ~
          '^books/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/cover\.(jpg|jpeg|png|webp)$'
      );
  end if;
end;
$$;

create index if not exists idx_books_cover_image_path
on library.books (cover_image_path)
where cover_image_path is not null;

-- ---------------------------------------------------------------------------
-- 3. Staff-only cover metadata mutation RPCs
-- ---------------------------------------------------------------------------

create or replace function library.set_book_cover_metadata(
  p_user_id uuid,
  p_book_id uuid,
  p_cover_image_path text,
  p_cover_image_alt text default null,
  p_cover_image_mime_type text default null,
  p_cover_image_size_bytes integer default null
)
returns table (
  book_id uuid,
  cover_image_path text,
  cover_image_alt text,
  cover_image_mime_type text,
  cover_image_size_bytes integer,
  cover_image_updated_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_exists boolean;
begin
  perform library._require_books_manager(p_user_id);

  select exists (
    select 1
    from library.books b
    where b.id = p_book_id
  )
  into v_exists;

  if not v_exists then
    raise exception 'Book not found';
  end if;

  if p_cover_image_path is null or length(trim(p_cover_image_path)) = 0 then
    raise exception 'Cover image path is required';
  end if;

  if trim(p_cover_image_path) !~
    '^books/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/cover\.(jpg|jpeg|png|webp)$'
  then
    raise exception 'Invalid cover image path';
  end if;

  if p_cover_image_mime_type is null
     or p_cover_image_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Invalid cover image MIME type';
  end if;

  if p_cover_image_size_bytes is null
     or p_cover_image_size_bytes <= 0
     or p_cover_image_size_bytes > 2097152 then
    raise exception 'Invalid cover image size';
  end if;

  return query
  update library.books b
  set
    cover_image_path = trim(p_cover_image_path),
    cover_image_alt = nullif(trim(coalesce(p_cover_image_alt, '')), ''),
    cover_image_mime_type = p_cover_image_mime_type,
    cover_image_size_bytes = p_cover_image_size_bytes,
    cover_image_updated_at = now()
  where b.id = p_book_id
  returning
    b.id,
    b.cover_image_path,
    b.cover_image_alt,
    b.cover_image_mime_type,
    b.cover_image_size_bytes,
    b.cover_image_updated_at;
end;
$$;

create or replace function library.clear_book_cover_metadata(
  p_user_id uuid,
  p_book_id uuid
)
returns table (
  book_id uuid,
  previous_cover_image_path text,
  cover_image_path text,
  cover_image_alt text,
  cover_image_mime_type text,
  cover_image_size_bytes integer,
  cover_image_updated_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_previous_cover_image_path text;
begin
  perform library._require_books_manager(p_user_id);

  select b.cover_image_path
  into v_previous_cover_image_path
  from library.books b
  where b.id = p_book_id;

  if not found then
    raise exception 'Book not found';
  end if;

  return query
  update library.books b
  set
    cover_image_path = null,
    cover_image_alt = null,
    cover_image_mime_type = null,
    cover_image_size_bytes = null,
    cover_image_updated_at = now()
  where b.id = p_book_id
  returning
    b.id,
    v_previous_cover_image_path,
    b.cover_image_path,
    b.cover_image_alt,
    b.cover_image_mime_type,
    b.cover_image_size_bytes,
    b.cover_image_updated_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Public catalog RPC with cover metadata
-- ---------------------------------------------------------------------------
-- The return table shape changes, so the old function must be dropped first.

drop function if exists library.get_public_catalog(timestamptz, uuid, integer);

create or replace function library.get_public_catalog(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  author text,
  category library.book_category_enum,
  status library.book_status_enum,
  cover_image_path text,
  cover_image_alt text,
  cover_image_updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = library
as $$
begin
  if p_limit is null or p_limit <= 0 then
    p_limit := 20;
  end if;

  if p_limit > 100 then
    p_limit := 100;
  end if;

  if p_cursor_created_at is null or p_cursor_id is null then
    return query
    select
      b.id,
      b.title,
      b.author,
      b.category,
      b.status,
      b.cover_image_path,
      b.cover_image_alt,
      b.cover_image_updated_at,
      b.created_at
    from library.books b
    order by b.created_at asc, b.id asc
    limit p_limit;
  end if;

  return query
  select
    b.id,
    b.title,
    b.author,
    b.category,
    b.status,
    b.cover_image_path,
    b.cover_image_alt,
    b.cover_image_updated_at,
    b.created_at
  from library.books b
  where (b.created_at, b.id) > (p_cursor_created_at, p_cursor_id)
  order by b.created_at asc, b.id asc
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Public book detail RPC with cover metadata
-- ---------------------------------------------------------------------------

drop function if exists library.get_book_by_id(uuid);

create or replace function library.get_book_by_id(
  p_book_id uuid
)
returns table (
  id uuid,
  title text,
  author text,
  category library.book_category_enum,
  status library.book_status_enum,
  replacement_cost numeric,
  fine_per_day_rate numeric,
  override_borrow_duration_days integer,
  cover_image_path text,
  cover_image_alt text,
  cover_image_updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  if not exists (
    select 1
    from library.books b
    where b.id = p_book_id
  ) then
    raise exception 'Book not found';
  end if;

  return query
  select
    b.id,
    b.title,
    b.author,
    b.category,
    b.status,
    b.replacement_cost,
    b.fine_per_day_rate,
    b.override_borrow_duration_days,
    b.cover_image_path,
    b.cover_image_alt,
    b.cover_image_updated_at,
    b.created_at
  from library.books b
  where b.id = p_book_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Staff inventory list RPC with cover metadata
-- ---------------------------------------------------------------------------

create or replace function library.get_staff_books(
  p_user_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_total integer;
  v_items jsonb;
begin
  perform library._require_books_manager(p_user_id);

  if p_limit is null or p_limit <= 0 then
    p_limit := 50;
  end if;

  if p_limit > 200 then
    p_limit := 200;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  select count(*)::int
  into v_total
  from library.books;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'author', t.author,
        'category', t.category,
        'status', t.status,
        'replacement_cost', t.replacement_cost,
        'fine_per_day_rate', t.fine_per_day_rate,
        'override_borrow_duration_days', t.override_borrow_duration_days,
        'cover_image_path', t.cover_image_path,
        'cover_image_alt', t.cover_image_alt,
        'cover_image_mime_type', t.cover_image_mime_type,
        'cover_image_size_bytes', t.cover_image_size_bytes,
        'cover_image_updated_at', t.cover_image_updated_at,
        'created_at', t.created_at
      )
      order by t.created_at desc, t.id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      b.id,
      b.title,
      b.author,
      b.category,
      b.status,
      b.replacement_cost,
      b.fine_per_day_rate,
      b.override_borrow_duration_days,
      b.cover_image_path,
      b.cover_image_alt,
      b.cover_image_mime_type,
      b.cover_image_size_bytes,
      b.cover_image_updated_at,
      b.created_at
    from library.books b
    order by b.created_at desc, b.id desc
    limit p_limit
    offset p_offset
  ) t;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Staff book detail RPC with cover metadata
-- ---------------------------------------------------------------------------

drop function if exists library.get_staff_book_by_id(uuid, uuid);

create or replace function library.get_staff_book_by_id(
  p_user_id uuid,
  p_book_id uuid
)
returns table (
  id uuid,
  title text,
  author text,
  category library.book_category_enum,
  status library.book_status_enum,
  replacement_cost numeric,
  fine_per_day_rate numeric,
  override_borrow_duration_days integer,
  cover_image_path text,
  cover_image_alt text,
  cover_image_mime_type text,
  cover_image_size_bytes integer,
  cover_image_updated_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_books_manager(p_user_id);

  if not exists (
    select 1
    from library.books b
    where b.id = p_book_id
  ) then
    raise exception 'Book not found';
  end if;

  return query
  select
    b.id,
    b.title,
    b.author,
    b.category,
    b.status,
    b.replacement_cost,
    b.fine_per_day_rate,
    b.override_borrow_duration_days,
    b.cover_image_path,
    b.cover_image_alt,
    b.cover_image_mime_type,
    b.cover_image_size_bytes,
    b.cover_image_updated_at,
    b.created_at
  from library.books b
  where b.id = p_book_id;
end;
$$;

commit;