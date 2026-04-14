begin;

drop function if exists library.get_my_queue_entries(uuid);

create or replace function library.get_my_queue_entries(p_user_id uuid)
returns table (
  book_id uuid,
  title text,
  status library.queue_status_enum,
  "position" integer,
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
    qe.position as "position",
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

commit;
