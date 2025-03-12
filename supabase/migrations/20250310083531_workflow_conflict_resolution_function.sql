-- Migration: Create workflow conflict resolution function
-- Description: Implements conflict resolution strategies for workflow updates
-- Timestamp: 2025-03-10 08:35:31

-- Function for workflow state updates with configurable conflict resolution strategies
create or replace function public.update_workflow_with_conflict_resolution(
  p_workflow_id uuid,
  p_new_step workflow_step,
  p_metadata jsonb,
  p_expected_timestamp timestamptz,
  p_resolution_strategy text default 'fail' -- 'fail', 'force', or 'merge'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_current_workflow record;
  v_final_metadata jsonb;
begin
  -- Lock the row
  select id, current_step, metadata, updated_at into v_current_workflow
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
  
  -- Set initial metadata value
  v_final_metadata := p_metadata;
  
  -- Check for timestamp mismatch (conflict)
  if v_current_workflow.updated_at != p_expected_timestamp then
    -- Handle conflict based on resolution strategy
    case p_resolution_strategy
      when 'fail' then
        return jsonb_build_object(
          'success', false,
          'error', 'Concurrent modification detected',
          'code', 'CONCURRENT_MODIFICATION',
          'expected', p_expected_timestamp,
          'actual', v_current_workflow.updated_at
        );
      
      when 'force' then
        -- Force update despite conflict (continue below)
        null;
      
      when 'merge' then
        -- Merge metadata instead of overwriting
        v_final_metadata := coalesce(v_current_workflow.metadata, '{}'::jsonb) || p_metadata;
      
      else
        return jsonb_build_object(
          'success', false,
          'error', format('Unknown conflict resolution strategy: %s', p_resolution_strategy),
          'code', 'INVALID_RESOLUTION_STRATEGY'
        );
    end case;
  end if;
  
  -- Track the state transition
  insert into public.workflow_transitions (
    workflow_id, from_step, to_step, metadata
  ) values (
    p_workflow_id, v_current_workflow.current_step, p_new_step, v_final_metadata
  );
  
  -- Perform the update
  update public.workflow_states
  set 
    current_step = p_new_step,
    metadata = v_final_metadata,
    updated_at = timezone('utc'::text, now())
  where id = p_workflow_id
  returning 
    jsonb_build_object(
      'id', id,
      'current_step', current_step,
      'metadata', metadata,
      'updated_at', updated_at,
      'resolution_applied', p_resolution_strategy
    ) into v_result;
  
  return jsonb_build_object(
    'success', true,
    'data', v_result
  );
end;
$$;

