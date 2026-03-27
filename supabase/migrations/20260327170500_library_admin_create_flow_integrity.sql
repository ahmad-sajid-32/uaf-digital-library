begin;

create or replace function library.validate_admin_user_creation_metadata(
  p_role text,
  p_roll_number text default null,
  p_department text default null,
  p_semester integer default null,
  p_employee_code text default null,
  p_designation text default null
)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
  v_roll_number text;
  v_department text;
  v_employee_code text;
  v_designation text;
begin
  if p_role is null or btrim(p_role) = '' then
    raise exception 'Invalid role';
  end if;

  begin
    v_role := lower(btrim(p_role))::library.role_enum;
  exception
    when invalid_text_representation then
      raise exception 'Invalid role';
  end;

  if v_role = 'student' then
    v_roll_number := lower(btrim(coalesce(p_roll_number, '')));
    v_department := btrim(coalesce(p_department, ''));

    if v_roll_number = '' or v_roll_number !~ '^\d{4}-[a-z]{2}-\d{4}$' then
      raise exception 'Invalid roll_number';
    end if;

    if v_department = '' or length(v_department) > 100 then
      raise exception 'Invalid department';
    end if;

    if p_semester is null or p_semester <= 0 then
      raise exception 'Invalid semester';
    end if;

    if exists (
      select 1
      from library.students s
      where s.roll_number = v_roll_number
    ) then
      raise exception 'Roll number already exists';
    end if;

    return;
  end if;

  if v_role = 'librarian' then
    v_employee_code := upper(btrim(coalesce(p_employee_code, '')));
    v_department := btrim(coalesce(p_department, ''));

    if v_employee_code = '' or length(v_employee_code) > 50 then
      raise exception 'Invalid employee_code';
    end if;

    if v_department = '' or length(v_department) > 100 then
      raise exception 'Invalid department';
    end if;

    if exists (
      select 1
      from library.librarians l
      where l.employee_code = v_employee_code
    ) then
      raise exception 'Employee code already exists';
    end if;

    return;
  end if;

  if v_role = 'admin' then
    v_designation := btrim(coalesce(p_designation, ''));

    if v_designation = '' or length(v_designation) > 100 then
      raise exception 'Invalid designation';
    end if;

    return;
  end if;

  raise exception 'Invalid role';
end;
$$;

create or replace function library.cleanup_failed_provisioned_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
begin
  if p_user_id is null then
    raise exception 'User not found';
  end if;

  delete from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

commit;
