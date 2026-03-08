-- supabase/migrations/20260307112503_library_queue_ops.sql
-- Adds queue RPCs + fixes queue uniqueness model + hardens expiration job.

begin;

-- ------------------------------------------------------------
-- FIX: Allow re-joining queue after cancel/expire/fulfilled.
-- Current schema has UNIQUE(queue_id, user_id) which blocks re-join forever.
-- Replace it with a partial unique index for active states only.
-- ------------------------------------------------------------
do $$
declare
  v_name text;
begin
  select c.conname
  into v_name
  from pg_constraint c
  join pg_class r on r.oid = c.conrelid
  join pg_namespace n on n.oid = r.relnamespace
  where n.nspname = 'library'
    and r.relname = 'queue_entries'
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) like '%UNIQUE (queue_id, user_id)%'
  limit 1;

  if v_name is not null then
    execute format('alter table library.queue_entries drop constraint %I', v_name);
  end if;
end;
$$;

create unique index if not exists uq_queue_entries_active_user
on library.queue_entries(queue_id, user_id)
where status in ('waiting', 'notified');

-- ------------------------------------------------------------
-- RPC: join_queue(user_id, book_id)
-- Rules:
-- - Only allow queue when book is NOT available (prevents "available but queue-managed" dead state).
-- - Cap active queue (waiting + notified) at 5.
-- - Prevent duplicate active entry.
-- ------------------------------------------------------------
create or replace function library.join_queue(p_user_id uuid, p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_book record;
  v_queue_id uuid;
  v_active_count integer;
  v_next_pos integer;
begin
  -- Lock book to make decisions deterministically.
  select *
  into v_book
  from library.books
  where id = p_book_id
  for update;

  if not found then
    raise exception 'Book not found';
  end if;

  -- IMPORTANT: if book is available, user must borrow directly (otherwise queue will block borrow_book).
  if v_book.status = 'available' then
    raise exception 'Book is available; borrow directly';
  end if;

  -- Ensure queue row exists
  insert into library.waiting_queues(book_id)
  values (p_book_id)
  on conflict (book_id) do nothing;

  select id
  into v_queue_id
  from library.waiting_queues
  where book_id = p_book_id;

  -- Enforce queue cap (waiting + notified)
  select count(*)
  into v_active_count
  from library.queue_entries
  where queue_id = v_queue_id
    and status in ('waiting', 'notified');

  if v_active_count >= 5 then
    raise exception 'Queue is full';
  end if;

  -- Next position
  select coalesce(max(position), 0) + 1
  into v_next_pos
  from library.queue_entries
  where queue_id = v_queue_id;

  -- Insert waiting entry (partial unique index blocks duplicates for active states)
  insert into library.queue_entries(queue_id, user_id, status, position)
  values (v_queue_id, p_user_id, 'waiting', v_next_pos);

end;
$$;

-- ------------------------------------------------------------
-- RPC: cancel_queue(user_id, book_id)
-- Rules:
-- - Cancel active entry (waiting/notified).
-- - If cancelling notified hold, promote next waiting to notified and update book status.
-- ------------------------------------------------------------
create or replace function library.cancel_queue(p_user_id uuid, p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_book record;
  v_queue_id uuid;
  v_entry record;
  v_next record;
begin
  -- Lock book row because we may change status.
  select *
  into v_book
  from library.books
  where id = p_book_id
  for update;

  if not found then
    raise exception 'Book not found';
  end if;

  select id
  into v_queue_id
  from library.waiting_queues
  where book_id = p_book_id;

  if v_queue_id is null then
    raise exception 'Queue not found';
  end if;

  -- Lock the user entry
  select *
  into v_entry
  from library.queue_entries
  where queue_id = v_queue_id
    and user_id = p_user_id
    and status in ('waiting', 'notified')
  for update;

  if not found then
    raise exception 'Active queue entry not found';
  end if;

  update library.queue_entries
  set status = 'cancelled'
  where id = v_entry.id;

  -- If cancelling a hold, promote next waiting
  if v_entry.status = 'notified' then
    select *
    into v_next
    from library.queue_entries
    where queue_id = v_queue_id
      and status = 'waiting'
    order by position
    limit 1
    for update;

    if found then
      update library.queue_entries
      set status = 'notified',
          notified_at = now()
      where id = v_next.id;

      update library.books
      set status = 'reserved'
      where id = p_book_id;
    else
      update library.books
      set status = 'available'
      where id = p_book_id;
    end if;
  end if;

end;
$$;

-- ------------------------------------------------------------
-- HARDEN: process_expired_queue_holds() must lock the book row
-- before updating books.status to avoid races with borrow/return.
-- ------------------------------------------------------------
create or replace function library.process_expired_queue_holds()
returns void
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_expired record;
  v_next record;
  v_book record;
begin
  for v_expired in
    select qe.*, wq.book_id
    from library.queue_entries qe
    join library.waiting_queues wq
      on qe.queue_id = wq.id
    where qe.status = 'notified'
      and qe.notified_at < now() - interval '48 hours'
  loop
    -- Lock book row before status mutation.
    select *
    into v_book
    from library.books
    where id = v_expired.book_id
    for update;

    -- Expire current hold
    update library.queue_entries
    set status = 'expired'
    where id = v_expired.id;

    -- Promote next waiting
    select *
    into v_next
    from library.queue_entries
    where queue_id = v_expired.queue_id
      and status = 'waiting'
    order by position
    limit 1
    for update;

    if found then
      update library.queue_entries
      set status = 'notified',
          notified_at = now()
      where id = v_next.id;

      update library.books
      set status = 'reserved'
      where id = v_expired.book_id;
    else
      update library.books
      set status = 'available'
      where id = v_expired.book_id;
    end if;
  end loop;
end;
$$;

commit;