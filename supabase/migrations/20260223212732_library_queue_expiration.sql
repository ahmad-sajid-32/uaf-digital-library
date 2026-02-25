create or replace function library.process_expired_queue_holds()
returns void
language plpgsql
security definer
as $$
declare
  v_expired record;
  v_next record;
begin
  for v_expired in
    select qe.*, wq.book_id
    from library.queue_entries qe
    join library.waiting_queues wq
      on qe.queue_id = wq.id
    where qe.status = 'notified'
      and qe.notified_at < now() - interval '48 hours'
  loop

    -- Expire current hold
    update library.queue_entries
    set status = 'expired'
    where id = v_expired.id;

    -- Promote next waiting user
    select qe2.*
    into v_next
    from library.queue_entries qe2
    where qe2.queue_id = v_expired.queue_id
      and qe2.status = 'waiting'
    order by qe2.position
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

-- Schedule cron job (runs hourly)
select cron.schedule(
  'process_expired_queue_holds',
  '0 * * * *',
  $$select library.process_expired_queue_holds();$$
);