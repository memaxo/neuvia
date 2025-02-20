-- create enums
create type continents as enum (
    'Africa',
    'Antarctica',
    'Asia',
    'Europe',
    'Oceania',
    'North America',
    'South America'
);

-- enable pgvector extension for vector operations
create extension if not exists vector;

-- create tables
create table public.countries (
    id integer primary key,
    iso2 varchar not null,
    iso3 varchar,
    name varchar,
    local_name varchar,
    continent continents
);
comment on table public.countries is 'List of countries with their ISO codes and continental information';

create table public.gpt_one (
    id varchar primary key,
    created_at timestamptz default now(),
    email varchar,
    messages text,
    user_input text,
    vector_one text
);
comment on table public.gpt_one is 'Stores GPT interactions and vector embeddings for AI processing';

create table public.inqueries (
    id bigint generated always as identity primary key,
    created_at timestamptz default now(),
    email varchar,
    message text not null,
    name varchar,
    user_id uuid references auth.users(id)
);
comment on table public.inqueries is 'User inquiries and contact form submissions';

create table public.members_table (
    id bigint generated always as identity primary key,
    created_at timestamptz default now(),
    member_id varchar not null unique,
    name varchar
);
comment on table public.members_table is 'Member information and basic profile data';

create table public.moralis_users (
    id varchar primary key,
    created_at timestamptz default now(),
    metadata jsonb,
    moralis_provider varchar
);
comment on table public.moralis_users is 'Web3 user authentication and metadata via Moralis';

create table public.nods_page (
    id bigint generated always as identity primary key,
    path varchar not null,
    checksum varchar,
    meta jsonb,
    parent_page_id integer references public.nods_page(id),
    source varchar,
    type varchar
);
comment on table public.nods_page is 'Hierarchical page structure for documentation and content management';

create table public.nods_page_section (
    id bigint generated always as identity primary key,
    page_id integer references public.nods_page(id) not null,
    content text,
    embedding vector(1536),
    heading varchar,
    slug varchar,
    token_count integer
);
comment on table public.nods_page_section is 'Page sections with vector embeddings for semantic search';

create table public.permission_table (
    id bigint generated always as identity primary key,
    created_at timestamptz default now(),
    member_id varchar not null,
    role varchar not null,
    status varchar not null
);
comment on table public.permission_table is 'Role-based access control and permission management';

create table public.profiles (
    id uuid primary key references auth.users(id),
    avatar_url varchar,
    email varchar,
    full_name varchar,
    updated_at timestamptz,
    username varchar,
    website varchar
);
comment on table public.profiles is 'Extended user profile information linked to auth.users';

create table public.todos (
    id bigint generated always as identity primary key,
    created_at timestamptz not null,
    created_by varchar references public.members_table(member_id),
    is_complete boolean default false,
    task text,
    title varchar,
    user_id uuid references auth.users(id) not null
);
comment on table public.todos is 'User todo items and task management';

-- Create functions
CREATE OR REPLACE FUNCTION public.get_page_parents(page_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    parent_page_id INTEGER,
    path VARCHAR,
    meta JSONB
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
    WITH RECURSIVE parents AS (
        SELECT id, parent_page_id, path, meta
        FROM public.nods_page
        WHERE id = page_id
        UNION
        SELECT np.id, np.parent_page_id, np.path, np.meta
        FROM public.nods_page np
        INNER JOIN parents p ON p.parent_page_id = np.id
    )
    SELECT * FROM parents;
$$;

CREATE OR REPLACE FUNCTION public.match_page_sections(
    embedding vector,
    match_threshold FLOAT,
    match_count INTEGER,
    min_content_length INTEGER
)
RETURNS TABLE (
    id INTEGER,
    page_id INTEGER,
    slug VARCHAR,
    heading VARCHAR,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        nps.id,
        nps.page_id,
        nps.slug,
        nps.heading,
        nps.content,
        1 - (nps.embedding <=> embedding) AS similarity
    FROM public.nods_page_section nps
    WHERE LENGTH(nps.content) >= min_content_length
    AND 1 - (nps.embedding <=> embedding) > match_threshold
    ORDER BY nps.embedding <=> embedding
    LIMIT match_count;
END;
$$;

-- enable row level security
alter table public.profiles enable row level security;
alter table public.todos enable row level security;
alter table public.inqueries enable row level security;
alter table public.members_table enable row level security;
alter table public.permission_table enable row level security;

-- profiles policies
create policy "anyone can view public profiles"
    on public.profiles
    for select
    to authenticated, anon
    using ( true );

create policy "users can create their own profile"
    on public.profiles
    for insert
    to authenticated
    with check ( (select auth.uid()) = id );

create policy "users can update their own profile"
    on public.profiles
    for update
    to authenticated
    using ( (select auth.uid()) = id )
    with check ( (select auth.uid()) = id );

create policy "users can delete their own profile"
    on public.profiles
    for delete
    to authenticated
    using ( (select auth.uid()) = id );

-- todos policies
create policy "users can view their own todos"
    on public.todos
    for select
    to authenticated
    using ( (select auth.uid()) = user_id );

create policy "users can create todos for themselves"
    on public.todos
    for insert
    to authenticated
    with check ( (select auth.uid()) = user_id );

create policy "users can update their own todos"
    on public.todos
    for update
    to authenticated
    using ( (select auth.uid()) = user_id )
    with check ( (select auth.uid()) = user_id );

create policy "users can delete their own todos"
    on public.todos
    for delete
    to authenticated
    using ( (select auth.uid()) = user_id );

-- inqueries policies
create policy "users can view their own inqueries"
    on public.inqueries
    for select
    to authenticated
    using ( (select auth.uid()) = user_id );

create policy "users can submit inqueries"
    on public.inqueries
    for insert
    to authenticated
    with check ( (select auth.uid()) = user_id );

create policy "users can update their own inqueries"
    on public.inqueries
    for update
    to authenticated
    using ( (select auth.uid()) = user_id )
    with check ( (select auth.uid()) = user_id );

create policy "users can delete their own inqueries"
    on public.inqueries
    for delete
    to authenticated
    using ( (select auth.uid()) = user_id );

-- members policies
create policy "authenticated users can view members"
    on public.members_table
    for select
    to authenticated
    using ( true );

create policy "admins can create members"
    on public.members_table
    for insert
    to authenticated
    with check (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    );

create policy "admins can update members"
    on public.members_table
    for update
    to authenticated
    using (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    )
    with check (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    );

create policy "admins can delete members"
    on public.members_table
    for delete
    to authenticated
    using (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    );

-- permissions policies
create policy "users can view their own permissions"
    on public.permission_table
    for select
    to authenticated
    using ( member_id = (select auth.uid())::text );

create policy "admins can view all permissions"
    on public.permission_table
    for select
    to authenticated
    using (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    );

create policy "admins can create permissions"
    on public.permission_table
    for insert
    to authenticated
    with check (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    );

create policy "admins can update permissions"
    on public.permission_table
    for update
    to authenticated
    using (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    )
    with check (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    );

create policy "admins can delete permissions"
    on public.permission_table
    for delete
    to authenticated
    using (
        exists (
            select 1 
            from public.permission_table 
            where member_id = (select auth.uid())::text 
            and role = 'admin'
            and status = 'active'
        )
    );

-- create indexes for policy performance
create index if not exists idx_todos_user_id on public.todos using btree (user_id);
create index if not exists idx_inqueries_user_id on public.inqueries using btree (user_id);
create index if not exists idx_permission_member_id on public.permission_table using btree (member_id);
create index if not exists idx_members_member_id on public.members_table using btree (member_id);
