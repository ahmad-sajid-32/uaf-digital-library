alter table library.books
add column fine_per_day_rate numeric(10,2) not null default 0
check (fine_per_day_rate >= 0);