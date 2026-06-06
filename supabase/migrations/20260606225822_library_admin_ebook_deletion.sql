-- Allow administrators to remove any E-Book without access history while
-- preserving draft-only deletion authority for librarians.

begin;

create or replace function library.delete_ebook(
  p_user_id uuid,
  p_ebook_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = library, public
as $$
declare
  v_role library.role_enum;
  v_status library.ebook_status_enum;
  v_result jsonb;
begin
  v_role := library._require_ebook_identity(p_user_id);

  if v_role not in ('librarian', 'admin') then
    raise exception 'Insufficient privileges';
  end if;

  select
    e.status,
    jsonb_strip_nulls(jsonb_build_object(
      'bucket_name', f.bucket_name,
      'storage_object_path', f.storage_object_path,
      'cover_image_path', e.cover_image_path
    ))
  into v_status, v_result
  from library.ebooks e
  left join library.ebook_files f on f.ebook_id = e.id
  where e.id = p_ebook_id;

  if v_status is null then
    raise exception 'E-Book not found';
  end if;

  if exists (
    select 1
    from library.ebook_access_events
    where ebook_id = p_ebook_id
  ) then
    raise exception 'E-Book has access history; deletion blocked';
  end if;

  if v_role <> 'admin' and v_status <> 'draft' then
    raise exception 'Only administrators can delete published or archived E-Books';
  end if;

  delete from library.ebooks where id = p_ebook_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function library.delete_ebook(uuid, uuid) from public, anon, authenticated;

commit;
