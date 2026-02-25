-- ================================================
-- RPC: get_public_catalog
-- Cursor-based public catalog listing.
-- Composite cursor (created_at, id).
-- Includes supporting composite index.
-- ================================================

-- --------------------------------
-- Composite Index (required)
-- --------------------------------
create index if not exists idx_books_created_at_id
on library.books (created_at asc, id asc);

-- --------------------------------
-- RPC Function
-- --------------------------------
create or replace function library.get_public_catalog(
    p_cursor_created_at timestamptz default null,
    p_cursor_id uuid default null,
    p_limit integer default 20
)
returns table (
    id uuid,
    title text,
    author text,
    category library.book_category_enum,
    status library.book_status_enum,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = library
as $$
begin

    -- Defensive limit enforcement
    if p_limit is null or p_limit <= 0 then
        p_limit := 20;
    end if;

    if p_limit > 100 then
        p_limit := 100;
    end if;

    -- First page (no cursor)
    if p_cursor_created_at is null or p_cursor_id is null then

        return query
        select
            b.id,
            b.title,
            b.author,
            b.category,
            b.status,
            b.created_at
        from library.books b
        order by b.created_at asc, b.id asc
        limit p_limit;

    else

        -- Subsequent pages
        return query
        select
            b.id,
            b.title,
            b.author,
            b.category,
            b.status,
            b.created_at
        from library.books b
        where
            (b.created_at, b.id) >
            (p_cursor_created_at, p_cursor_id)
        order by b.created_at asc, b.id asc
        limit p_limit;

    end if;

end;
$$;