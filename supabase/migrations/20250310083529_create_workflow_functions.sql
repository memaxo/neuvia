-- Migration: Create advanced workflow state management functions
-- Description: Implements transaction handling, conflict resolution, and event sourcing for workflow states
-- Timestamp: 2025-03-10 08:35:29

-- Create workflow events table to enable event sourcing
create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflow_states(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default timezone('utc'::text, now()),
  
  constraint workflow_events_event_data_check check (
    case jsonb_typeof(event_data)
      when 'object' then true
      else false
    end
  )
);

comment on table public.workflow_events is 'Stores all workflow state change events for audit trail and state reconstruction';
comment on column public.workflow_events.event_type is 'Type of workflow event (e.g., step_changed, metadata_updated)';
comment on column public.workflow_events.event_data is 'Event-specific data in JSON format';
comment on column public.workflow_events.actor_id is 'User who triggered the event';

-- Create indexes for efficient event retrieval
create index workflow_events_workflow_id_idx on public.workflow_events(workflow_id);
create index workflow_events_occurred_at_idx on public.workflow_events(occurred_at);
create index workflow_events_event_type_idx on public.workflow_events(event_type);

-- Enable RLS
alter table public.workflow_events enable row level security;

-- Create RLS policies for workflow events
create policy "Users can view their own workflow events"
  on public.workflow_events
  for select
  to authenticated
  using (
    actor_id = (select auth.uid())
    or exists (
      select 1 from public.workflow_states
      where workflow_states.id = workflow_events.workflow_id
      and workflow_states.user_id = (select auth.uid())
    )
  );

create policy "Users can insert their own workflow events"
  on public.workflow_events
  for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    or exists (
      select 1 from public.workflow_states
      where workflow_states.id = workflow_events.workflow_id
      and workflow_states.user_id = (select auth.uid())
    )
  );

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
