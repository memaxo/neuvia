-- Migration: Create workflow atomic update function
-- Description: Implements atomic update with optimistic concurrency control
-- Timestamp: 2025-03-10 08:35:30

-- Function for atomic workflow state updates with optimistic concurrency control
create or replace function public.update_workflow_state_atomic(
  p_workflow_id uuid,
  p_new_step workflow_step,
  p_metadata jsonb,
  p_expected_timestamp timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_current_workflow record;
begin
  -- Get current workflow with lock
  select id, current_step, updated_at into v_current_workflow
  from public.workflow_states
  where id = p_workflow_id
  for update;
  
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Workflow not found',
      'code', 'WORKFLOW_NOT_FOUND'
    );
  end if;
  
  -- Check if timestamp matches (optimistic concurrency control)
  if v_current_workflow.updated_at != p_expected_timestamp then
    return jsonb_build_object(
      'success', false,
      'error', 'Concurrent modification detected',
      'code', 'CONCURRENT_MODIFICATION',
      'expected', p_expected_timestamp,
      'actual', v_current_workflow.updated_at
    );
  end if;
  
  -- Track the state transition
  insert into public.workflow_transitions (
    workflow_id, from_step, to_step, metadata
  ) values (
    p_workflow_id, v_current_workflow.current_step, p_new_step, p_metadata
  );
  
  -- Update the workflow state
  update public.workflow_states
  set 
    current_step = p_new_step,
    metadata = p_metadata,
    updated_at = timezone('utc'::text, now())
  where id = p_workflow_id
  returning 
    jsonb_build_object(
      'id', id,
      'current_step', current_step,
      'metadata', metadata,
      'updated_at', updated_at
    ) into v_result;
  
  return jsonb_build_object(
    'success', true,
    'data', v_result
  );
end;
$$;

