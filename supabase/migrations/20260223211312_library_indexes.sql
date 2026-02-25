-- Borrow transaction indexes
create index idx_borrow_user
on library.borrow_transactions(user_id);

create index idx_borrow_book
on library.borrow_transactions(book_id);

create index idx_active_borrows
on library.borrow_transactions(user_id)
where return_date is null;

-- Book indexes
create index idx_books_status
on library.books(status);

create index idx_books_category
on library.books(category);

-- Queue indexes
create index idx_queue_position
on library.queue_entries(queue_id, position);

create index idx_queue_user
on library.queue_entries(user_id);

create index idx_queue_waiting
on library.queue_entries(queue_id)
where status = 'waiting';

-- Fine indexes
create index idx_fine_status
on library.fines(status);

-- Vector similarity index
create index idx_document_chunks_embedding
on library.document_chunks
using ivfflat (embedding extensions.vector_cosine_ops)
with (lists = 100);