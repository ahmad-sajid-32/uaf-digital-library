-- Enable RLS on all library tables

alter table library.profiles enable row level security;
alter table library.role_policies enable row level security;
alter table library.books enable row level security;
alter table library.borrow_transactions enable row level security;
alter table library.waiting_queues enable row level security;
alter table library.queue_entries enable row level security;
alter table library.fines enable row level security;
alter table library.university_documents enable row level security;
alter table library.document_chunks enable row level security;

-- Prevent public access
revoke all on all tables in schema library from public;

-- =============================
-- STUDENT POLICIES
-- =============================

-- Students can read their own profile
create policy student_read_own_profile
on library.profiles
for select
using (auth.uid() = id);

-- Students can view their own borrow transactions
create policy student_read_own_borrows
on library.borrow_transactions
for select
using (auth.uid() = user_id);

-- Students can view their own fines
create policy student_read_own_fines
on library.fines
for select
using (
  exists (
    select 1 from library.borrow_transactions bt
    where bt.id = transaction_id
    and bt.user_id = auth.uid()
  )
);

-- Students can view queue entries where they are participant
create policy student_read_own_queue_entries
on library.queue_entries
for select
using (auth.uid() = user_id);

-- =============================
-- LIBRARIAN POLICIES
-- =============================

-- Librarians can manage books
create policy librarian_manage_books
on library.books
for all
using (
  exists (
    select 1 from library.profiles p
    where p.id = auth.uid()
    and p.role = 'librarian'
  )
);

-- Librarians can manage queues
create policy librarian_manage_queue
on library.queue_entries
for all
using (
  exists (
    select 1 from library.profiles p
    where p.id = auth.uid()
    and p.role = 'librarian'
  )
);

-- =============================
-- ADMIN POLICIES
-- =============================

create policy admin_full_access
on library.profiles
for all
using (
  exists (
    select 1 from library.profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
  )
);

create policy admin_books_access
on library.books
for all
using (
  exists (
    select 1 from library.profiles p
    where p.id = auth.uid()
    and p.role = 'admin'
  )
);