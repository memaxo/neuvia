-- Migration: Extend workflow_states table with thread management features
-- Description: Enhances existing workflow state with thread lifecycle management and branching support
-- Created by: Database Administrator
-- Affected tables: workflow_states
-- Security considerations: Maintains existing RLS policies with additional columns
-- Risk assessment: Non-destructive schema changes with new features
-- Timestamp: 2025-03-17 01:15:01 UTC

-- Add column for thread_id to explicitly store LangGraph thread IDs
alter table public.workflow_states 
add column if not exists thread_id uuid,
-- Add descriptive name for thread
add column if not exists thread_name text,
-- Add thread status for lifecycle management
add column if not exists thread_status text 
  check (thread_status in ('active', 'paused', 'completed', 'archived', 'error')),
-- Add thread expiration fields
add column if not exists expires_at timestamptz,
add column if not exists auto_archive boolean default false,
-- Add thread metadata for additional context
add column if not exists thread_metadata jsonb default '{}'::jsonb;

-- Add unique constraint to thread_id before using it as foreign key reference
alter table public.workflow_states
add constraint workflow_states_thread_id_key unique (thread_id);

-- Now add the parent thread relationship after thread_id has a unique constraint
alter table public.workflow_states
add column if not exists parent_thread_id uuid references public.workflow_states(thread_id);

-- Add a constraint to ensure thread metadata is a valid JSON object
alter table public.workflow_states
add constraint workflow_states_thread_metadata_check check (
  case jsonb_typeof(thread_metadata)
    when 'object' then true
    when 'null' then true
    else false
  end
);

-- Create index for efficient thread lookups
create index if not exists workflow_states_thread_id_idx on public.workflow_states(thread_id);
create index if not exists workflow_states_parent_thread_id_idx on public.workflow_states(parent_thread_id);
create index if not exists workflow_states_thread_status_idx on public.workflow_states(thread_status);
create index if not exists workflow_states_expires_at_idx on public.workflow_states(expires_at);

-- Add comment explanations
comment on column public.workflow_states.thread_id is 'LangGraph thread ID for state persistence and continuations';
comment on column public.workflow_states.thread_name is 'Human-readable name for the thread';
comment on column public.workflow_states.thread_status is 'Current lifecycle status of the thread (active, paused, completed, archived, error)';
comment on column public.workflow_states.parent_thread_id is 'Reference to parent thread ID for forked threads';
comment on column public.workflow_states.expires_at is 'Timestamp when this thread should be considered expired';
comment on column public.workflow_states.auto_archive is 'Whether to automatically archive this thread when completed or expired';
comment on column public.workflow_states.thread_metadata is 'Additional thread-specific metadata in JSON format';

-- Update RLS policies to include the new columns
-- The existing RLS is maintained but policies are updated to consider new thread-related columns

-- Drop existing policies to recreate them with the updated column access
drop policy if exists "Users can view their own workflow states." on public.workflow_states;
drop policy if exists "Users can create their own workflow states." on public.workflow_states;
drop policy if exists "Users can update their own workflow states." on public.workflow_states;
drop policy if exists "Users can delete their own workflow states." on public.workflow_states;

-- Recreate policies with proper granularity for authenticated users
create policy "Users can view their own workflow states." 
on public.workflow_states
for select
to authenticated
using (
  (auth.uid() = user_id)
);

create policy "Users can create their own workflow states." 
on public.workflow_states
for insert
to authenticated
with check (
  (auth.uid() = user_id)
);

create policy "Users can update their own workflow states." 
on public.workflow_states
for update
to authenticated
using (
  (auth.uid() = user_id)
)
with check (
  (auth.uid() = user_id)
);

create policy "Users can delete their own workflow states." 
on public.workflow_states
for delete
to authenticated
using (
  (auth.uid() = user_id)
);

-- Create a thread forking function
create or replace function public.fork_workflow_thread(
  p_thread_id uuid,
  p_new_thread_name text default null,
  p_thread_metadata jsonb default null
)
returns uuid
language plpgsql
security invoker -- Using invoker security to enforce RLS policies
set search_path = ''
as $$
declare
  v_parent_state jsonb;
  v_new_thread_id uuid := gen_random_uuid();
  v_user_id uuid;
begin
  -- Get parent thread state
  select 
    state,
    user_id
  into 
    v_parent_state,
    v_user_id
  from public.workflow_states
  where thread_id = p_thread_id;
  
  if v_parent_state is null then
    raise exception 'Parent thread not found: %', p_thread_id;
  end if;
  
  -- Insert new forked thread with parent state as starting point
  insert into public.workflow_states (
    thread_id,
    thread_name,
    thread_status,
    parent_thread_id,
    state,
    user_id,
    thread_metadata,
    created_at,
    updated_at
  ) values (
    v_new_thread_id,
    coalesce(p_new_thread_name, 'Fork of ' || p_thread_id),
    'active',
    p_thread_id,
    v_parent_state,
    v_user_id,
    coalesce(p_thread_metadata, '{}'::jsonb),
    now(),
    now()
  );
  
  return v_new_thread_id;
end;
$$;

comment on function public.fork_workflow_thread(uuid, text, jsonb) is 'Creates a fork of an existing workflow thread with new thread ID. Uses security invoker to respect RLS policies.';

-- Create a thread archiving function
create or replace function public.archive_workflow_thread(
  p_thread_id uuid,
  p_permanent boolean default false
)
returns boolean
language plpgsql
security invoker -- Using invoker security to ensure only authorized users can archive their threads
set search_path = ''
as $$
declare
  v_exists boolean;
begin
  -- Check if thread exists and if the current user has access (via RLS)
  select exists(
    select 1 from public.workflow_states where thread_id = p_thread_id
  ) into v_exists;
  
  if not v_exists then
    raise exception 'Thread not found: %', p_thread_id;
  end if;
  
  -- If permanent is true, delete the thread
  if p_permanent then
    delete from public.workflow_states where thread_id = p_thread_id;
  else
    -- Otherwise, mark as archived
    update public.workflow_states
    set 
      thread_status = 'archived',
      updated_at = now()
    where thread_id = p_thread_id;
  end if;
  
  return true;
end;
$$;

comment on function public.archive_workflow_thread(uuid, boolean) is 'Archives or permanently deletes a workflow thread. Uses security invoker to respect RLS policies.';

-- Create a thread restoration function
create or replace function public.restore_workflow_thread(
  p_thread_id uuid
)
returns boolean
language plpgsql
security invoker -- Using invoker security to ensure only authorized users can restore their threads
set search_path = ''
as $$
declare
  v_exists boolean;
  v_status text;
begin
  -- Check if thread exists and get status (RLS will filter non-accessible rows)
  select 
    exists(select 1 from public.workflow_states where thread_id = p_thread_id),
    thread_status
  into 
    v_exists,
    v_status
  from public.workflow_states 
  where thread_id = p_thread_id;
  
  if not v_exists then
    raise exception 'Thread not found: %', p_thread_id;
  end if;
  
  -- Validate current status
  if v_status != 'archived' and v_status != 'paused' then
    raise exception 'Cannot restore thread with status: %', v_status;
  end if;
  
  -- Mark as active
  update public.workflow_states
  set 
    thread_status = 'active',
    updated_at = now()
  where thread_id = p_thread_id;
  
  return true;
end;
$$;

comment on function public.restore_workflow_thread(uuid) is 'Restores an archived or paused workflow thread to active status. Uses security invoker to respect RLS policies.';

-- Create a cleanup function for expired threads
create or replace function public.cleanup_expired_threads(
  p_older_than_days integer default 30,
  p_auto_archive_only boolean default true
)
returns integer
language plpgsql
security definer -- Using definer security as this is an administrative function that bypasses RLS
set search_path = ''
as $$
declare
  v_cutoff_date timestamptz := now() - (p_older_than_days * interval '1 day');
  v_archived_count integer := 0;
begin
  -- Archive expired threads
  with expired_threads as (
    select thread_id from public.workflow_states
    where 
      (expires_at is not null and expires_at < now())
      or (updated_at < v_cutoff_date and (not p_auto_archive_only or auto_archive = true))
      and thread_status not in ('archived', 'error')
  ),
  archived as (
    update public.workflow_states
    set 
      thread_status = 'archived',
      updated_at = now()
    from expired_threads
    where workflow_states.thread_id = expired_threads.thread_id
    returning 1
  )
  select count(*) into v_archived_count from archived;
  
  return v_archived_count;
end;
$$;

comment on function public.cleanup_expired_threads(integer, boolean) is 'Archives threads that have expired or not been used for a specified period. Uses security definer as this is an administrative function.';

-- Create a scheduled job to run the cleanup function if pg_cron is available
create extension if not exists pg_cron;

-- Create or replace the scheduled job safely
-- This approach avoids using any specific column names that might vary between pg_cron versions
do $$
begin
  -- Try to drop the job if it exists using a more portable approach
  begin
    -- Attempt to use cron.unschedule without referencing specific column names
    perform cron.unschedule('cleanup_expired_workflow_threads');
  exception when others then
    -- If it fails, job might not exist or pg_cron interface is different - continue silently
  end;

  -- Schedule the job - this is safer as it doesn't depend on knowing the schema
  perform cron.schedule('cleanup_expired_workflow_threads', '0 0 * * *', 'select public.cleanup_expired_threads(30, true)');
exception 
  when others then
    -- If pg_cron has issues or is unavailable, log the error but don't fail the migration
    raise notice 'Could not schedule workflow cleanup job: %', sqlerrm;
end
$$;

-- Add comment for the scheduled job for documentation
comment on function public.cleanup_expired_threads(integer, boolean) is 'Archives threads that have expired or not been used for a specified period. A scheduled job runs this daily at midnight.';