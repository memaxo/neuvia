-- Migration: Create document verification function
-- Description: Implements document verification initialization
-- Timestamp: 2025-03-10 08:35:36

-- Function for document verification initialization
create or replace function public.initiate_document_verification(
  p_user_id uuid,
  p_document_id uuid,
  p_chat_id uuid,
  p_extracted_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_id uuid;
  v_verification_metadata jsonb;
  v_message_id uuid;
begin
  -- Validate inputs
  if p_extracted_data is null or jsonb_typeof(p_extracted_data) != 'object' then
    return jsonb_build_object(
      'success', false,
      'error', 'extracted_data must be a non-null JSON object',
      'code', 'INVALID_DATA'
    );
  end if;

  -- Create verification metadata
  v_verification_metadata = jsonb_build_object(
    'extracted_data', p_extracted_data,
    'verification_started_at', timezone('utc'::text, now()),
    'document_id', p_document_id,
    'status', 'pending'
  );
  
  -- Create or update workflow state for verification
  insert into public.workflow_states (
    user_id, current_step, verification_metadata, chat_id, correction_history
  )
  values (
    p_user_id, 'verification_pending', v_verification_metadata, p_chat_id, '[]'::jsonb
  )
  on conflict (user_id) do update
    set current_step = 'verification_pending',
        verification_metadata = v_verification_metadata,
        chat_id = p_chat_id,
        correction_history = '[]'::jsonb,
        updated_at = timezone('utc'::text, now())
  returning id into v_workflow_id;
  
  -- Log transition event
  insert into public.workflow_transitions (
    workflow_id, from_step, to_step, metadata
  ) values (
    v_workflow_id, 'idle', 'verification_pending', 
    jsonb_build_object('verification_started', true)
  );
  
  -- Add system message to chat
  insert into public.messages (
    chat_id, role, content, metadata
  ) values (
    p_chat_id, 'system', 'Document verification initiated', 
    jsonb_build_object(
      'type', 'verification_started',
      'document_id', p_document_id,
      'workflow_id', v_workflow_id
    )
  )
  returning id into v_message_id;
  
  -- Update workflow with message reference
  update public.workflow_states
  set last_message_id = v_message_id
  where id = v_workflow_id;
  
  return jsonb_build_object(
    'success', true,
    'workflow_id', v_workflow_id,
    'message_id', v_message_id
  );
end;
$$;

