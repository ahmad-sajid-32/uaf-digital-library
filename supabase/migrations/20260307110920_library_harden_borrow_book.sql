-- supabase/migrations/20260307110920_library_harden_borrow_book.sql
-- Harden borrow atomicity and queue fairness.
-- 1) Prevent double-issuing with a partial unique index on active borrows.
-- 2) Enforce queue-reservation rules inside borrow_book().
-- 3) Block borrowing when user has overdue active borrows.
-- 4) SECURITY DEFINER hardening: set search_path.

begin;

-- Prevent double-issuing: only one active (return_date is null) borrow per book.
create unique index if not exists uq_borrow_transactions_active_book
on library.borrow_transactions (book_id)
where return_date is null;

create or replace function library.borrow_book(p_user_id uuid, p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_book record;
  v_policy record;
  v_active_count integer;
  v_due_date timestamptz;
  v_duration integer;
  v_unpaid_fines numeric;
  v_has_overdue boolean;
  v_queue_exists boolean;
  v_hold record;
begin
  -- Lock the book row first. This is the concurrency control center.
  select *
  into v_book
  from library.books
  where id = p_book_id
  for update;

  if not found then
    raise exception 'Book not found';
  end if;

  -- Fetch policy (role-based governance).
  select rp.*
  into v_policy
  from library.profiles p
  join library.role_policies rp
    on p.role = rp.role
  where p.id = p_user_id;

  if not found then
    raise exception 'User policy not found';
  end if;

  -- Block if user has any overdue active borrows (return_date is null and due_date < now()).
  select exists (
    select 1
    from library.borrow_transactions bt
    where bt.user_id = p_user_id
      and bt.return_date is null
      and bt.due_date < now()
  )
  into v_has_overdue;

  if v_has_overdue then
    raise exception 'Borrow blocked: overdue books must be returned first';
  end if;

  -- Check unpaid pending fines total against threshold.
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

  -- Active borrow count limit per role.
  select count(*)
  into v_active_count
  from library.borrow_transactions
  where user_id = p_user_id
    and return_date is null;

  if v_active_count >= v_policy.max_borrow_limit then
    raise exception 'Borrow limit exceeded';
  end if;

  -- Queue fairness:
  -- If any queue entry exists for this book in WAITING or NOTIFIED, we consider the book "queue-managed".
  select exists (
    select 1
    from library.queue_entries qe
    join library.waiting_queues wq
      on qe.queue_id = wq.id
    where wq.book_id = p_book_id
      and qe.status in ('waiting', 'notified')
  )
  into v_queue_exists;

  -- If the book is RESERVED, only the notified holder can borrow it.
  -- If the book is AVAILABLE but queue exists, we also block direct borrowing unless the user is the notified holder.
  if v_book.status in ('reserved', 'available') and v_queue_exists then
    select qe.*
    into v_hold
    from library.queue_entries qe
    join library.waiting_queues wq
      on qe.queue_id = wq.id
    where wq.book_id = p_book_id
      and qe.user_id = p_user_id
      and qe.status = 'notified'
    order by qe.notified_at desc nulls last
    limit 1
    for update;

    if not found then
      raise exception 'Book is reserved for another user in queue';
    end if;

    -- Hold expiry enforcement (defensive, even though cron should expire them).
    if v_hold.notified_at is null or v_hold.notified_at < now() - interval '48 hours' then
      raise exception 'Your hold has expired';
    end if;
  end if;

  -- If book is neither available nor reserved, it is not borrowable.
  if v_book.status not in ('available', 'reserved') then
    raise exception 'Book not available';
  end if;

  -- Duration resolution (book override > role policy default).
  if v_book.override_borrow_duration_days is not null then
    v_duration := v_book.override_borrow_duration_days;
  else
    v_duration := v_policy.default_borrow_duration_days;
  end if;

  v_due_date := now() + (v_duration || ' days')::interval;

  -- Insert transaction (the unique partial index enforces no double-issue).
  begin
    insert into library.borrow_transactions (
      user_id,
      book_id,
      due_date
    )
    values (
      p_user_id,
      p_book_id,
      v_due_date
    );
  exception
    when unique_violation then
      raise exception 'Book already borrowed';
  end;

  -- Mark book borrowed.
  update library.books
  set status = 'borrowed'
  where id = p_book_id;

  -- If this was a queue hold, mark it fulfilled.
  if v_queue_exists then
    update library.queue_entries
    set status = 'fulfilled'
    where id = v_hold.id;
  end if;

end;
$$;

commit;