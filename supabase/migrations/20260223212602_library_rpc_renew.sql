create or replace function library.renew_book(
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
  v_duration integer;
  v_new_due_date timestamptz;
  v_queue_exists boolean;
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

  -- Enforce single renewal
  if v_transaction.renewal_count >= 1 then
    raise exception 'Renewal limit reached';
  end if;

  -- Check if someone is waiting in queue
  select exists(
    select 1
    from library.queue_entries qe
    join library.waiting_queues wq
      on qe.queue_id = wq.id
    where wq.book_id = p_book_id
      and qe.status = 'waiting'
  )
  into v_queue_exists;

  if v_queue_exists then
    raise exception 'Cannot renew, book reserved by another user';
  end if;

  -- Fetch book + policy
  select * into v_book
  from library.books
  where id = p_book_id;

  select rp.*
  into v_policy
  from library.profiles p
  join library.role_policies rp
    on p.role = rp.role
  where p.id = p_user_id;

  -- Determine duration
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