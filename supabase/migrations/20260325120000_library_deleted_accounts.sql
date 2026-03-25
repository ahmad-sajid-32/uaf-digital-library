-- Track deleted accounts so login can return a deterministic message and
-- admin recreation can reuse the same email cleanly.

begin;

create table if not exists library.deleted_accounts (
  id uuid primary key default gen_random_uuid(),
  previous_auth_user_id uuid,
  email text not null,
  email_normalized text not null,
  full_name text,
  role library.role_enum,
  deleted_at timestamptz not null default now(),
  deletion_source text not null
    check (deletion_source in ('self_service', 'admin')),
  deleted_by uuid references library.profiles(id) on delete set null,
  recreated_at timestamptz,
  is_active boolean not null default true
);

create unique index if not exists uq_deleted_accounts_active_email
on library.deleted_accounts (email_normalized)
where is_active = true;

create index if not exists idx_deleted_accounts_previous_auth_user
on library.deleted_accounts (previous_auth_user_id);

alter table library.university_documents
drop constraint if exists university_documents_uploaded_by_fkey;

alter table library.university_documents
add constraint university_documents_uploaded_by_fkey
foreign key (uploaded_by)
references library.profiles(id)
on delete set null;

create or replace function library.mark_account_deleted(
  p_target_user_id uuid,
  p_deletion_source text,
  p_deleted_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_email text;
  v_email_normalized text;
  v_full_name text;
  v_role library.role_enum;
begin
  if p_deletion_source not in ('self_service', 'admin') then
    raise exception 'Invalid deletion source';
  end if;

  select
    u.email,
    lower(btrim(u.email)),
    p.full_name,
    p.role
  into
    v_email,
    v_email_normalized,
    v_full_name,
    v_role
  from auth.users u
  join library.profiles p
    on p.id = u.id
  where u.id = p_target_user_id;

  if v_email is null then
    raise exception 'Profile not found';
  end if;

  update library.deleted_accounts
  set
    previous_auth_user_id = p_target_user_id,
    email = v_email,
    full_name = v_full_name,
    role = v_role,
    deleted_at = now(),
    deletion_source = p_deletion_source,
    deleted_by = p_deleted_by,
    recreated_at = null,
    is_active = true
  where email_normalized = v_email_normalized
    and is_active = true;

  if not found then
    insert into library.deleted_accounts (
      previous_auth_user_id,
      email,
      email_normalized,
      full_name,
      role,
      deleted_at,
      deletion_source,
      deleted_by,
      recreated_at,
      is_active
    )
    values (
      p_target_user_id,
      v_email,
      v_email_normalized,
      v_full_name,
      v_role,
      now(),
      p_deletion_source,
      p_deleted_by,
      null,
      true
    );
  end if;
end;
$$;

create or replace function library.clear_deleted_account_marker(p_email text)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_email_normalized text;
begin
  v_email_normalized := lower(btrim(p_email));

  if v_email_normalized is null or v_email_normalized = '' then
    return;
  end if;

  update library.deleted_accounts
  set
    is_active = false,
    recreated_at = now()
  where email_normalized = v_email_normalized
    and is_active = true;
end;
$$;

create or replace function library.is_account_deleted(p_email text)
returns boolean
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_email_normalized text;
begin
  v_email_normalized := lower(btrim(p_email));

  if v_email_normalized is null or v_email_normalized = '' then
    return false;
  end if;

  return exists (
    select 1
    from library.deleted_accounts
    where email_normalized = v_email_normalized
      and is_active = true
  );
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

  perform library.mark_account_deleted(v_user_id, 'self_service', v_user_id);

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

  perform library.mark_account_deleted(p_target_user_id, 'admin', v_admin_id);

  delete from auth.users where id = p_target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

commit;
