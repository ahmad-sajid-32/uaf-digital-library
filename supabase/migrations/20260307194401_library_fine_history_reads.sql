-- supabase/migrations/20260307194401_library_fine_history_reads.sql
-- Fine history read RPCs backed by library.fines as the historical ledger.

begin;

alter table library.fines
  add column if not exists resolved_at timestamptz;

alter table library.fines
  add column if not exists resolved_by uuid references library.profiles(id) on delete set null;

alter table library.fines
  add column if not exists waive_reason text;

create or replace function library._require_history_reader()
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

  if v_role not in ('librarian', 'admin') then
    raise exception 'Insufficient privileges';
  end if;

  return v_user_id;
end;
$$;

create or replace function library.get_my_fine_history()
returns table (
  fine_id uuid,
  transaction_id uuid,
  book_id uuid,
  title text,
  amount numeric,
  status library.fine_status_enum,
  fine_created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name text,
  waive_reason text,
  issue_date timestamptz,
  due_date timestamptz,
  return_date timestamptz
)
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

  return query
  select
    f.id as fine_id,
    f.transaction_id,
    b.id as book_id,
    b.title,
    f.amount,
    f.status,
    f.created_at as fine_created_at,
    f.resolved_at,
    f.resolved_by,
    resolver.full_name as resolved_by_name,
    f.waive_reason,
    bt.issue_date,
    bt.due_date,
    bt.return_date
  from library.fines f
  join library.borrow_transactions bt
    on bt.id = f.transaction_id
  join library.books b
    on b.id = bt.book_id
  left join library.profiles resolver
    on resolver.id = f.resolved_by
  where bt.user_id = v_user_id
  order by f.created_at desc;
end;
$$;

create or replace function library.get_admin_fines(
  p_status library.fine_status_enum default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  fine_id uuid,
  transaction_id uuid,
  user_id uuid,
  user_full_name text,
  book_id uuid,
  title text,
  amount numeric,
  status library.fine_status_enum,
  fine_created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name text,
  waive_reason text
)
language plpgsql
security definer
set search_path = library, auth, public
as $$
begin
  perform library._require_history_reader();

  if p_limit is null or p_limit <= 0 then
    p_limit := 50;
  end if;

  if p_limit > 200 then
    p_limit := 200;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  return query
  select
    f.id as fine_id,
    f.transaction_id,
    borrower.id as user_id,
    borrower.full_name as user_full_name,
    b.id as book_id,
    b.title,
    f.amount,
    f.status,
    f.created_at as fine_created_at,
    f.resolved_at,
    f.resolved_by,
    resolver.full_name as resolved_by_name,
    f.waive_reason
  from library.fines f
  join library.borrow_transactions bt
    on bt.id = f.transaction_id
  join library.books b
    on b.id = bt.book_id
  join library.profiles borrower
    on borrower.id = bt.user_id
  left join library.profiles resolver
    on resolver.id = f.resolved_by
  where p_status is null or f.status = p_status
  order by f.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

create or replace function library.get_admin_fine_detail(p_fine_id uuid)
returns table (
  fine_id uuid,
  transaction_id uuid,
  user_id uuid,
  user_full_name text,
  book_id uuid,
  title text,
  amount numeric,
  status library.fine_status_enum,
  fine_created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name text,
  waive_reason text,
  issue_date timestamptz,
  due_date timestamptz,
  return_date timestamptz
)
language plpgsql
security definer
set search_path = library, auth, public
as $$
begin
  perform library._require_history_reader();

  return query
  select
    f.id as fine_id,
    f.transaction_id,
    borrower.id as user_id,
    borrower.full_name as user_full_name,
    b.id as book_id,
    b.title,
    f.amount,
    f.status,
    f.created_at as fine_created_at,
    f.resolved_at,
    f.resolved_by,
    resolver.full_name as resolved_by_name,
    f.waive_reason,
    bt.issue_date,
    bt.due_date,
    bt.return_date
  from library.fines f
  join library.borrow_transactions bt
    on bt.id = f.transaction_id
  join library.books b
    on b.id = bt.book_id
  join library.profiles borrower
    on borrower.id = bt.user_id
  left join library.profiles resolver
    on resolver.id = f.resolved_by
  where f.id = p_fine_id;

  if not found then
    raise exception 'Fine not found';
  end if;
end;
$$;

commit;
