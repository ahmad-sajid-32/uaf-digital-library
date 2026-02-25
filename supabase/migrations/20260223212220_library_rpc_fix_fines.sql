-- ===========================
-- FIXED BORROW FUNCTION
-- ===========================

create or replace function library.borrow_book(
  p_user_id uuid,
  p_book_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_book record;
  v_policy record;
  v_active_count integer;
  v_due_date timestamptz;
  v_duration integer;
  v_unpaid_fines numeric;
begin
  -- Lock book
  select * into v_book
  from library.books
  where id = p_book_id
  for update;

  if not found then
    raise exception 'Book not found';
  end if;

  if v_book.status != 'available' then
    raise exception 'Book not available';
  end if;

  -- Fetch policy
  select rp.*
  into v_policy
  from library.profiles p
  join library.role_policies rp
    on p.role = rp.role
  where p.id = p_user_id;

  -- Check unpaid fines
  select coalesce(sum(f.amount), 0)
  into v_unpaid_fines
  from library.fines f
  join library.borrow_transactions bt
    on bt.id = f.transaction_id
  where bt.user_id = p_user_id
    and f.status = 'pending';

  if v_unpaid_fines > v_policy.fine_threshold then
    raise exception 'Outstanding fines exceed allowed threshold';
  end if;

  -- Active borrow count
  select count(*) into v_active_count
  from library.borrow_transactions
  where user_id = p_user_id
    and return_date is null;

  if v_active_count >= v_policy.max_borrow_limit then
    raise exception 'Borrow limit exceeded';
  end if;

  -- Duration logic
  if v_book.override_borrow_duration_days is not null then
    v_duration := v_book.override_borrow_duration_days;
  else
    v_duration := v_policy.default_borrow_duration_days;
  end if;

  v_due_date := now() + (v_duration || ' days')::interval;

  insert into library.borrow_transactions(
    user_id,
    book_id,
    due_date
  )
  values (
    p_user_id,
    p_book_id,
    v_due_date
  );

  update library.books
  set status = 'borrowed'
  where id = p_book_id;

end;
$$;


-- ===========================
-- FIXED RETURN FUNCTION
-- ===========================

create or replace function library.return_book(
  p_user_id uuid,
  p_book_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_transaction record;
  v_book record;
  v_overdue_days integer;
  v_fine_amount numeric;
  v_next_queue record;
begin
  -- Lock transaction
  select * into v_transaction
  from library.borrow_transactions
  where user_id = p_user_id
    and book_id = p_book_id
    and return_date is null
  for update;

  if not found then
    raise exception 'Active transaction not found';
  end if;

  -- Lock book
  select * into v_book
  from library.books
  where id = p_book_id
  for update;

  update library.borrow_transactions
  set return_date = now()
  where id = v_transaction.id;

  if now() > v_transaction.due_date then
    v_overdue_days :=
      ceil(extract(epoch from (now() - v_transaction.due_date)) / 86400);

    v_fine_amount :=
      v_overdue_days * v_book.fine_per_day_rate;

    -- Cap fine
    if v_fine_amount > v_book.replacement_cost then
      v_fine_amount := v_book.replacement_cost;
    end if;

    insert into library.fines(transaction_id, amount)
    values (v_transaction.id, v_fine_amount);
  end if;

  -- Queue logic
  select qe.*
  into v_next_queue
  from library.queue_entries qe
  join library.waiting_queues wq
    on qe.queue_id = wq.id
  where wq.book_id = p_book_id
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
    where id = p_book_id;
  else
    update library.books
    set status = 'available'
    where id = p_book_id;
  end if;

end;
$$;