-- Migration: Create workflow event logging function
-- Description: Implements event logging for audit trail and event sourcing
-- Timestamp: 2025-03-10 08:35:32

-- Function to log workflow events for audit and event sourcing
create or replace function public.log_workflow_event(
  p_workflow_id uuid,
  p_event_type text,
  p_event_data jsonb,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new_event_id uuid;
  v_workflow record;
begin
  -- Validate inputs
  if p_event_data is null or jsonb_typeof(p_event_data) != 'object' then
    raise exception 'event_data must be a non-null JSON object';
  end if;
  
  -- Get workflow info
  select user_id into v_workflow
  from public.workflow_states
  where id = p_workflow_id;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Workflow not found',
      'code', 'WORKFLOW_NOT_FOUND'
    );
  end if;
  
  -- Default actor to workflow owner if not specified
  p_actor_id := coalesce(p_actor_id, v_workflow.user_id);
  
  -- Insert the event
  insert into public.workflow_events (
    workflow_id, event_type, event_data, actor_id
  ) values (
    p_workflow_id, p_event_type, p_event_data, p_actor_id
  )
  returning id into v_new_event_id;
  
  return jsonb_build_object(
    'success', true,
    'event_id', v_new_event_id
  );
end;
$$;

