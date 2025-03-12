-- Migration: Create workflow state reconstruction function
-- Description: Implements event sourcing reconstruction of workflow state
-- Timestamp: 2025-03-10 08:35:33

-- Function to reconstruct workflow state from event history
create or replace function public.reconstruct_workflow_state(
  p_workflow_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_current_state jsonb := '{}'::jsonb;
  v_event record;
begin
  -- Get all events for this workflow in order
  for v_event in (
    select event_type, event_data
    from public.workflow_events
    where workflow_id = p_workflow_id
    order by occurred_at asc
  ) loop
    -- Apply each event to build the current state
    case v_event.event_type
      when 'workflow_created' then
        v_current_state := jsonb_set(v_current_state, '{status}', '"created"');
        v_current_state := jsonb_set(v_current_state, '{created_at}', (v_event.event_data->>'timestamp')::jsonb);
      
      when 'step_changed' then
        v_current_state := jsonb_set(v_current_state, '{current_step}', (v_event.event_data->>'step')::jsonb);
        
      when 'metadata_updated' then
        -- Merge metadata
        v_current_state := jsonb_set(v_current_state, '{metadata}', 
          coalesce(v_current_state->'metadata', '{}'::jsonb) || v_event.event_data->'metadata'
        );
        
      when 'verification_started' then
        v_current_state := jsonb_set(v_current_state, '{verification}', 
          jsonb_build_object(
            'started_at', v_event.event_data->>'timestamp',
            'status', 'pending'
          )
        );
        
      when 'verification_completed' then
        v_current_state := jsonb_set(
          v_current_state, 
          '{verification, status}', 
          '"completed"'
        );
        v_current_state := jsonb_set(
          v_current_state, 
          '{verification, completed_at}', 
          (v_event.event_data->>'timestamp')::jsonb
        );
        
      when 'error_occurred' then
        v_current_state := jsonb_set(v_current_state, '{error}', v_event.event_data->'error');
        
      -- Additional event types can be handled here
    end case;
  end loop;
  
  return v_current_state;
end;
$$;

