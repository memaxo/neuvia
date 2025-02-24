-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create the documents table to store original content
create table public.documents (
  id bigint generated always as identity primary key,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade
);

comment on table public.documents is 'Stores original document content for the RAG system';

-- Enable RLS on documents
alter table public.documents enable row level security;

-- Create the document_embeddings table to store chunked content and embeddings
create table public.document_embeddings (
  id bigint generated always as identity primary key,
  document_id bigint references public.documents(id) on delete cascade,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.document_embeddings is 'Stores document chunks and their vector embeddings for semantic search';

-- Enable RLS on document_embeddings
alter table public.document_embeddings enable row level security;

-- Create an index for faster similarity searches
create index document_embeddings_embedding_idx 
on public.document_embeddings 
using hnsw (embedding vector_cosine_ops)
with (
  m = 16,
  ef_construction = 64
);

-- Function to match documents based on embedding similarity
create or replace function public.match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  content text,
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
    public.document_embeddings.content,
    1 - (public.document_embeddings.embedding <=> query_embedding) as similarity
  from public.document_embeddings
  where 1 - (public.document_embeddings.embedding <=> query_embedding) > match_threshold
  order by public.document_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create RLS policies for documents

-- Authenticated users can view their own documents
create policy "Users can view their own documents"
on public.documents
for select
to authenticated
using (
  auth.uid() = user_id
);

-- Authenticated users can insert their own documents
create policy "Users can insert their own documents"
on public.documents
for insert
to authenticated
with check (
  auth.uid() = user_id
);

-- Authenticated users can update their own documents
create policy "Users can update their own documents"
on public.documents
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

-- Authenticated users can delete their own documents
create policy "Users can delete their own documents"
on public.documents
for delete
to authenticated
using (
  auth.uid() = user_id
);

-- Create RLS policies for document_embeddings

-- Authenticated users can view embeddings of their documents
create policy "Users can view embeddings of their documents"
on public.document_embeddings
for select
to authenticated
using (
  exists (
    select 1
    from public.documents
    where documents.id = document_embeddings.document_id
    and documents.user_id = auth.uid()
  )
);

-- Authenticated users can insert embeddings for their documents
create policy "Users can insert embeddings for their documents"
on public.document_embeddings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents
    where documents.id = document_embeddings.document_id
    and documents.user_id = auth.uid()
  )
);

-- Authenticated users can delete embeddings of their documents
create policy "Users can delete embeddings of their documents"
on public.document_embeddings
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents
    where documents.id = document_embeddings.document_id
    and documents.user_id = auth.uid()
  )
);

-- Create trigger to update the updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger documents_handle_updated_at
  before update on public.documents
  for each row
  execute function public.handle_updated_at();
