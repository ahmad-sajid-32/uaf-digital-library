-- =====================================================
-- UAF Smart E-Library
-- Auth Extension: Role Metadata + Profile Trigger
-- =====================================================

-- =========================
-- 1. Role Metadata Tables
-- =========================

create table library.students (
    id uuid primary key
        references library.profiles(id)
        on delete cascade,
    roll_number text not null unique,
    department text not null,
    semester integer not null check (semester > 0),
    created_at timestamptz not null default now(),
    constraint students_roll_number_format_check
        check (roll_number ~ '^\d{4}-[a-z]{2}-\d{4}$')
);

create table library.librarians (
    id uuid primary key
        references library.profiles(id)
        on delete cascade,
    employee_code text not null unique,
    department text not null,
    created_at timestamptz not null default now()
);

create table library.admins (
    id uuid primary key
        references library.profiles(id)
        on delete cascade,
    designation text not null,
    created_at timestamptz not null default now()
);

-- =========================
-- 2. Profile Auto-Creation Trigger
-- =========================

create or replace function library.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = library, public
as $$
declare
    v_role library.role_enum;
    v_full_name text;
begin
    -- Extract role from app metadata
    v_role := (new.raw_app_meta_data->>'role')::library.role_enum;

    if v_role is null then
        raise exception 'Role must be provided in app_metadata during user creation';
    end if;

    -- Extract optional full name
    v_full_name := new.raw_user_meta_data->>'full_name';

    if v_full_name is null then
        v_full_name := 'Unnamed User';
    end if;

    -- Insert into profiles
    insert into library.profiles (
        id,
        full_name,
        role,
        created_at
    )
    values (
        new.id,
        v_full_name,
        v_role,
        now()
    );

    return new;
end;
$$;

-- =========================
-- 3. Trigger Binding
-- =========================

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function library.handle_new_auth_user();