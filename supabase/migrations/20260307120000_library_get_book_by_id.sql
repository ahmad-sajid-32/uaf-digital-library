-- supabase/migrations/20260307120000_library_get_book_by_id.sql
-- Public RPC for retrieving a single book by UUID.

begin;

create or replace function library.get_book_by_id(
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
