-- ======================================================
-- 1. CHAT SYSTEM TABLES
-- ======================================================

-- 1.1 CHATS TABLE
create table if not exists public.chats (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    title text not null,
    user_id uuid references auth.users(id) on delete cascade,
    visibility text not null default 'private' check (visibility in ('public', 'private')),
    updated_at timestamptz default now()
);
comment on table public.chats is 'Stores chat conversations and their metadata';

-- 1.2 MESSAGES TABLE
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    chat_id uuid references public.chats(id) on delete cascade,
    role text not null,
    content jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
comment on table public.messages is 'Stores individual messages within chats';

-- 1.3 VOTES TABLE
create table if not exists public.votes (
    chat_id uuid references public.chats(id) on delete cascade,
    message_id uuid references public.messages(id) on delete cascade,
    is_upvoted boolean not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    primary key (chat_id, message_id)
);
comment on table public.votes is 'Stores user votes on messages';

-- Add updated_at triggers
create trigger set_updated_at_chats
    before update on public.chats
    for each row execute function public.handle_updated_at();

create trigger set_updated_at_messages
    before update on public.messages
    for each row execute function public.handle_updated_at();

create trigger set_updated_at_votes
    before update on public.votes
    for each row execute function public.handle_updated_at();

-- Add RLS policies
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.votes enable row level security;

-- Chat policies
create policy "Users can view their own chats"
    on public.chats for select
    using (auth.uid() = user_id);

create policy "Users can create their own chats"
    on public.chats for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own chats"
    on public.chats for update
    using (auth.uid() = user_id);

create policy "Users can delete their own chats"
    on public.chats for delete
    using (auth.uid() = user_id);

-- Message policies
create policy "Users can view messages in their chats"
    on public.messages for select
    using (
        exists (
            select 1 from public.chats
            where id = messages.chat_id
            and user_id = auth.uid()
        )
    );

create policy "Users can create messages in their chats"
    on public.messages for insert
    with check (
        exists (
            select 1 from public.chats
            where id = chat_id
            and user_id = auth.uid()
        )
    );

-- Vote policies
create policy "Users can view votes in their chats"
    on public.votes for select
    using (
        exists (
            select 1 from public.chats
            where id = votes.chat_id
            and user_id = auth.uid()
        )
    );

create policy "Users can create votes in their chats"
    on public.votes for insert
    with check (
        exists (
            select 1 from public.chats
            where id = chat_id
            and user_id = auth.uid()
        )
    );

create policy "Users can update votes in their chats"
    on public.votes for update
    using (
        exists (
            select 1 from public.chats
            where id = votes.chat_id
            and user_id = auth.uid()
        )
    ); 