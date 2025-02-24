-- Migration: Create workflow state table
-- Description: Creates a table to track workflow states for document processing and chat interactions
-- Timestamp: 2024-02-24 05:28:02

-- Create enum for workflow steps
create type public.workflow_step as enum (
  'idle',
  'uploading',
  'extracting',
  'verification',
  'report_generation',
  'complete'
);

comment on type public.workflow_step is 'Defines the possible states in the document processing workflow';

-- Create workflow state table
create table public.workflow_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  current_step workflow_step not null default 'idle',
  metadata jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint workflow_states_user_id_key unique (user_id),
  constraint workflow_states_metadata_check check (
    case jsonb_typeof(metadata)
      when 'object' then true
      when 'null' then true
      else false
    end
  )
);

comment on table public.workflow_states is 'Tracks the current state of document processing workflows for each user';
comment on column public.workflow_states.metadata is 'Additional workflow state data in JSON format';

-- Add indexes
create index workflow_states_user_id_idx on public.workflow_states(user_id);
create index workflow_states_current_step_idx on public.workflow_states(current_step);

-- Enable RLS
alter table public.workflow_states enable row level security;

-- Create RLS policies
create policy "Users can view their own workflow states."
  on public.workflow_states
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own workflow states."
  on public.workflow_states
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own workflow states."
  on public.workflow_states
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own workflow states."
  on public.workflow_states
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Create updated_at trigger function
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

comment on function public.handle_updated_at() is 'Trigger function to automatically update updated_at timestamp';

create trigger workflow_states_updated_at
  before update on public.workflow_states
  for each row
  execute function public.handle_updated_at();

-- Create function to update workflow state
create or replace function public.update_workflow_state(
  p_user_id uuid,
  p_step workflow_step,
  p_metadata jsonb default null
)
returns public.workflow_states
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_workflow_state public.workflow_states;
begin
  -- Validate metadata is an object if provided
  if p_metadata is not null and jsonb_typeof(p_metadata) != 'object' then
    raise exception 'metadata must be a JSON object';
  end if;

  -- Insert or update workflow state
  insert into public.workflow_states (user_id, current_step, metadata)
  values (p_user_id, p_step, p_metadata)
  on conflict (user_id) do update
    set current_step = p_step,
        metadata = coalesce(p_metadata, public.workflow_states.metadata),
        updated_at = timezone('utc'::text, now())
  returning * into v_workflow_state;

  return v_workflow_state;
end;
$$;

comment on function public.update_workflow_state(uuid, workflow_step, jsonb) is 'Updates or creates a workflow state for a user with optional metadata';
