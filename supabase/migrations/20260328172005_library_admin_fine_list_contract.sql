-- supabase/migrations/20260328172005_library_admin_fine_list_contract.sql
-- Staff fine-management list contract expansion:
-- - expand staff fine list filtering with search and date windows
-- - expose filtered total-count truth for paginated admin/librarian reads

begin;

create or replace function library.get_admin_fines(
  p_status library.fine_status_enum default null,
  p_search text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_resolved_from timestamptz default null,
  p_resolved_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  fine_id uuid,
  transaction_id uuid,
  user_id uuid,
  user_full_name text,
  book_id uuid,
  title text,
  amount numeric,
  status library.fine_status_enum,
  fine_created_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name text,
  waive_reason text,
  total_count bigint
)
language plpgsql
security definer
set search_path = library, auth, public
as $$
declare
  v_search text;
  v_search_fine_id uuid;
begin
  perform library._require_history_reader();

  if p_limit is null or p_limit <= 0 then
    p_limit := 50;
  end if;

  if p_limit > 200 then
    p_limit := 200;
  end if;

  if p_offset is null or p_offset < 0 then
    p_offset := 0;
  end if;

  v_search := nullif(btrim(p_search), '');

  if v_search is not null then
    begin
      v_search_fine_id := v_search::uuid;
    exception
      when invalid_text_representation then
        v_search_fine_id := null;
    end;
  end if;

  return query
  with filtered as (
    select
      f.id as fine_id,
      f.transaction_id,
      borrower.id as user_id,
      borrower.full_name as user_full_name,
      b.id as book_id,
      b.title,
      f.amount,
      f.status,
      f.created_at as fine_created_at,
      f.resolved_at,
      f.resolved_by,
      resolver.full_name as resolved_by_name,
      f.waive_reason
    from library.fines f
    join library.borrow_transactions bt
      on bt.id = f.transaction_id
    join library.books b
      on b.id = bt.book_id
    join library.profiles borrower
      on borrower.id = bt.user_id
    left join library.profiles resolver
      on resolver.id = f.resolved_by
    where (p_status is null or f.status = p_status)
      and (
        v_search is null
        or borrower.full_name ilike '%' || v_search || '%'
        or b.title ilike '%' || v_search || '%'
        or (v_search_fine_id is not null and f.id = v_search_fine_id)
      )
      and (p_created_from is null or f.created_at >= p_created_from)
      and (p_created_to is null or f.created_at < p_created_to)
      and (
        p_resolved_from is null
        or (f.resolved_at is not null and f.resolved_at >= p_resolved_from)
      )
      and (
        p_resolved_to is null
        or (f.resolved_at is not null and f.resolved_at < p_resolved_to)
      )
  )
  select
    filtered.fine_id,
    filtered.transaction_id,
    filtered.user_id,
    filtered.user_full_name,
    filtered.book_id,
    filtered.title,
    filtered.amount,
    filtered.status,
    filtered.fine_created_at,
    filtered.resolved_at,
    filtered.resolved_by,
    filtered.resolved_by_name,
    filtered.waive_reason,
    count(*) over() as total_count
  from filtered
  order by filtered.fine_created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

commit;
