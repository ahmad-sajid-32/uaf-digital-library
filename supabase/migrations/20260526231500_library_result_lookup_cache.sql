create table if not exists library.result_lookup_cache (
    reg_number_hash text primary key,
    result_payload jsonb null,
    cache_status text not null,
    calculation_status text null,
    cgpa numeric null,
    source_checked_at timestamptz not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint result_lookup_cache_hash_format
        check (reg_number_hash ~ '^[0-9a-f]{64}$'),
    constraint result_lookup_cache_status_valid
        check (cache_status in ('success', 'not_found')),
    constraint result_lookup_cache_payload_matches_status
        check (
            (
                cache_status = 'success'
                and result_payload is not null
                and calculation_status is not null
            )
            or (
                cache_status = 'not_found'
                and result_payload is null
                and calculation_status is null
                and cgpa is null
            )
        )
);

alter table library.result_lookup_cache enable row level security;

create index if not exists idx_result_lookup_cache_expires_at
    on library.result_lookup_cache (expires_at);

create index if not exists idx_result_lookup_cache_updated_at
    on library.result_lookup_cache (updated_at desc);

create or replace function library.get_result_lookup_cache(
    p_reg_number_hash text
)
returns table (
    reg_number_hash text,
    result_payload jsonb,
    cache_status text,
    calculation_status text,
    cgpa numeric,
    source_checked_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
security definer
set search_path = library, public
as $$
    select
        c.reg_number_hash,
        c.result_payload,
        c.cache_status,
        c.calculation_status,
        c.cgpa,
        c.source_checked_at,
        c.expires_at,
        c.created_at,
        c.updated_at
    from library.result_lookup_cache c
    where c.reg_number_hash = p_reg_number_hash
      and c.expires_at > now()
    limit 1;
$$;

create or replace function library.upsert_result_lookup_cache(
    p_reg_number_hash text,
    p_result_payload jsonb,
    p_cache_status text,
    p_calculation_status text,
    p_cgpa numeric,
    p_source_checked_at timestamptz,
    p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = library, public
as $$
begin
    if p_reg_number_hash is null
       or p_reg_number_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'Invalid result cache key';
    end if;

    if p_cache_status not in ('success', 'not_found') then
        raise exception 'Invalid result cache status';
    end if;

    if p_source_checked_at is null or p_expires_at is null then
        raise exception 'Result cache timestamps are required';
    end if;

    if p_expires_at <= p_source_checked_at then
        raise exception 'Result cache expiry must be after source check time';
    end if;

    if p_cache_status = 'success' then
        if p_result_payload is null or p_calculation_status is null then
            raise exception 'Successful result cache payload is incomplete';
        end if;
    else
        if p_result_payload is not null
           or p_calculation_status is not null
           or p_cgpa is not null then
            raise exception 'Not-found result cache payload must be empty';
        end if;
    end if;

    insert into library.result_lookup_cache (
        reg_number_hash,
        result_payload,
        cache_status,
        calculation_status,
        cgpa,
        source_checked_at,
        expires_at,
        updated_at
    )
    values (
        p_reg_number_hash,
        p_result_payload,
        p_cache_status,
        p_calculation_status,
        p_cgpa,
        p_source_checked_at,
        p_expires_at,
        now()
    )
    on conflict (reg_number_hash)
    do update
    set
        result_payload = excluded.result_payload,
        cache_status = excluded.cache_status,
        calculation_status = excluded.calculation_status,
        cgpa = excluded.cgpa,
        source_checked_at = excluded.source_checked_at,
        expires_at = excluded.expires_at,
        updated_at = now();
end;
$$;

create or replace function library.purge_expired_result_lookup_cache()
returns integer
language plpgsql
security definer
set search_path = library, public
as $$
declare
    v_deleted_count integer;
begin
    delete from library.result_lookup_cache
    where expires_at <= now();

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;
