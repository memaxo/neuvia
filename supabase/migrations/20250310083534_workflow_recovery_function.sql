-- Migration: Create workflow recovery function
-- Description: Implements error recovery for workflow states
-- Timestamp: 2025-03-10 08:35:34

-- Function for workflow error recovery
create or replace function public.recover_workflow_state(
  p_workflow_id uuid,
  p_target_step workflow_step,
  p_recovery_metadata jsonb default null
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
  -- Check if the workflow exists
  select id, current_step, metadata into v_current_workflow
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
  
  -- Create recovery metadata
  p_recovery_metadata := coalesce(p_recovery_metadata, '{}'::jsonb);
  p_recovery_metadata := jsonb_build_object(
    'recovery', jsonb_build_object(
      'recovered_at', timezone('utc'::text, now()),
      'recovered_from', v_current_workflow.current_step,
      'previous_error', v_current_workflow.metadata->'error',
      'recovery_data', p_recovery_metadata
    )
  );
  
  -- Merge with existing metadata, preserving recovery info
  p_recovery_metadata := coalesce(v_current_workflow.metadata, '{}'::jsonb) || p_recovery_metadata;
  
  -- Update the workflow state
  update public.workflow_states
  set 
    current_step = p_target_step,
    metadata = p_recovery_metadata,
    updated_at = timezone('utc'::text, now())
  where id = p_workflow_id
  returning 
    jsonb_build_object(
      'id', id,
      'current_step', current_step,
      'metadata', metadata,
      'updated_at', updated_at
    ) into v_result;
  
  -- Track the recovery transition
  insert into public.workflow_transitions (
    workflow_id, from_step, to_step, metadata
  ) values (
    p_workflow_id, v_current_workflow.current_step, p_target_step, 
    jsonb_build_object('recovery', true, 'timestamp', timezone('utc'::text, now()))
  );
  
  -- Log the recovery event
  insert into public.workflow_events (
    workflow_id, event_type, event_data, actor_id
  ) values (
    p_workflow_id, 
    'workflow_recovered',
    jsonb_build_object(
      'from_step', v_current_workflow.current_step,
      'to_step', p_target_step,
      'timestamp', timezone('utc'::text, now())
    ),
    (select user_id from public.workflow_states where id = p_workflow_id)
  );
  
  return jsonb_build_object('success', true, 'data', v_result);
end;
$$;

