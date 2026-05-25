-- supabase/migrations/20260526103434_library_profile_avatars.sql
/*
  Profile avatar metadata support.

  Purpose:
  - Register/normalize the private Supabase Storage bucket used for profile
    avatar images.
  - Store only avatar object metadata on library.profiles.
  - Expose self-owned avatar metadata RPCs for FastAPI-owned upload/delete
    workflows.

  Architecture:
  - The binary image lives in private Storage bucket: profile-avatars.
  - PostgreSQL stores only object path, MIME type, size, and update timestamp.
  - FastAPI creates short-lived signed read URLs for runtime rendering.
*/

begin;

-- ---------------------------------------------------------------------------
-- 1. Storage bucket normalization
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  false,
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
-- 2. Profile avatar metadata columns
-- ---------------------------------------------------------------------------

alter table library.profiles
  add column if not exists avatar_image_path text,
  add column if not exists avatar_image_mime_type text,
  add column if not exists avatar_image_size_bytes integer,
  add column if not exists avatar_image_updated_at timestamptz;

comment on column library.profiles.avatar_image_path is
  'Supabase Storage object path for this profile avatar inside the private profile-avatars bucket.';

comment on column library.profiles.avatar_image_mime_type is
  'Validated MIME type for the uploaded profile avatar image.';

comment on column library.profiles.avatar_image_size_bytes is
  'Validated file size in bytes for the uploaded profile avatar image.';

comment on column library.profiles.avatar_image_updated_at is
  'Timestamp when this profile avatar metadata was last changed.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_image_mime_type_allowed'
      and conrelid = 'library.profiles'::regclass
  ) then
    alter table library.profiles
      add constraint profiles_avatar_image_mime_type_allowed
      check (
        avatar_image_mime_type is null
        or avatar_image_mime_type in (
          'image/jpeg',
          'image/png',
          'image/webp'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_image_size_bytes_valid'
      and conrelid = 'library.profiles'::regclass
  ) then
    alter table library.profiles
      add constraint profiles_avatar_image_size_bytes_valid
      check (
        avatar_image_size_bytes is null
        or (
          avatar_image_size_bytes > 0
          and avatar_image_size_bytes <= 2097152
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_image_path_valid'
      and conrelid = 'library.profiles'::regclass
  ) then
    alter table library.profiles
      add constraint profiles_avatar_image_path_valid
      check (
        avatar_image_path is null
        or avatar_image_path ~
          '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.(jpg|jpeg|png|webp)$'
      );
  end if;
end;
$$;

create index if not exists idx_profiles_avatar_image_path
on library.profiles (avatar_image_path)
where avatar_image_path is not null;

-- ---------------------------------------------------------------------------
-- 3. Self-owned avatar metadata RPCs
-- ---------------------------------------------------------------------------

create or replace function library._require_self_avatar_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_request_user_id uuid;
begin
  v_request_user_id :=
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  if v_request_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_request_user_id <> p_user_id then
    raise exception 'Insufficient privileges';
  end if;
end;
$$;

create or replace function library.get_my_avatar_metadata(p_user_id uuid)
returns table (
  avatar_image_path text,
  avatar_image_mime_type text,
  avatar_image_size_bytes integer,
  avatar_image_updated_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_self_avatar_owner(p_user_id);

  if not exists (
    select 1 from library.profiles p where p.id = p_user_id
  ) then
    raise exception 'Profile not found';
  end if;

  return query
  select
    p.avatar_image_path,
    p.avatar_image_mime_type,
    p.avatar_image_size_bytes,
    p.avatar_image_updated_at
  from library.profiles p
  where p.id = p_user_id;
end;
$$;

create or replace function library.set_my_avatar_metadata(
  p_user_id uuid,
  p_avatar_image_path text,
  p_avatar_image_mime_type text,
  p_avatar_image_size_bytes integer
)
returns table (
  avatar_image_path text,
  avatar_image_mime_type text,
  avatar_image_size_bytes integer,
  avatar_image_updated_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_self_avatar_owner(p_user_id);

  if p_avatar_image_path is null or length(trim(p_avatar_image_path)) = 0 then
    raise exception 'Avatar image path is required';
  end if;

  if trim(p_avatar_image_path) !~
    '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.(jpg|jpeg|png|webp)$'
  then
    raise exception 'Invalid avatar image path';
  end if;

  if p_avatar_image_mime_type is null
     or p_avatar_image_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Invalid avatar image MIME type';
  end if;

  if p_avatar_image_size_bytes is null
     or p_avatar_image_size_bytes <= 0
     or p_avatar_image_size_bytes > 2097152 then
    raise exception 'Avatar image file is too large';
  end if;

  update library.profiles p
  set
    avatar_image_path = trim(p_avatar_image_path),
    avatar_image_mime_type = p_avatar_image_mime_type,
    avatar_image_size_bytes = p_avatar_image_size_bytes,
    avatar_image_updated_at = now()
  where p.id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  return query
  select
    p.avatar_image_path,
    p.avatar_image_mime_type,
    p.avatar_image_size_bytes,
    p.avatar_image_updated_at
  from library.profiles p
  where p.id = p_user_id;
end;
$$;

create or replace function library.clear_my_avatar_metadata(p_user_id uuid)
returns table (
  avatar_image_path text,
  avatar_image_mime_type text,
  avatar_image_size_bytes integer,
  avatar_image_updated_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_self_avatar_owner(p_user_id);

  update library.profiles p
  set
    avatar_image_path = null,
    avatar_image_mime_type = null,
    avatar_image_size_bytes = null,
    avatar_image_updated_at = null
  where p.id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  return query
  select
    p.avatar_image_path,
    p.avatar_image_mime_type,
    p.avatar_image_size_bytes,
    p.avatar_image_updated_at
  from library.profiles p
  where p.id = p_user_id;
end;
$$;

commit;
