-- supabase/migrations/20260307193141_library_fine_settlement.sql
-- Fine settlement lifecycle:
-- - add audit columns to library.fines
-- - add librarian/admin settlement guard
-- - add pay_fine and waive_fine RPCs
-- - extend get_my_fines read RPC with settlement metadata

begin;

alter table library.fines
  add column if not exists resolved_at timestamptz;

alter table library.fines
  add column if not exists resolved_by uuid references library.profiles(id) on delete set null;

alter table library.fines
  add column if not exists waive_reason text;

create or replace function library._require_fine_manager()
returns uuid
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_user_id uuid;
  v_role library.role_enum;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.role
  into v_role
  from library.profiles p
  where p.id = v_user_id;

  if v_role is null or v_role not in ('librarian', 'admin') then
    raise exception 'Insufficient privileges';
  end if;

  return v_user_id;
end;
$$;

create or replace function library.pay_fine(p_fine_id uuid)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_actor_id uuid;
  v_fine record;
begin
  v_actor_id := library._require_fine_manager();

  select *
  into v_fine
  from library.fines f
  where f.id = p_fine_id
  for update;

  if not found then
    raise exception 'Fine not found';
  end if;

  if v_fine.status in ('paid', 'waived') then
    raise exception 'Fine already settled';
  end if;

  if v_fine.status <> 'pending' then
    raise exception 'Fine is not pending';
  end if;

  update library.fines
  set status = 'paid',
      resolved_at = now(),
      resolved_by = v_actor_id,
      waive_reason = null
  where id = p_fine_id;
end;
$$;

create or replace function library.waive_fine(
  p_fine_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_actor_id uuid;
  v_fine record;
  v_reason text;
begin
  v_actor_id := library._require_fine_manager();

  select *
  into v_fine
  from library.fines f
  where f.id = p_fine_id
  for update;

  if not found then
    raise exception 'Fine not found';
  end if;

  if v_fine.status in ('paid', 'waived') then
    raise exception 'Fine already settled';
  end if;

  if v_fine.status <> 'pending' then
    raise exception 'Fine is not pending';
  end if;

  v_reason := nullif(btrim(p_reason), '');

  if v_reason is not null and length(v_reason) > 300 then
    raise exception 'Invalid waive reason';
  end if;

  update library.fines
  set status = 'waived',
      resolved_at = now(),
      resolved_by = v_actor_id,
      waive_reason = v_reason
  where id = p_fine_id;
end;
$$;

drop function if exists library.get_my_fines(uuid);

create or replace function library.get_my_fines(p_user_id uuid)
returns table (
  fine_id uuid,
  transaction_id uuid,
  book_id uuid,
  title text,
  amount numeric,
  status library.fine_status_enum,
  fine_created_at timestamptz,
  issue_date timestamptz,
  due_date timestamptz,
  return_date timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  waive_reason text
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  return query
  select
    f.id as fine_id,
    f.transaction_id,
    b.id as book_id,
    b.title,
    f.amount,
    f.status,
    f.created_at as fine_created_at,
    bt.issue_date,
    bt.due_date,
    bt.return_date,
    f.resolved_at,
    f.resolved_by,
    f.waive_reason
  from library.fines f
  join library.borrow_transactions bt
    on bt.id = f.transaction_id
  join library.books b
    on b.id = bt.book_id
  where bt.user_id = p_user_id
  order by f.created_at desc;
end;
$$;

commit;
