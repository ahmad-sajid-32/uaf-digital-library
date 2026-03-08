begin;

drop index if exists library.idx_document_chunks_embedding;

alter table library.document_chunks
    alter column embedding type extensions.vector(384);

create index idx_document_chunks_embedding
    on library.document_chunks
    using ivfflat (embedding extensions.vector_cosine_ops)
    with (lists = 100);

commit;
