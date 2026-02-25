-- ===========================
-- ACTIVE BORROWS
-- ===========================

create materialized view library.mv_active_borrows as
select
  count(*) as active_borrow_count
from library.borrow_transactions
where return_date is null;


-- ===========================
-- OVERDUE SUMMARY
-- ===========================

create materialized view library.mv_overdue_summary as
select
  count(*) as overdue_count
from library.borrow_transactions
where return_date is null
  and due_date < now();


-- ===========================
-- FINE SUMMARY
-- ===========================

create materialized view library.mv_fine_summary as
select
  sum(amount) as total_pending_fines
from library.fines
where status = 'pending';


-- ===========================
-- POPULAR BOOKS
-- ===========================

create materialized view library.mv_popular_books as
select
  b.id,
  b.title,
  count(bt.id) as borrow_count
from library.books b
left join library.borrow_transactions bt
  on bt.book_id = b.id
group by b.id, b.title
order by borrow_count desc;


-- ===========================
-- QUEUE PRESSURE
-- ===========================

create materialized view library.mv_queue_pressure as
select
  b.id,
  b.title,
  count(qe.id) as waiting_count
from library.books b
left join library.waiting_queues wq
  on wq.book_id = b.id
left join library.queue_entries qe
  on qe.queue_id = wq.id
  and qe.status = 'waiting'
group by b.id, b.title
order by waiting_count desc;


-- ===========================
-- INDEXES ON MATERIALIZED VIEWS
-- ===========================

create index on library.mv_popular_books(borrow_count);
create index on library.mv_queue_pressure(waiting_count);


-- ===========================
-- NIGHTLY REFRESH (2 AM)
-- ===========================

select cron.schedule(
  'refresh_library_materialized_views',
  '0 2 * * *',
  $$
  refresh materialized view library.mv_active_borrows;
  refresh materialized view library.mv_overdue_summary;
  refresh materialized view library.mv_fine_summary;
  refresh materialized view library.mv_popular_books;
  refresh materialized view library.mv_queue_pressure;
  $$
);