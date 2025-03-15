-- Migration: Create simplified workflow transitions table
-- Description: Tracks workflow state transitions for auditing
-- Timestamp: 2025-03-10 08:35:29

-- Create workflow transitions table to track state changes
create table public.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflow_states(id) on delete cascade,
  from_step workflow_step not null,
  to_step workflow_step not null,
  metadata jsonb,
  transitioned_at timestamptz not null default timezone('utc'::text, now()),
  
  constraint workflow_transitions_metadata_check check (
    case jsonb_typeof(metadata)
      when 'object' then true
      when 'null' then true
      else false
    end
  )
);

comment on table public.workflow_transitions is 'Records transitions between workflow states for auditing and monitoring';
comment on column public.workflow_transitions.from_step is 'Original workflow step before transition';
comment on column public.workflow_transitions.to_step is 'Target workflow step after transition';
comment on column public.workflow_transitions.metadata is 'Additional transition metadata in JSON format';

-- Create indexes for transitions
create index workflow_transitions_workflow_id_idx on public.workflow_transitions(workflow_id);
create index workflow_transitions_transitioned_at_idx on public.workflow_transitions(transitioned_at);

-- Enable RLS
alter table public.workflow_transitions enable row level security;

-- Create RLS policies for workflow transitions
create policy "Users can view their own workflow transitions"
  on public.workflow_transitions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.workflow_states
      where workflow_states.id = workflow_transitions.workflow_id
      and workflow_states.user_id = (select auth.uid())
    )
  );

create policy "Users can insert their own workflow transitions"
  on public.workflow_transitions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workflow_states
      where workflow_states.id = workflow_transitions.workflow_id
      and workflow_states.user_id = (select auth.uid())
    )
  );