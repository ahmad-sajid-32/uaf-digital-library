BEGIN;

create or replace function library.update_my_profile(p_full_name text)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_full_name text;
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_full_name := btrim(p_full_name);

  if v_full_name is null or v_full_name = '' then
    raise exception 'Invalid full_name';
  end if;

  if length(v_full_name) > 100 then
    raise exception 'Invalid full_name';
  end if;

  update library.profiles
  set full_name = v_full_name
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

create or replace function library.admin_update_profile(p_target_user_id uuid, p_full_name text)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_full_name text;
  v_admin_id uuid;
  v_is_admin boolean;
begin
  v_admin_id := auth.uid();

  if v_admin_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1 from library.profiles p
    where p.id = v_admin_id
      and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Insufficient privileges';
  end if;

  v_full_name := btrim(p_full_name);

  if v_full_name is null or v_full_name = '' then
    raise exception 'Invalid full_name';
  end if;

  if length(v_full_name) > 100 then
    raise exception 'Invalid full_name';
  end if;

  update library.profiles
  set full_name = v_full_name
  where id = p_target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

create or replace function library.delete_my_account()
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- deletes auth user and cascades to library.profiles and all dependent library tables
  delete from auth.users where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

create or replace function library.admin_delete_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_admin_id uuid;
  v_is_admin boolean;
begin
  v_admin_id := auth.uid();

  if v_admin_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1 from library.profiles p
    where p.id = v_admin_id
      and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Insufficient privileges';
  end if;

  delete from auth.users where id = p_target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

COMMIT;
