-- supabase/migrations/20260307114234_library_books_crud_rpc.sql
-- Book management RPCs:
-- - create_book
-- - update_book
-- - delete_book
-- Authorization enforced in DB: only librarian/admin can mutate books.

begin;

create or replace function library._require_books_manager(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
begin
  select role
  into v_role
  from library.profiles
  where id = p_user_id;

  if v_role is null then
    raise exception 'User profile not found';
  end if;

  if v_role not in ('librarian', 'admin') then
    raise exception 'Insufficient privileges';
  end if;
end;
$$;

create or replace function library.create_book(
  p_user_id uuid,
  p_title text,
  p_author text,
  p_category library.book_category_enum,
  p_replacement_cost numeric,
  p_fine_per_day_rate numeric,
  p_override_borrow_duration_days integer default null
)
returns uuid
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_book_id uuid;
begin
  perform library._require_books_manager(p_user_id);

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  if p_author is null or length(trim(p_author)) = 0 then
    raise exception 'Author is required';
  end if;

  if p_replacement_cost is null or p_replacement_cost < 0 then
    raise exception 'Invalid replacement cost';
  end if;

  if p_fine_per_day_rate is null or p_fine_per_day_rate < 0 then
    raise exception 'Invalid fine per day rate';
  end if;

  if p_override_borrow_duration_days is not null and p_override_borrow_duration_days <= 0 then
    raise exception 'Invalid override borrow duration';
  end if;

  insert into library.books (
    title,
    author,
    category,
    replacement_cost,
    fine_per_day_rate,
    override_borrow_duration_days
  )
  values (
    trim(p_title),
    trim(p_author),
    p_category,
    p_replacement_cost,
    p_fine_per_day_rate,
    p_override_borrow_duration_days
  )
  returning id into v_book_id;

  return v_book_id;
end;
$$;

create or replace function library.update_book(
  p_user_id uuid,
  p_book_id uuid,
  p_title text default null,
  p_author text default null,
  p_category library.book_category_enum default null,
  p_status library.book_status_enum default null,
  p_replacement_cost numeric default null,
  p_fine_per_day_rate numeric default null,
  p_override_borrow_duration_days integer default null
)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_exists boolean;
begin
  perform library._require_books_manager(p_user_id);

  select exists(select 1 from library.books where id = p_book_id)
  into v_exists;

  if not v_exists then
    raise exception 'Book not found';
  end if;

  if p_replacement_cost is not null and p_replacement_cost < 0 then
    raise exception 'Invalid replacement cost';
  end if;

  if p_fine_per_day_rate is not null and p_fine_per_day_rate < 0 then
    raise exception 'Invalid fine per day rate';
  end if;

  if p_override_borrow_duration_days is not null and p_override_borrow_duration_days <= 0 then
    raise exception 'Invalid override borrow duration';
  end if;

  -- Status is system-sensitive. Only allow toggling to maintenance/available.
  if p_status is not null and p_status not in ('available', 'maintenance') then
    raise exception 'Invalid status transition';
  end if;

  update library.books
  set
    title = coalesce(nullif(trim(p_title), ''), title),
    author = coalesce(nullif(trim(p_author), ''), author),
    category = coalesce(p_category, category),
    status = coalesce(p_status, status),
    replacement_cost = coalesce(p_replacement_cost, replacement_cost),
    fine_per_day_rate = coalesce(p_fine_per_day_rate, fine_per_day_rate),
    override_borrow_duration_days = coalesce(p_override_borrow_duration_days, override_borrow_duration_days)
  where id = p_book_id;
end;
$$;

create or replace function library.delete_book(
  p_user_id uuid,
  p_book_id uuid
)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_exists boolean;
  v_has_history boolean;
  v_has_queue boolean;
begin
  perform library._require_books_manager(p_user_id);

  select exists(select 1 from library.books where id = p_book_id)
  into v_exists;

  if not v_exists then
    raise exception 'Book not found';
  end if;

  -- Hard delete is dangerous because borrow_transactions has ON DELETE CASCADE from books.
  -- So we block deletion if any history exists.
  select exists(
    select 1 from library.borrow_transactions bt where bt.book_id = p_book_id
  ) into v_has_history;

  if v_has_history then
    raise exception 'Book has borrowing history; deletion blocked';
  end if;

  select exists(
    select 1
    from library.waiting_queues wq
    join library.queue_entries qe on qe.queue_id = wq.id
    where wq.book_id = p_book_id
      and qe.status in ('waiting','notified')
  ) into v_has_queue;

  if v_has_queue then
    raise exception 'Book has active queue; deletion blocked';
  end if;

  delete from library.books where id = p_book_id;
end;
$$;

commit;