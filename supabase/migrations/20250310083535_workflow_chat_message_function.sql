-- Migration: Create workflow chat message function
-- Description: Implements combined workflow update and chat message function
-- Timestamp: 2025-03-10 08:35:35

-- Function for combined workflow update with chat message
create or replace function public.update_workflow_with_chat_message(
  p_workflow_id uuid,
  p_new_step workflow_step,
  p_metadata jsonb,
  p_message_content text,
  p_message_role text default 'system',
  p_message_metadata jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_result record;
  v_message_result record;
  v_chat_id uuid;
begin
  -- Get the chat_id from the workflow state
  select chat_id, current_step into v_workflow_result
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
  
  v_chat_id := v_workflow_result.chat_id;
  
  if v_chat_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'No chat associated with this workflow',
      'code', 'NO_CHAT_ASSOCIATED'
    );
  end if;
  
  -- Update workflow state
  update public.workflow_states
  set 
    current_step = p_new_step,
    metadata = coalesce(p_metadata, metadata),
    updated_at = timezone('utc'::text, now())
  where id = p_workflow_id
  returning id, current_step, updated_at into v_workflow_result;
  
  -- Track the state transition
  insert into public.workflow_transitions (
    workflow_id, from_step, to_step, metadata
  ) values (
    p_workflow_id, v_workflow_result.current_step, p_new_step, p_metadata
  );
  
  -- Add chat message
  insert into public.messages (
    chat_id, role, content, metadata
  ) values (
    v_chat_id, p_message_role, p_message_content, p_message_metadata
  )
  returning id into v_message_result;
  
  -- Update workflow state with new message reference
  update public.workflow_states
  set last_message_id = v_message_result.id
  where id = p_workflow_id;
  
  return jsonb_build_object(
    'success', true,
    'workflow', jsonb_build_object(
      'id', v_workflow_result.id,
      'current_step', v_workflow_result.current_step,
      'updated_at', v_workflow_result.updated_at
    ),
    'message', jsonb_build_object(
      'id', v_message_result.id
    )
  );
end;
$$;

