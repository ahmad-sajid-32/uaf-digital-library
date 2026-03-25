create table if not exists library.rate_limit_counters (
    tier text not null,
    key_hash text not null,
    window_started_at timestamptz not null,
    request_count integer not null default 1 check (request_count >= 1),
    expires_at timestamptz not null,
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    primary key (tier, key_hash, window_started_at)
);

create index if not exists idx_rate_limit_counters_expires_at
    on library.rate_limit_counters (expires_at);

create index if not exists idx_rate_limit_counters_last_seen_at
    on library.rate_limit_counters (last_seen_at desc);
