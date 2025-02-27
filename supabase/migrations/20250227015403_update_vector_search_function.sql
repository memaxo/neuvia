-- Migration: Update vector search function for LangChain integration
-- Description: Enhances the match_documents function to work with document_chunks table 
--              and return fields needed by LangChain, with patient_id filtering
-- Timestamp: 2025-02-27 01:54:03

-- Enhanced match_documents function that works with document_chunks table
-- and includes patient_id filtering
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  patient_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.chunk_embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where
    -- Apply patient_id filter if provided
    (patient_id is null or exists (
      select 1 from public.patient_documents pd
      where pd.id = dc.document_id and pd.patient_id = match_documents.patient_id
    ))
    -- Filter by similarity threshold
    and 1 - (dc.chunk_embedding <=> query_embedding) > match_threshold
  order by dc.chunk_embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Fix comment by specifying the full function signature
comment on function public.match_documents(vector(1536), float, int, uuid) is 'Performs similarity search across document chunks with optional patient filtering for LangChain integration';

-- Check if we need to update the index to HNSW for better performance
-- HNSW indices provide better performance for cosine similarity searches
drop index if exists idx_document_chunks_embedding;

create index idx_document_chunks_embedding_hnsw
on public.document_chunks
using hnsw (chunk_embedding vector_cosine_ops)
with (
  m = 16,
  ef_construction = 64
);

comment on index idx_document_chunks_embedding_hnsw is 'HNSW index for efficient vector similarity search with cosine distance';
