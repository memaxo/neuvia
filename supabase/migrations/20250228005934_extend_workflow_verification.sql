-- Migration: Extend workflow verification functionality
-- Description: Adds verification-specific states, metadata schema, and functions for chat-based verification
-- Timestamp: 2025-02-28 00:59:34

-- Extend workflow_step enum with verification-specific states
alter type public.workflow_step add value if not exists 'verification_pending';
alter type public.workflow_step add value if not exists 'verification_in_progress';
alter type public.workflow_step add value if not exists 'verification_completed';
alter type public.workflow_step add value if not exists 'verification_failed';

-- Add verification-specific columns to workflow_states
alter table public.workflow_states
add column if not exists verification_metadata jsonb,
add column if not exists current_summary_id uuid,
add column if not exists correction_history jsonb default '[]'::jsonb;

-- Create index for efficient verification lookups
create index if not exists workflow_states_current_summary_id_idx on public.workflow_states(current_summary_id);

-- Add check constraint to ensure correction_history is an array
alter table public.workflow_states
add constraint workflow_states_correction_history_check check (
  case jsonb_typeof(correction_history)
    when 'array' then true
    when 'null' then true
    else false
  end
);

comment on column public.workflow_states.verification_metadata is 'Metadata specific to the verification process, including extracted data and verification status';
comment on column public.workflow_states.current_summary_id is 'Reference to the current version of the patient summary';
comment on column public.workflow_states.correction_history is 'History of corrections made during verification as a JSON array';

-- Create function to initiate verification process
create or replace function public.initiate_verification(
  p_user_id uuid,
  p_extracted_data jsonb,
  p_chat_id uuid
)
returns public.workflow_states
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_state public.workflow_states;
  v_verification_metadata jsonb;
begin
  -- Validate inputs
  if p_extracted_data is null or jsonb_typeof(p_extracted_data) != 'object' then
    raise exception 'extracted_data must be a non-null JSON object';
  end if;

  -- Create verification metadata
  v_verification_metadata = jsonb_build_object(
    'extracted_data', p_extracted_data,
    'verification_started_at', timezone('utc'::text, now()),
    'status', 'pending'
  );
  
  -- Update workflow state
  insert into public.workflow_states (
    user_id,
    current_step,
    metadata,
    verification_metadata,
    chat_id,
    correction_history
  )
  values (
    p_user_id,
    'verification_pending',
    coalesce((select metadata from public.workflow_states where user_id = p_user_id), '{}'::jsonb),
    v_verification_metadata,
    p_chat_id,
    '[]'::jsonb
  )
  on conflict (user_id) do update
    set current_step = 'verification_pending',
        verification_metadata = v_verification_metadata,
        chat_id = p_chat_id,
        correction_history = '[]'::jsonb,
        updated_at = timezone('utc'::text, now())
  returning * into v_workflow_state;

  return v_workflow_state;
end;
$$;

comment on function public.initiate_verification(uuid, jsonb, uuid) is 'Initiates the verification process for extracted patient data';

-- Create function to process verification correction
create or replace function public.process_verification_correction(
  p_user_id uuid,
  p_correction_text text,
  p_summary_id uuid,
  p_last_message_id uuid
)
returns public.workflow_states
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_state public.workflow_states;
  v_current_verification jsonb;
  v_new_correction jsonb;
  v_updated_history jsonb;
begin
  -- Get current workflow state
  select * into v_workflow_state
  from public.workflow_states
  where user_id = p_user_id;
  
  if not found then
    raise exception 'No workflow state found for user';
  end if;
  
  -- Validate current state
  if v_workflow_state.current_step not in ('verification_pending', 'verification_in_progress') then
    raise exception 'Verification is not in progress';
  end if;
  
  -- Create correction record
  v_new_correction = jsonb_build_object(
    'correction_text', p_correction_text,
    'timestamp', timezone('utc'::text, now()),
    'summary_id', p_summary_id,
    'message_id', p_last_message_id
  );
  
  -- Update correction history
  v_updated_history = v_workflow_state.correction_history || jsonb_build_array(v_new_correction);
  
  -- Update workflow state
  update public.workflow_states
  set current_step = 'verification_in_progress',
      verification_metadata = jsonb_set(
        verification_metadata,
        '{status}',
        '"in_progress"'
      ),
      current_summary_id = p_summary_id,
      last_message_id = p_last_message_id,
      correction_history = v_updated_history,
      updated_at = timezone('utc'::text, now())
  where user_id = p_user_id
  returning * into v_workflow_state;
  
  return v_workflow_state;
end;
$$;

comment on function public.process_verification_correction(uuid, text, uuid, uuid) is 'Processes a correction to the patient summary during verification';

-- Create function to complete verification
create or replace function public.complete_verification(
  p_user_id uuid,
  p_final_summary_id uuid
)
returns public.workflow_states
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_state public.workflow_states;
begin
  -- Update workflow state
  update public.workflow_states
  set current_step = 'verification_completed',
      verification_metadata = jsonb_set(
        verification_metadata,
        '{status}',
        '"completed"'
      ),
      current_summary_id = p_final_summary_id,
      updated_at = timezone('utc'::text, now())
  where user_id = p_user_id
  returning * into v_workflow_state;
  
  if not found then
    raise exception 'No workflow state found for user';
  end if;
  
  return v_workflow_state;
end;
$$;

comment on function public.complete_verification(uuid, uuid) is 'Marks the verification process as complete with the final summary';

-- Create function to reset verification
create or replace function public.reset_verification(
  p_user_id uuid
)
returns public.workflow_states
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_state public.workflow_states;
  v_existing_metadata jsonb;
begin
  -- Get existing metadata to preserve it
  select metadata into v_existing_metadata
  from public.workflow_states
  where user_id = p_user_id;

  -- Reset verification state
  update public.workflow_states
  set current_step = 'idle',
      verification_metadata = null,
      current_summary_id = null,
      correction_history = '[]'::jsonb,
      updated_at = timezone('utc'::text, now())
  where user_id = p_user_id
  returning * into v_workflow_state;
  
  if not found then
    raise exception 'No workflow state found for user';
  end if;
  
  return v_workflow_state;
end;
$$;

comment on function public.reset_verification(uuid) is 'Resets the verification process to allow for retry';

-- Create function to transition from verification to report generation
create or replace function public.begin_report_generation(
  p_user_id uuid,
  p_report_metadata jsonb default null
)
returns public.workflow_states
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow_state public.workflow_states;
  v_combined_metadata jsonb;
begin
  -- Get current workflow state
  select * into v_workflow_state
  from public.workflow_states
  where user_id = p_user_id;
  
  if not found then
    raise exception 'No workflow state found for user';
  end if;
  
  -- Validate current state
  if v_workflow_state.current_step != 'verification_completed' then
    raise exception 'Verification must be completed before generating report';
  end if;
  
  -- Combine existing metadata with report metadata
  v_combined_metadata = coalesce(v_workflow_state.metadata, '{}'::jsonb);
  if p_report_metadata is not null then
    v_combined_metadata = v_combined_metadata || p_report_metadata;
  end if;
  
  -- Update workflow state
  update public.workflow_states
  set current_step = 'report_generation',
      metadata = v_combined_metadata,
      updated_at = timezone('utc'::text, now())
  where user_id = p_user_id
  returning * into v_workflow_state;
  
  return v_workflow_state;
end;
$$;

comment on function public.begin_report_generation(uuid, jsonb) is 'Transitions from verification to report generation phase';

-- Create RLS policies for verification workflow states
create policy "Users can view verification metadata they own"
  on public.workflow_states
  for select
  to authenticated
  using (
    auth.uid() = user_id
  );

create policy "Users can update verification workflow states they own"
  on public.workflow_states
  for update
  to authenticated
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );
