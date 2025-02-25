-- Extend workflow_step enum with chat states
alter type public.workflow_step add value if not exists 'chat_started';
alter type public.workflow_step add value if not exists 'chat_in_progress';
alter type public.workflow_step add value if not exists 'chat_completed';
alter type public.workflow_step add value if not exists 'chat_error';

-- Add chat-specific columns to workflow_states
alter table public.workflow_states 
add column if not exists chat_id uuid references public.chats(id) on delete set null,
add column if not exists last_message_id uuid references public.messages(id) on delete set null;

-- Create index for efficient chat workflow lookups
create index if not exists workflow_states_chat_id_idx on public.workflow_states(chat_id);

-- Update the update_workflow_state function to handle chat states
create or replace function public.update_workflow_state(
  p_user_id uuid,
  p_step workflow_step,
  p_metadata jsonb default null,
  p_chat_id uuid default null,
  p_last_message_id uuid default null
)
returns public.workflow_states
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
  v_workflow_state public.workflow_states;
begin
  -- Validate metadata is an object if provided
  if p_metadata is not null and jsonb_typeof(p_metadata) != 'object' then
    raise exception 'metadata must be a JSON object';
  end if;

  -- Validate chat state transitions
  if p_step in ('chat_started', 'chat_in_progress', 'chat_completed', 'chat_error') and p_chat_id is null then
    raise exception 'chat_id is required for chat workflow states';
  end if;

  -- Insert or update workflow state
  insert into public.workflow_states (
    user_id, 
    current_step, 
    metadata, 
    chat_id, 
    last_message_id
  )
  values (
    p_user_id, 
    p_step, 
    p_metadata, 
    p_chat_id, 
    p_last_message_id
  )
  on conflict (user_id) do update
    set current_step = p_step,
        metadata = coalesce(p_metadata, public.workflow_states.metadata),
        chat_id = coalesce(p_chat_id, public.workflow_states.chat_id),
        last_message_id = coalesce(p_last_message_id, public.workflow_states.last_message_id),
        updated_at = timezone('utc'::text, now())
  returning * into v_workflow_state;

  return v_workflow_state;
end;
$$;

comment on function public.update_workflow_state(uuid, workflow_step, jsonb, uuid, uuid) is 'Updates or creates a workflow state for a user with optional metadata and chat information';

-- Add RLS policies for chat workflow states
create policy "Users can view chat workflow states they own"
  on public.workflow_states
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.chats
      where chats.id = workflow_states.chat_id
      and chats.user_id = auth.uid()
    )
  );

create policy "Users can update chat workflow states they own"
  on public.workflow_states
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.chats
      where chats.id = workflow_states.chat_id
      and chats.user_id = auth.uid()
    )
  ); 