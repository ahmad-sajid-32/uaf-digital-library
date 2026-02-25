create schema if not exists library;

create type library.role_enum as enum (
  'student',
  'librarian',
  'admin'
);

create type library.book_status_enum as enum (
  'available',
  'borrowed',
  'reserved',
  'maintenance'
);

create type library.queue_status_enum as enum (
  'waiting',
  'notified',
  'expired',
  'fulfilled',
  'cancelled'
);

create type library.fine_status_enum as enum (
  'pending',
  'paid',
  'waived',
  'cancelled'
);

create type library.book_category_enum as enum (
  'science',
  'engineering',
  'agriculture',
  'computer_science',
  'mathematics',
  'business',
  'arts',
  'social_science',
  'other'
);