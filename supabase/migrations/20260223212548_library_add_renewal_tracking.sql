alter table library.borrow_transactions
add column renewal_count integer not null default 0
check (renewal_count >= 0);