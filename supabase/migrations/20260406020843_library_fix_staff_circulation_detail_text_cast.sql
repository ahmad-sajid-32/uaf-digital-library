-- supabase/migrations/20260406020843_library_fix_staff_circulation_detail_text_cast.sql
-- Fixes the staff circulation detail RPC so returned column types match the
-- declared table contract exactly.

begin;

create or replace function library.get_staff_circulation_loan_detail(
  p_user_id uuid,
  p_transaction_id uuid
)
returns table (
  transaction_id uuid,
  user_id uuid,
  user_full_name text,
  user_email text,
  user_role library.role_enum,
  roll_number text,
  employee_code text,
  book_id uuid,
  book_title text,
  book_author text,
  book_category library.book_category_enum,
  book_status library.book_status_enum,
  issue_date timestamptz,
  due_date timestamptz,
  return_date timestamptz,
  renewal_count integer,
  is_overdue boolean,
  fine_amount numeric,
  fine_status library.fine_status_enum,
  waiting_count integer,
  queue_status text,
  hold_expires_at timestamptz,
  can_return boolean,
  can_adjust_due_date boolean,
  can_renew boolean
)
language plpgsql
security definer
set search_path = library, public
as $$
begin
  perform library._require_circulation_manager(p_user_id);

  if not exists (
    select 1
    from library.staff_circulation_directory scd
    where scd.transaction_id = p_transaction_id
  ) then
    raise exception 'Loan not found';
  end if;

  return query
  select
    scd.transaction_id,
    scd.user_id,
    scd.user_full_name,
    scd.user_email::text,
    scd.user_role,
    scd.roll_number,
    scd.employee_code,
    scd.book_id,
    scd.book_title,
    scd.book_author,
    scd.book_category,
    scd.book_status,
    scd.issue_date,
    scd.due_date,
    scd.return_date,
    scd.renewal_count,
    scd.is_overdue,
    scd.fine_amount,
    scd.fine_status,
    scd.waiting_count,
    scd.queue_status,
    scd.hold_expires_at,
    scd.can_return,
    scd.can_adjust_due_date,
    scd.can_renew
  from library.staff_circulation_directory scd
  where scd.transaction_id = p_transaction_id;
end;
$$;

commit;
