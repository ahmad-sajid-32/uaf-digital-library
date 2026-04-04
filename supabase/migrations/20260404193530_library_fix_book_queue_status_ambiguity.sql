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
  select *
  into v_book
  from library.books b
  where b.id = p_book_id;

  if not found then
    raise exception 'Book not found';
  end if;

  select wq.id
  into v_queue_id
  from library.waiting_queues wq
  where wq.book_id = p_book_id;

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
