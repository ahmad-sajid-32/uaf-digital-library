-- ===========================
-- BORROW BOOK FUNCTION
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
begin
  -- Lock book row
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

  -- Fetch user policy
  select rp.*
  into v_policy
  from library.profiles p
  join library.role_policies rp
    on p.role = rp.role
  where p.id = p_user_id;

  if not found then
    raise exception 'User policy not found';
  end if;

  -- Active borrow count
  select count(*) into v_active_count
  from library.borrow_transactions
  where user_id = p_user_id
    and return_date is null;

  if v_active_count >= v_policy.max_borrow_limit then
    raise exception 'Borrow limit exceeded';
  end if;

  -- Determine duration
  if v_book.override_borrow_duration_days is not null then
    v_duration := v_book.override_borrow_duration_days;
  else
    v_duration := v_policy.default_borrow_duration_days;
  end if;

  v_due_date := now() + (v_duration || ' days')::interval;

  -- Insert transaction
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

  -- Update book status
  update library.books
  set status = 'borrowed'
  where id = p_book_id;

end;
$$;


-- ===========================
-- RETURN BOOK FUNCTION
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
begin
  select * into v_transaction
  from library.borrow_transactions
  where user_id = p_user_id
    and book_id = p_book_id
    and return_date is null
  for update;

  if not found then
    raise exception 'Active transaction not found';
  end if;

  update library.borrow_transactions
  set return_date = now()
  where id = v_transaction.id;

  update library.books
  set status = 'available'
  where id = p_book_id;

end;
$$;
