begin;

alter table library.profiles
add column if not exists is_active boolean;

update library.profiles
set is_active = true
where is_active is null;

alter table library.profiles
alter column is_active set default true;

alter table library.profiles
alter column is_active set not null;

create index if not exists idx_profiles_is_active
on library.profiles(is_active);

create index if not exists idx_profiles_role_is_active
on library.profiles(role, is_active);

commit;
