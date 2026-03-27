begin;

create or replace function library.admin_update_profile(
  p_target_user_id uuid,
  p_full_name text default null,
  p_roll_number text default null,
  p_department text default null,
  p_semester integer default null,
  p_employee_code text default null,
  p_designation text default null
)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_admin_id uuid;
  v_target_role library.role_enum;
  v_is_admin boolean;
  v_full_name text;
  v_roll_number text;
  v_department text;
  v_employee_code text;
  v_designation text;
begin
  v_admin_id := auth.uid();

  if v_admin_id is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from library.profiles p
    where p.id = v_admin_id
      and p.role = 'admin'
      and p.is_active = true
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Insufficient privileges';
  end if;

  select p.role
  into v_target_role
  from library.profiles p
  where p.id = p_target_user_id;

  if v_target_role is null then
    raise exception 'Profile not found';
  end if;

  if
    p_full_name is null
    and p_roll_number is null
    and p_department is null
    and p_semester is null
    and p_employee_code is null
    and p_designation is null
  then
    raise exception 'No updatable fields provided';
  end if;

  if p_full_name is not null then
    v_full_name := btrim(p_full_name);

    if v_full_name = '' or length(v_full_name) > 100 then
      raise exception 'Invalid full_name';
    end if;
  end if;

  if p_roll_number is not null then
    v_roll_number := lower(btrim(p_roll_number));

    if v_roll_number = '' or v_roll_number !~ '^\d{4}-[a-z]{2}-\d{4}$' then
      raise exception 'Invalid roll_number';
    end if;
  end if;

  if p_department is not null then
    v_department := regexp_replace(btrim(p_department), '\s+', ' ', 'g');

    if v_department = '' or length(v_department) > 100 then
      raise exception 'Invalid department';
    end if;
  end if;

  if p_employee_code is not null then
    v_employee_code := upper(btrim(p_employee_code));

    if v_employee_code = '' or length(v_employee_code) > 50 then
      raise exception 'Invalid employee_code';
    end if;
  end if;

  if p_designation is not null then
    v_designation := regexp_replace(btrim(p_designation), '\s+', ' ', 'g');

    if v_designation = '' or length(v_designation) > 100 then
      raise exception 'Invalid designation';
    end if;
  end if;

  if p_semester is not null and p_semester <= 0 then
    raise exception 'Invalid semester';
  end if;

  case v_target_role
    when 'student' then
      if p_employee_code is not null or p_designation is not null then
        raise exception 'Role field mismatch';
      end if;

      update library.profiles
      set full_name = coalesce(v_full_name, full_name)
      where id = p_target_user_id;

      update library.students
      set
        roll_number = coalesce(v_roll_number, roll_number),
        department = coalesce(v_department, department),
        semester = coalesce(p_semester, semester)
      where id = p_target_user_id;

    when 'librarian' then
      if p_roll_number is not null or p_semester is not null or p_designation is not null then
        raise exception 'Role field mismatch';
      end if;

      update library.profiles
      set full_name = coalesce(v_full_name, full_name)
      where id = p_target_user_id;

      update library.librarians
      set
        employee_code = coalesce(v_employee_code, employee_code),
        department = coalesce(v_department, department)
      where id = p_target_user_id;

    when 'admin' then
      if
        p_roll_number is not null
        or p_department is not null
        or p_semester is not null
        or p_employee_code is not null
      then
        raise exception 'Role field mismatch';
      end if;

      update library.profiles
      set full_name = coalesce(v_full_name, full_name)
      where id = p_target_user_id;

      update library.admins
      set designation = coalesce(v_designation, designation)
      where id = p_target_user_id;

    else
      raise exception 'Unsupported role';
  end case;
end;
$$;

commit;
