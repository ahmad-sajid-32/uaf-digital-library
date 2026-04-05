-- supabase/migrations/20260405201626_library_staff_circulation_management.sql
-- Staff circulation management foundation.
-- Adds:
-- - staff circulation manager guard
-- - staff circulation read model + list/detail RPCs
-- - due-date adjustment RPC
-- - transaction-scoped staff return RPC
-- - transaction-scoped staff renew RPC

begin;

create index if not exists idx_borrow_transactions_active_due_date
on library.borrow_transactions (due_date)
where return_date is null;

create index if not exists idx_borrow_transactions_return_date_due_date
on library.borrow_transactions (return_date, due_date);

create or replace function library._require_circulation_manager(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
begin
  select p.role
  into v_role
  from library.profiles p
  where p.id = p_user_id;

  if v_role is null then
    raise exception 'User profile not found';
  end if;

  if v_role not in ('librarian', 'admin') then
    raise exception 'Insufficient privileges';
  end if;
end;
$$;

create or replace view library.staff_circulation_directory as
select
  bt.id as transaction_id,
  bt.user_id,
  coalesce(nullif(trim(p.full_name), ''), au.email, bt.user_id::text) as user_full_name,
  au.email as user_email,
  p.role as user_role,
  s.roll_number,
  l.employee_code,
  b.id as book_id,
  b.title as book_title,
  b.author as book_author,
  b.category as book_category,
  b.status as book_status,
  bt.issue_date,
  bt.due_date,
  bt.return_date,
  bt.renewal_count,
  (bt.return_date is null and bt.due_date < now()) as is_overdue,
  coalesce(f.amount, 0::numeric) as fine_amount,
  f.status as fine_status,
  coalesce(qs.waiting_count, 0) as waiting_count,
  case
    when coalesce(qs.has_notified, false) then 'notified'
    when coalesce(qs.waiting_count, 0) > 0 then 'waiting'
    else null
  end as queue_status,
  qs.hold_expires_at,
  (bt.return_date is null) as can_return,
  (coalesce(f.status::text, '') not in ('paid', 'waived', 'cancelled')) as can_adjust_due_date,
  (
    bt.return_date is null
    and bt.renewal_count < 1
    and coalesce(qs.waiting_count, 0) = 0
  ) as can_renew
from library.borrow_transactions bt
join library.books b
  on b.id = bt.book_id
join library.profiles p
  on p.id = bt.user_id
left join auth.users au
  on au.id = bt.user_id
left join library.students s
  on s.id = bt.user_id
left join library.librarians l
  on l.id = bt.user_id
left join library.fines f
  on f.transaction_id = bt.id
left join lateral (
  select
    count(*) filter (where qe.status = 'waiting')::integer as waiting_count,
    bool_or(qe.status = 'notified') as has_notified,
    max(
      case
        when qe.status = 'notified' and qe.notified_at is not null
          then qe.notified_at + interval '48 hours'
        else null
      end
    ) as hold_expires_at
  from library.waiting_queues wq
  left join library.queue_entries qe
    on qe.queue_id = wq.id
  where wq.book_id = bt.book_id
) qs on true;

create or replace function library.get_staff_circulation_loans(
  p_user_id uuid,
  p_scope text default 'active',
  p_search text default null,
  p_role library.role_enum default null,
  p_book_status library.book_status_enum default null,
  p_due_from timestamptz default null,
  p_due_to timestamptz default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_scope text;
  v_search text;
  v_search_uuid uuid;
  v_total integer;
  v_items jsonb;
begin
  perform library._require_circulation_manager(p_user_id);

  v_scope := lower(coalesce(trim(p_scope), 'active'));

  if v_scope not in ('active', 'overdue', 'history') then
    raise exception 'Invalid circulation scope';
  end if;

  v_search := nullif(trim(p_search), '');

  if v_search is not null then
    begin
      v_search_uuid := v_search::uuid;
    exception
      when invalid_text_representation then
        v_search_uuid := null;
    end;
  end if;

  if p_limit is null or p_limit <= 0 then
    p_limit := 100;
  end if;

  if p_limit > 200 then
    p_limit := 200;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  with filtered as (
    select *
    from library.staff_circulation_directory scd
    where (
      (v_scope = 'active' and scd.return_date is null)
      or (v_scope = 'overdue' and scd.return_date is null and scd.due_date < now())
      or (v_scope = 'history' and scd.return_date is not null)
    )
      and (p_role is null or scd.user_role = p_role)
      and (p_book_status is null or scd.book_status = p_book_status)
      and (p_due_from is null or scd.due_date >= p_due_from)
      and (p_due_to is null or scd.due_date < p_due_to)
      and (
        v_search is null
        or (
          scd.transaction_id = v_search_uuid
          or lower(scd.user_full_name) like '%' || lower(v_search) || '%'
          or lower(coalesce(scd.user_email, '')) like '%' || lower(v_search) || '%'
          or lower(coalesce(scd.roll_number, '')) like '%' || lower(v_search) || '%'
          or lower(coalesce(scd.employee_code, '')) like '%' || lower(v_search) || '%'
          or lower(scd.book_title) like '%' || lower(v_search) || '%'
        )
      )
  )
  select count(*)::integer
  into v_total
  from filtered;

  with filtered as (
    select *
    from library.staff_circulation_directory scd
    where (
      (v_scope = 'active' and scd.return_date is null)
      or (v_scope = 'overdue' and scd.return_date is null and scd.due_date < now())
      or (v_scope = 'history' and scd.return_date is not null)
    )
      and (p_role is null or scd.user_role = p_role)
      and (p_book_status is null or scd.book_status = p_book_status)
      and (p_due_from is null or scd.due_date >= p_due_from)
      and (p_due_to is null or scd.due_date < p_due_to)
      and (
        v_search is null
        or (
          scd.transaction_id = v_search_uuid
          or lower(scd.user_full_name) like '%' || lower(v_search) || '%'
          or lower(coalesce(scd.user_email, '')) like '%' || lower(v_search) || '%'
          or lower(coalesce(scd.roll_number, '')) like '%' || lower(v_search) || '%'
          or lower(coalesce(scd.employee_code, '')) like '%' || lower(v_search) || '%'
          or lower(scd.book_title) like '%' || lower(v_search) || '%'
        )
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'transaction_id', t.transaction_id,
        'user_id', t.user_id,
        'user_full_name', t.user_full_name,
        'user_email', t.user_email,
        'user_role', t.user_role,
        'roll_number', t.roll_number,
        'employee_code', t.employee_code,
        'book_id', t.book_id,
        'book_title', t.book_title,
        'book_author', t.book_author,
        'book_category', t.book_category,
        'book_status', t.book_status,
        'issue_date', t.issue_date,
        'due_date', t.due_date,
        'return_date', t.return_date,
        'renewal_count', t.renewal_count,
        'is_overdue', t.is_overdue,
        'fine_amount', t.fine_amount,
        'fine_status', t.fine_status,
        'waiting_count', t.waiting_count,
        'queue_status', t.queue_status,
        'hold_expires_at', t.hold_expires_at,
        'can_return', t.can_return,
        'can_adjust_due_date', t.can_adjust_due_date,
        'can_renew', t.can_renew
      )
      order by
        case when v_scope = 'history' then t.return_date end desc nulls last,
        case when v_scope <> 'history' then t.due_date end asc nulls last,
        t.issue_date desc,
        t.transaction_id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select *
    from filtered
    order by
      case when v_scope = 'history' then return_date end desc nulls last,
      case when v_scope <> 'history' then due_date end asc nulls last,
      issue_date desc,
      transaction_id desc
    limit p_limit
    offset p_offset
  ) t;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create or replace function library.get_staff_circulation_loan_detail(
  p_user_id uuid,
  p_transaction_id uuid
)
returns table (
  transaction_id uuid,
  user_id uuid,
  user_full_name text,
  user_email text,
  user_role library.role_enum,
  roll_number text,
  employee_code text,
  book_id uuid,
  book_title text,
  book_author text,
  book_category library.book_category_enum,
  book_status library.book_status_enum,
  issue_date timestamptz,
  due_date timestamptz,
  return_date timestamptz,
  renewal_count integer,
  is_overdue boolean,
  fine_amount numeric,
  fine_status library.fine_status_enum,
  waiting_count integer,
  queue_status text,
  hold_expires_at timestamptz,
  can_return boolean,
  can_adjust_due_date boolean,
  can_renew boolean
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_circulation_manager(p_user_id);

  if not exists (
    select 1
    from library.staff_circulation_directory scd
    where scd.transaction_id = p_transaction_id
  ) then
    raise exception 'Loan not found';
  end if;

  return query
  select
    scd.transaction_id,
    scd.user_id,
    scd.user_full_name,
    scd.user_email,
    scd.user_role,
    scd.roll_number,
    scd.employee_code,
    scd.book_id,
    scd.book_title,
    scd.book_author,
    scd.book_category,
    scd.book_status,
    scd.issue_date,
    scd.due_date,
    scd.return_date,
    scd.renewal_count,
    scd.is_overdue,
    scd.fine_amount,
    scd.fine_status,
    scd.waiting_count,
    scd.queue_status,
    scd.hold_expires_at,
    scd.can_return,
    scd.can_adjust_due_date,
    scd.can_renew
  from library.staff_circulation_directory scd
  where scd.transaction_id = p_transaction_id;
end;
$$;

create or replace function library.adjust_loan_due_date(
  p_user_id uuid,
  p_transaction_id uuid,
  p_due_date timestamptz
)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_transaction record;
  v_book record;
  v_fine record;
  v_overdue_days integer;
  v_fine_amount numeric;
begin
  perform library._require_circulation_manager(p_user_id);

  if p_due_date is null then
    raise exception 'Due date is required';
  end if;

  select *
  into v_transaction
  from library.borrow_transactions bt
  where bt.id = p_transaction_id
  for update;

  if not found then
    raise exception 'Loan not found';
  end if;

  if p_due_date <= v_transaction.issue_date then
    raise exception 'Due date must be after the issue date';
  end if;

  select *
  into v_book
  from library.books b
  where b.id = v_transaction.book_id;

  select *
  into v_fine
  from library.fines f
  where f.transaction_id = v_transaction.id
  for update;

  if found and v_fine.status in ('paid', 'waived', 'cancelled') then
    raise exception 'Due date adjustment blocked: fine already resolved';
  end if;

  update library.borrow_transactions
  set due_date = p_due_date
  where id = v_transaction.id;

  if v_transaction.return_date is null then
    return;
  end if;

  if v_transaction.return_date <= p_due_date then
    delete from library.fines
    where transaction_id = v_transaction.id
      and status = 'pending';

    return;
  end if;

  v_overdue_days :=
    ceil(extract(epoch from (v_transaction.return_date - p_due_date)) / 86400.0);

  v_fine_amount := v_overdue_days * v_book.fine_per_day_rate;

  if v_fine_amount > v_book.replacement_cost then
    v_fine_amount := v_book.replacement_cost;
  end if;

  if exists (
    select 1
    from library.fines f
    where f.transaction_id = v_transaction.id
  ) then
    update library.fines
    set amount = v_fine_amount
    where transaction_id = v_transaction.id
      and status = 'pending';
  else
    insert into library.fines (transaction_id, amount)
    values (v_transaction.id, v_fine_amount);
  end if;
end;
$$;

create or replace function library.return_loan_by_transaction(
  p_user_id uuid,
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_transaction record;
  v_book record;
  v_overdue_days integer;
  v_fine_amount numeric;
  v_next_queue record;
begin
  perform library._require_circulation_manager(p_user_id);

  select *
  into v_transaction
  from library.borrow_transactions bt
  where bt.id = p_transaction_id
  for update;

  if not found then
    raise exception 'Loan not found';
  end if;

  if v_transaction.return_date is not null then
    raise exception 'Loan already returned';
  end if;

  select *
  into v_book
  from library.books b
  where b.id = v_transaction.book_id
  for update;

  update library.borrow_transactions
  set return_date = now()
  where id = v_transaction.id;

  if now() > v_transaction.due_date then
    v_overdue_days :=
      ceil(extract(epoch from (now() - v_transaction.due_date)) / 86400.0);

    v_fine_amount := v_overdue_days * v_book.fine_per_day_rate;

    if v_fine_amount > v_book.replacement_cost then
      v_fine_amount := v_book.replacement_cost;
    end if;

    insert into library.fines (transaction_id, amount)
    values (v_transaction.id, v_fine_amount)
    on conflict (transaction_id)
    do update set amount = excluded.amount;
  end if;

  select qe.*
  into v_next_queue
  from library.queue_entries qe
  join library.waiting_queues wq
    on qe.queue_id = wq.id
  where wq.book_id = v_transaction.book_id
    and qe.status = 'waiting'
  order by qe.position
  limit 1
  for update;

  if found then
    update library.queue_entries
    set status = 'notified',
        notified_at = now()
    where id = v_next_queue.id;

    update library.books
    set status = 'reserved'
    where id = v_transaction.book_id;
  else
    update library.books
    set status = 'available'
    where id = v_transaction.book_id;
  end if;
end;
$$;

create or replace function library.renew_loan_by_transaction(
  p_user_id uuid,
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_transaction record;
  v_book record;
  v_policy record;
  v_duration integer;
  v_new_due_date timestamptz;
  v_queue_exists boolean;
begin
  perform library._require_circulation_manager(p_user_id);

  select *
  into v_transaction
  from library.borrow_transactions bt
  where bt.id = p_transaction_id
  for update;

  if not found then
    raise exception 'Loan not found';
  end if;

  if v_transaction.return_date is not null then
    raise exception 'Loan already returned';
  end if;

  if v_transaction.renewal_count >= 1 then
    raise exception 'Renewal limit reached';
  end if;

  select exists(
    select 1
    from library.queue_entries qe
    join library.waiting_queues wq
      on qe.queue_id = wq.id
    where wq.book_id = v_transaction.book_id
      and qe.status = 'waiting'
  )
  into v_queue_exists;

  if v_queue_exists then
    raise exception 'Cannot renew, book reserved by another user';
  end if;

  select *
  into v_book
  from library.books b
  where b.id = v_transaction.book_id;

  select rp.*
  into v_policy
  from library.profiles p
  join library.role_policies rp
    on p.role = rp.role
  where p.id = v_transaction.user_id;

  if not found then
    raise exception 'User policy not found';
  end if;

  if v_book.override_borrow_duration_days is not null then
    v_duration := v_book.override_borrow_duration_days;
  else
    v_duration := v_policy.default_borrow_duration_days;
  end if;

  v_new_due_date := v_transaction.due_date + (v_duration || ' days')::interval;

  update library.borrow_transactions
  set due_date = v_new_due_date,
      renewal_count = renewal_count + 1
  where id = v_transaction.id;
end;
$$;

commit;
