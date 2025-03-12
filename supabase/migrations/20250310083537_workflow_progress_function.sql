-- Migration: Create workflow progress function
-- Description: Implements workflow progress tracking with notifications
-- Timestamp: 2025-03-10 08:35:37

-- Function to update workflow progress with optional notification
create or replace function public.update_workflow_progress(
  p_workflow_id uuid,
  p_progress numeric,
  p_phase text,
  p_current_step workflow_step,
  p_notify_users boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_result record;
  v_chat_id uuid;
  v_metadata jsonb;
  v_message_id uuid;
begin
  -- Validate inputs
  if p_progress < 0 or p_progress > 100 then
    return jsonb_build_object(
      'success', false,
      'error', 'Progress must be between 0 and 100',
      'code', 'INVALID_PROGRESS'
    );
  end if;
  
  -- Get current workflow data
  select chat_id, metadata, current_step into v_workflow_result
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
  
  -- Prepare metadata update
  v_metadata := coalesce(v_workflow_result.metadata, '{}'::jsonb);
  v_metadata := jsonb_set(
    jsonb_set(v_metadata, '{progress}', to_jsonb(p_progress)),
    '{phase}', to_jsonb(p_phase)
  );
  
  -- Update workflow progress
  update public.workflow_states
  set 
    current_step = p_current_step,
    metadata = v_metadata,
    updated_at = timezone('utc'::text, now())
  where id = p_workflow_id;
  
  -- Track state transition if step changed
  if v_workflow_result.current_step != p_current_step then
    insert into public.workflow_transitions (
      workflow_id, from_step, to_step, metadata
    ) values (
      p_workflow_id, v_workflow_result.current_step, p_current_step, 
      jsonb_build_object('progress', p_progress, 'phase', p_phase)
    );
  end if;
  
  -- Log progress event
  insert into public.workflow_events (
    workflow_id, event_type, event_data
  ) values (
    p_workflow_id, 
    'progress_updated',
    jsonb_build_object(
      'progress', p_progress,
      'phase', p_phase,
      'step', p_current_step,
      'timestamp', timezone('utc'::text, now())
    )
  );
  
  -- Send notification if requested and chat_id exists
  if p_notify_users and v_workflow_result.chat_id is not null then
    -- Add progress message to chat
    insert into public.messages (
      chat_id, role, content, metadata
    ) values (
      v_workflow_result.chat_id, 'system', 
      format('Progress update: %s (%s%%)', p_phase, p_progress),
      jsonb_build_object(
        'type', 'progress_update',
        'progress', p_progress,
        'phase', p_phase,
        'step', p_current_step
      )
    )
    returning id into v_message_id;
    
    -- Update workflow with message reference
    update public.workflow_states
    set last_message_id = v_message_id
    where id = p_workflow_id;
  end if;
  
  return jsonb_build_object(
    'success', true,
    'progress', p_progress,
    'phase', p_phase,
    'step', p_current_step
  );
end;
$$;

