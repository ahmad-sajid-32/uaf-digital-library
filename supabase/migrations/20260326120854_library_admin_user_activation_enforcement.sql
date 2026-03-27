begin;

create or replace function library.get_profile_access_context(p_user_id uuid)
returns table (
  role library.role_enum,
  is_active boolean
)
language sql
stable
security definer
set search_path = library, public
as $$
  select
    p.role,
    p.is_active
  from library.profiles p
  where p.id = p_user_id;
$$;

create or replace function library.admin_set_user_active_status(
  p_target_user_id uuid,
  p_is_active boolean
)
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

  select library.is_admin(v_admin_id)
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Insufficient privileges';
  end if;

  update library.profiles
  set is_active = p_is_active
  where id = p_target_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

commit;
