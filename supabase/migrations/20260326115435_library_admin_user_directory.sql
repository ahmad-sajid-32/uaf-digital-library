begin;

create or replace function library.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = library, public
as $$
  select exists (
    select 1
    from library.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

drop view if exists library.admin_user_directory;

create view library.admin_user_directory as
select
  p.id as user_id,
  u.email,
  upper(p.role::text) as role,
  p.is_active,
  p.full_name,
  s.roll_number,
  coalesce(s.department, l.department) as department,
  s.semester,
  l.employee_code,
  a.designation,
  p.created_at
from library.profiles p
join auth.users u
  on u.id = p.id
left join library.students s
  on s.id = p.id
left join library.librarians l
  on l.id = p.id
left join library.admins a
  on a.id = p.id;

commit;
