create table library.role_policies (
  role library.role_enum primary key,
  max_borrow_limit integer not null check (max_borrow_limit > 0),
  default_borrow_duration_days integer not null check (default_borrow_duration_days > 0),
  fine_threshold numeric(10,2) not null default 0
);

create table library.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role library.role_enum not null,
  created_at timestamptz not null default now()
);

create table library.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  category library.book_category_enum not null,
  status library.book_status_enum not null default 'available',
  replacement_cost numeric(10,2) not null check (replacement_cost >= 0),
  override_borrow_duration_days integer check (override_borrow_duration_days > 0),
  created_at timestamptz not null default now()
);

create table library.borrow_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references library.profiles(id) on delete cascade,
  book_id uuid not null references library.books(id) on delete cascade,
  issue_date timestamptz not null default now(),
  due_date timestamptz not null,
  return_date timestamptz,
  created_at timestamptz not null default now()
);

create table library.waiting_queues (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null unique references library.books(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table library.queue_entries (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references library.waiting_queues(id) on delete cascade,
  user_id uuid not null references library.profiles(id) on delete cascade,
  status library.queue_status_enum not null default 'waiting',
  position integer not null check (position > 0),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(queue_id, user_id)
);

create table library.fines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references library.borrow_transactions(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  status library.fine_status_enum not null default 'pending',
  created_at timestamptz not null default now()
);

create table library.university_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  uploaded_by uuid references library.profiles(id),
  created_at timestamptz not null default now()
);

create table library.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references library.university_documents(id) on delete cascade,
  content text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);