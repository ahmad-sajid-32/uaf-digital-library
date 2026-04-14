begin;

create or replace function library.get_my_dashboard(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
  v_active_borrow_count integer := 0;
  v_overdue_borrow_count integer := 0;
  v_pending_fine_count integer := 0;
  v_pending_fine_amount numeric := 0;
  v_active_queue_count integer := 0;
  v_hold_assigned_count integer := 0;
  v_next_due_borrow jsonb := null;
  v_current_hold jsonb := null;
  v_active_borrows_preview jsonb := '[]'::jsonb;
  v_queue_preview jsonb := '[]'::jsonb;
  v_fine_preview jsonb := '[]'::jsonb;
begin
  select p.role
  into v_role
  from library.profiles p
  where p.id = p_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_role <> 'student' then
    raise exception 'Insufficient privileges';
  end if;

  select
    count(*)::int,
    count(*) filter (where bt.due_date < now())::int
  into
    v_active_borrow_count,
    v_overdue_borrow_count
  from library.borrow_transactions bt
  where bt.user_id = p_user_id
    and bt.return_date is null;

  select
    count(*)::int,
    coalesce(sum(f.amount), 0)::numeric
  into
    v_pending_fine_count,
    v_pending_fine_amount
  from library.fines f
  join library.borrow_transactions bt
    on bt.id = f.transaction_id
  where bt.user_id = p_user_id
    and f.status = 'pending';

  select
    count(*) filter (
      where qe.status = 'waiting'
        or (
          qe.status = 'notified'
          and (
            qe.notified_at is null
            or qe.notified_at + interval '48 hours' > now()
          )
        )
    )::int,
    count(*) filter (
      where qe.status = 'notified'
        and (
          qe.notified_at is null
          or qe.notified_at + interval '48 hours' > now()
        )
    )::int
  into
    v_active_queue_count,
    v_hold_assigned_count
  from library.queue_entries qe
  where qe.user_id = p_user_id;

  select jsonb_build_object(
    'transaction_id', t.transaction_id,
    'book_id', t.book_id,
    'title', t.title,
    'due_date', t.due_date
  )
  into v_next_due_borrow
  from (
    select
      bt.id as transaction_id,
      bt.book_id,
      b.title,
      bt.due_date
    from library.borrow_transactions bt
    join library.books b
      on b.id = bt.book_id
    where bt.user_id = p_user_id
      and bt.return_date is null
    order by bt.due_date asc, bt.issue_date desc
    limit 1
  ) t;

  select jsonb_build_object(
    'book_id', t.book_id,
    'title', t.title,
    'hold_expires_at', t.hold_expires_at,
    'notified_at', t.notified_at
  )
  into v_current_hold
  from (
    select
      b.id as book_id,
      b.title,
      qe.notified_at,
      case
        when qe.notified_at is not null
          then qe.notified_at + interval '48 hours'
        else null
      end as hold_expires_at
    from library.queue_entries qe
    join library.waiting_queues wq
      on wq.id = qe.queue_id
    join library.books b
      on b.id = wq.book_id
    where qe.user_id = p_user_id
      and qe.status = 'notified'
      and (
        qe.notified_at is null
        or qe.notified_at + interval '48 hours' > now()
      )
    order by
      case
        when qe.notified_at is null then null
        else qe.notified_at + interval '48 hours'
      end asc nulls last,
      qe.created_at desc
    limit 1
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'transaction_id', t.transaction_id,
        'book_id', t.book_id,
        'title', t.title,
        'due_date', t.due_date,
        'renewal_count', t.renewal_count,
        'is_overdue', t.is_overdue
      )
      order by t.due_date asc, t.issue_date desc
    ),
    '[]'::jsonb
  )
  into v_active_borrows_preview
  from (
    select
      bt.id as transaction_id,
      bt.book_id,
      b.title,
      bt.issue_date,
      bt.due_date,
      bt.renewal_count,
      (bt.due_date < now()) as is_overdue
    from library.borrow_transactions bt
    join library.books b
      on b.id = bt.book_id
    where bt.user_id = p_user_id
      and bt.return_date is null
    order by bt.due_date asc, bt.issue_date desc
    limit 3
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'book_id', t.book_id,
        'title', t.title,
        'status', t.status,
        'position', t.position,
        'hold_expires_at', t.hold_expires_at
      )
      order by t.priority asc, t.sort_hold_expires_at asc nulls last, t.created_at desc
    ),
    '[]'::jsonb
  )
  into v_queue_preview
  from (
    select
      b.id as book_id,
      b.title,
      qe.status,
      qe.position,
      qe.created_at,
      case
        when qe.status = 'notified' and qe.notified_at is not null
          then qe.notified_at + interval '48 hours'
        else null
      end as hold_expires_at,
      case
        when qe.status = 'notified' then 0
        else 1
      end as priority,
      case
        when qe.status = 'notified' and qe.notified_at is not null
          then qe.notified_at + interval '48 hours'
        else null
      end as sort_hold_expires_at
    from library.queue_entries qe
    join library.waiting_queues wq
      on wq.id = qe.queue_id
    join library.books b
      on b.id = wq.book_id
    where qe.user_id = p_user_id
      and (
        qe.status = 'waiting'
        or (
          qe.status = 'notified'
          and (
            qe.notified_at is null
            or qe.notified_at + interval '48 hours' > now()
          )
        )
      )
    order by
      case
        when qe.status = 'notified' then 0
        else 1
      end asc,
      case
        when qe.status = 'notified' and qe.notified_at is not null
          then qe.notified_at + interval '48 hours'
        else null
      end asc nulls last,
      qe.created_at desc
    limit 3
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fine_id', t.fine_id,
        'title', t.title,
        'amount', t.amount,
        'status', t.status,
        'fine_created_at', t.fine_created_at
      )
      order by t.fine_created_at desc
    ),
    '[]'::jsonb
  )
  into v_fine_preview
  from (
    select
      f.id as fine_id,
      b.title,
      f.amount,
      f.status,
      f.created_at as fine_created_at
    from library.fines f
    join library.borrow_transactions bt
      on bt.id = f.transaction_id
    join library.books b
      on b.id = bt.book_id
    where bt.user_id = p_user_id
      and f.status = 'pending'
    order by f.created_at desc
    limit 3
  ) t;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'active_borrow_count', v_active_borrow_count,
      'overdue_borrow_count', v_overdue_borrow_count,
      'pending_fine_count', v_pending_fine_count,
      'pending_fine_amount', v_pending_fine_amount,
      'active_queue_count', v_active_queue_count,
      'hold_assigned_count', v_hold_assigned_count
    ),
    'next_due_borrow', v_next_due_borrow,
    'current_hold', v_current_hold,
    'active_borrows_preview', v_active_borrows_preview,
    'queue_preview', v_queue_preview,
    'fine_preview', v_fine_preview,
    'result_summary', null
  );
end;
$$;

commit;
