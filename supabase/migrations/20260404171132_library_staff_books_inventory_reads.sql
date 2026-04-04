-- supabase/migrations/20260404171132_library_staff_books_inventory_reads.sql
-- Staff inventory read RPCs for librarian/admin book management.

begin;

create or replace function library.get_staff_books(
  p_user_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_total integer;
  v_items jsonb;
begin
  perform library._require_books_manager(p_user_id);

  if p_limit is null or p_limit <= 0 then
    p_limit := 50;
  end if;

  if p_limit > 200 then
    p_limit := 200;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  select count(*)::int
  into v_total
  from library.books;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'author', t.author,
        'category', t.category,
        'status', t.status,
        'replacement_cost', t.replacement_cost,
        'fine_per_day_rate', t.fine_per_day_rate,
        'override_borrow_duration_days', t.override_borrow_duration_days,
        'created_at', t.created_at
      )
      order by t.created_at desc, t.id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      b.id,
      b.title,
      b.author,
      b.category,
      b.status,
      b.replacement_cost,
      b.fine_per_day_rate,
      b.override_borrow_duration_days,
      b.created_at
    from library.books b
    order by b.created_at desc, b.id desc
    limit p_limit
    offset p_offset
  ) t;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

create or replace function library.get_staff_book_by_id(
  p_user_id uuid,
  p_book_id uuid
)
returns table (
  id uuid,
  title text,
  author text,
  category library.book_category_enum,
  status library.book_status_enum,
  replacement_cost numeric,
  fine_per_day_rate numeric,
  override_borrow_duration_days integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_books_manager(p_user_id);

  if not exists (
    select 1
    from library.books b
    where b.id = p_book_id
  ) then
    raise exception 'Book not found';
  end if;

  return query
  select
    b.id,
    b.title,
    b.author,
    b.category,
    b.status,
    b.replacement_cost,
    b.fine_per_day_rate,
    b.override_borrow_duration_days,
    b.created_at
  from library.books b
  where b.id = p_book_id;
end;
$$;

commit;
