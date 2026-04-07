-- Tighten the admin metrics RPC to true admin-only access.

begin;

create or replace function library.get_admin_metrics(
  p_user_id uuid,
  p_popular_limit integer default 10,
  p_queue_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
  v_active_borrows integer;
  v_overdue integer;
  v_pending_fines numeric;
  v_popular jsonb;
  v_queue jsonb;
begin
  select role
  into v_role
  from library.profiles
  where id = p_user_id;

  if v_role is null then
    raise exception 'User profile not found';
  end if;

  if v_role <> 'admin' then
    raise exception 'Insufficient privileges';
  end if;

  select count(*)::int
  into v_active_borrows
  from library.borrow_transactions
  where return_date is null;

  select count(*)::int
  into v_overdue
  from library.borrow_transactions
  where return_date is null
    and due_date < now();

  select coalesce(sum(amount), 0)
  into v_pending_fines
  from library.fines
  where status = 'pending';

  if p_popular_limit is null or p_popular_limit <= 0 then
    p_popular_limit := 10;
  end if;

  if p_popular_limit > 50 then
    p_popular_limit := 50;
  end if;

  if p_queue_limit is null or p_queue_limit <= 0 then
    p_queue_limit := 10;
  end if;

  if p_queue_limit > 50 then
    p_queue_limit := 50;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'book_id', t.id,
        'title', t.title,
        'borrow_count', t.borrow_count
      )
    ),
    '[]'::jsonb
  )
  into v_popular
  from (
    select id, title, borrow_count
    from library.mv_popular_books
    order by borrow_count desc
    limit p_popular_limit
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'book_id', t.id,
        'title', t.title,
        'waiting_count', t.waiting_count
      )
    ),
    '[]'::jsonb
  )
  into v_queue
  from (
    select id, title, waiting_count
    from library.mv_queue_pressure
    order by waiting_count desc
    limit p_queue_limit
  ) t;

  return jsonb_build_object(
    'active_borrow_count', v_active_borrows,
    'overdue_count', v_overdue,
    'total_pending_fines', v_pending_fines,
    'popular_books', v_popular,
    'queue_pressure', v_queue
  );
end;
$$;

commit;
