-- supabase/migrations/20260307121958_library_read_rpc.sql
-- Read RPCs for user dashboards + admin metrics.
-- Note: overdue count is computed live (not from mv_overdue_summary) to avoid stale now() snapshots.

begin;

-- -----------------------------
-- MY ACTIVE BORROWS
-- -----------------------------
create or replace function library.get_my_active_borrows(p_user_id uuid)
returns table (
  transaction_id uuid,
  book_id uuid,
  title text,
  author text,
  category library.book_category_enum,
  book_status library.book_status_enum,
  issue_date timestamptz,
  due_date timestamptz,
  renewal_count integer
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  return query
  select
    bt.id as transaction_id,
    b.id as book_id,
    b.title,
    b.author,
    b.category,
    b.status as book_status,
    bt.issue_date,
    bt.due_date,
    bt.renewal_count
  from library.borrow_transactions bt
  join library.books b
    on b.id = bt.book_id
  where bt.user_id = p_user_id
    and bt.return_date is null
  order by bt.issue_date desc;
end;
$$;

-- -----------------------------
-- MY BORROW HISTORY (LIMITED)
-- -----------------------------
create or replace function library.get_my_borrow_history(
  p_user_id uuid,
  p_limit integer default 50
)
returns table (
  transaction_id uuid,
  book_id uuid,
  title text,
  author text,
  category library.book_category_enum,
  book_status library.book_status_enum,
  issue_date timestamptz,
  due_date timestamptz,
  return_date timestamptz,
  renewal_count integer
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  if p_limit is null or p_limit <= 0 then
    p_limit := 50;
  end if;

  if p_limit > 200 then
    p_limit := 200;
  end if;

  return query
  select
    bt.id as transaction_id,
    b.id as book_id,
    b.title,
    b.author,
    b.category,
    b.status as book_status,
    bt.issue_date,
    bt.due_date,
    bt.return_date,
    bt.renewal_count
  from library.borrow_transactions bt
  join library.books b
    on b.id = bt.book_id
  where bt.user_id = p_user_id
    and bt.return_date is not null
  order by bt.return_date desc
  limit p_limit;
end;
$$;

-- -----------------------------
-- MY FINES
-- -----------------------------
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
  return_date timestamptz
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
    bt.return_date
  from library.fines f
  join library.borrow_transactions bt
    on bt.id = f.transaction_id
  join library.books b
    on b.id = bt.book_id
  where bt.user_id = p_user_id
  order by f.created_at desc;
end;
$$;

-- -----------------------------
-- MY QUEUE ENTRIES
-- -----------------------------
create or replace function library.get_my_queue_entries(p_user_id uuid)
returns table (
  book_id uuid,
  title text,
  status library.queue_status_enum,
  queue_position integer,
  notified_at timestamptz,
  hold_expires_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  return query
  select
    b.id as book_id,
    b.title,
    qe.status,
    qe.position as queue_position,
    qe.notified_at,
    case
      when qe.status = 'notified' and qe.notified_at is not null
        then qe.notified_at + interval '48 hours'
      else null
    end as hold_expires_at
  from library.queue_entries qe
  join library.waiting_queues wq
    on wq.id = qe.queue_id
  join library.books b
    on b.id = wq.book_id
  where qe.user_id = p_user_id
  order by qe.created_at desc;
end;
$$;

-- -----------------------------
-- BOOK QUEUE STATUS (PUBLIC-SAFE)
-- No user IDs returned.
-- -----------------------------
create or replace function library.get_book_queue_status(p_book_id uuid)
returns table (
  book_id uuid,
  book_status library.book_status_enum,
  waiting_count integer,
  has_notified boolean,
  notified_at timestamptz,
  hold_expires_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_book record;
  v_queue_id uuid;
  v_notified_at timestamptz;
begin
  select * into v_book
  from library.books
  where id = p_book_id;

  if not found then
    raise exception 'Book not found';
  end if;

  select id into v_queue_id
  from library.waiting_queues
  where book_id = p_book_id;

  select max(qe.notified_at)
  into v_notified_at
  from library.queue_entries qe
  where qe.queue_id = v_queue_id
    and qe.status = 'notified';

  return query
  select
    v_book.id,
    v_book.status,
    coalesce((
      select count(*)
      from library.queue_entries qe
      where qe.queue_id = v_queue_id
        and qe.status = 'waiting'
    ), 0)::int as waiting_count,
    (v_notified_at is not null) as has_notified,
    v_notified_at,
    case
      when v_notified_at is not null then v_notified_at + interval '48 hours'
      else null
    end as hold_expires_at;
end;
$$;

-- -----------------------------
-- ADMIN METRICS (ROLE-GATED)
-- Uses live counts for correctness + uses materialized views for top lists.
-- Requires librarian/admin privileges via existing helper.
-- -----------------------------
create or replace function library.get_admin_metrics(
  p_user_id uuid,
  p_popular_limit integer default 10,
  p_queue_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_active_borrows integer;
  v_overdue integer;
  v_pending_fines numeric;
  v_popular jsonb;
  v_queue jsonb;
begin
  -- Reuse your existing manager gate (librarian/admin).
  perform library._require_books_manager(p_user_id);

  select count(*)::int
  into v_active_borrows
  from library.borrow_transactions
  where return_date is null;

  select count(*)::int
  into v_overdue
  from library.borrow_transactions
  where return_date is null
    and due_date < now();

  select coalesce(sum(amount), 0)
  into v_pending_fines
  from library.fines
  where status = 'pending';

  if p_popular_limit is null or p_popular_limit <= 0 then
    p_popular_limit := 10;
  end if;

  if p_popular_limit > 50 then
    p_popular_limit := 50;
  end if;

  if p_queue_limit is null or p_queue_limit <= 0 then
    p_queue_limit := 10;
  end if;

  if p_queue_limit > 50 then
    p_queue_limit := 50;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'book_id', t.id,
        'title', t.title,
        'borrow_count', t.borrow_count
      )
    ),
    '[]'::jsonb
  )
  into v_popular
  from (
    select id, title, borrow_count
    from library.mv_popular_books
    order by borrow_count desc
    limit p_popular_limit
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'book_id', t.id,
        'title', t.title,
        'waiting_count', t.waiting_count
      )
    ),
    '[]'::jsonb
  )
  into v_queue
  from (
    select id, title, waiting_count
    from library.mv_queue_pressure
    order by waiting_count desc
    limit p_queue_limit
  ) t;

  return jsonb_build_object(
    'active_borrow_count', v_active_borrows,
    'overdue_count', v_overdue,
    'total_pending_fines', v_pending_fines,
    'popular_books', v_popular,
    'queue_pressure', v_queue
  );
end;
$$;

commit;