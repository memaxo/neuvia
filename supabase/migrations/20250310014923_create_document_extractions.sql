-- Migration: 20250310014923_create_document_extractions.sql
-- Description: Creates a table to cache document extractions for improved performance

-- Create the document_extractions table to store cached extraction results
create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.patient_documents(id) on delete cascade,
  extraction jsonb not null,
  extraction_date timestamptz default now(),
  extraction_model text not null,
  extraction_version text not null,
  extraction_confidence real not null,
  is_latest boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  last_modified_by uuid references auth.users(id)
);

comment on table public.document_extractions is 'Caches document extraction results to improve performance of patient summary generation and avoid redundant processing';
comment on column public.document_extractions.id is 'Unique identifier for the extraction record';
comment on column public.document_extractions.document_id is 'Reference to the source document that was extracted';
comment on column public.document_extractions.extraction is 'The JSON representation of the extracted document data';
comment on column public.document_extractions.extraction_date is 'When the document was extracted';
comment on column public.document_extractions.extraction_model is 'Name of the AI model used for extraction';
comment on column public.document_extractions.extraction_version is 'Version of the extraction algorithm/model';
comment on column public.document_extractions.extraction_confidence is 'Confidence score of the extraction (0-1)';
comment on column public.document_extractions.is_latest is 'Flag indicating if this is the most recent extraction for the document';

-- Create indexes for common query patterns
create index idx_document_extractions_document_id on public.document_extractions(document_id);
create index idx_document_extractions_is_latest on public.document_extractions(is_latest);
create index idx_document_extractions_extraction_date on public.document_extractions(extraction_date);

-- Add a function to automatically update the updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create a trigger to update the updated_at column
create trigger set_document_extractions_updated_at
before update on public.document_extractions
for each row
execute function public.handle_updated_at();

-- Enable Row Level Security
alter table public.document_extractions enable row level security;

-- Create policies for authenticated users
create policy "Authenticated users can view document extractions" 
on public.document_extractions
for select
to authenticated
using (true);

create policy "Authenticated users can insert document extractions" 
on public.document_extractions
for insert
to authenticated
with check (auth.uid() = created_by);

create policy "Authenticated users can update document extractions they created" 
on public.document_extractions
for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = last_modified_by);

create policy "Authenticated users can delete document extractions they created" 
on public.document_extractions
for delete
to authenticated
using (auth.uid() = created_by);

-- Create Function to retrieve latest document extraction
create or replace function public.get_latest_document_extraction(p_document_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_extraction jsonb;
begin
  select extraction into v_extraction
  from public.document_extractions
  where document_id = p_document_id
  and is_latest = true
  order by extraction_date desc
  limit 1;
  
  return v_extraction;
end;
$$;

-- Function to update extraction and manage is_latest flag
create or replace function public.update_document_extraction(
  p_document_id uuid,
  p_extraction jsonb,
  p_extraction_model text,
  p_extraction_version text,
  p_extraction_confidence real,
  p_user_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_extraction_id uuid;
begin
  -- Set all existing extractions for this document to not latest
  update public.document_extractions
  set is_latest = false
  where document_id = p_document_id
  and is_latest = true;
  
  -- Insert the new extraction
  insert into public.document_extractions(
    document_id,
    extraction,
    extraction_model,
    extraction_version,
    extraction_confidence,
    is_latest,
    created_by,
    last_modified_by
  )
  values (
    p_document_id,
    p_extraction,
    p_extraction_model,
    p_extraction_version,
    p_extraction_confidence,
    true,
    p_user_id,
    p_user_id
  )
  returning id into v_extraction_id;
  
  return v_extraction_id;
end;
$$;
