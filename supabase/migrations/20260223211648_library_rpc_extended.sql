-- ===========================
-- RETURN BOOK WITH FINE + QUEUE LOGIC
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
  v_policy record;
  v_overdue_days integer;
  v_fine_amount numeric;
  v_next_queue record;
begin
  -- Lock active transaction
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

  -- Fetch policy
  select rp.*
  into v_policy
  from library.profiles p
  join library.role_policies rp
    on p.role = rp.role
  where p.id = p_user_id;

  -- Mark return
  update library.borrow_transactions
  set return_date = now()
  where id = v_transaction.id;

  -- Fine calculation
  if now() > v_transaction.due_date then
    v_overdue_days := ceil(extract(epoch from (now() - v_transaction.due_date)) / 86400);

    v_fine_amount := v_overdue_days * 1; -- Placeholder per-day rate

    insert into library.fines(transaction_id, amount)
    values (v_transaction.id, v_fine_amount);
  end if;

  -- Queue logic: assign to next waiting
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