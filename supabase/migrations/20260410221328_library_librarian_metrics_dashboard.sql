-- Librarian-safe operational metrics read model for the dashboard surface.

begin;

create or replace function library.get_librarian_dashboard_metrics(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
  v_active_loan_count integer;
  v_overdue_loan_count integer;
  v_pending_fine_count integer;
  v_queue_hotspots jsonb;
  v_popular_books jsonb;
begin
  select p.role
  into v_role
  from library.profiles p
  where p.id = p_user_id;

  if v_role is null then
    raise exception 'User profile not found';
  end if;

  if v_role <> 'librarian' then
    raise exception 'Insufficient privileges';
  end if;

  select count(*)::int
  into v_active_loan_count
  from library.borrow_transactions bt
  where bt.return_date is null;

  select count(*)::int
  into v_overdue_loan_count
  from library.borrow_transactions bt
  where bt.return_date is null
    and bt.due_date < now();

  select count(*)::int
  into v_pending_fine_count
  from library.fines f
  where f.status = 'pending';

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
  into v_queue_hotspots
  from (
    select
      qp.id,
      qp.title,
      qp.waiting_count
    from library.mv_queue_pressure qp
    where qp.waiting_count > 0
    order by qp.waiting_count desc, qp.title asc
    limit 5
  ) t;

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
  into v_popular_books
  from (
    select
      pb.id,
      pb.title,
      pb.borrow_count
    from library.mv_popular_books pb
    where pb.borrow_count > 0
    order by pb.borrow_count desc, pb.title asc
    limit 5
  ) t;

  return jsonb_build_object(
    'active_loan_count', v_active_loan_count,
    'overdue_loan_count', v_overdue_loan_count,
    'pending_fine_count', v_pending_fine_count,
    'queue_hotspots', v_queue_hotspots,
    'popular_books', v_popular_books
  );
end;
$$;

commit;
