-- Tighten E-Book metadata consistency after the foundation migration.

begin;

alter table library.ebook_files
  drop constraint ebook_files_failure_note,
  add constraint ebook_files_failure_note check (
    file_status <> 'failed'
    or (
      validation_error is not null
      and length(trim(validation_error)) > 0
    )
  );

alter table library.ebooks
  drop constraint ebooks_cover_metadata_consistent,
  add constraint ebooks_cover_metadata_consistent check (
    (
      cover_image_path is null
      and cover_image_alt is null
      and cover_image_mime_type is null
      and cover_image_size_bytes is null
      and cover_image_updated_at is null
    )
    or (
      cover_image_path ~ '^ebooks/[0-9a-f-]{36}/cover\.(jpg|png|webp)$'
      and cover_image_mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and cover_image_size_bytes between 1 and 2097152
      and cover_image_updated_at is not null
    )
  );

commit;
