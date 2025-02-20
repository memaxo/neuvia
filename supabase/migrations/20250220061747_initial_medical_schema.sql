-- ======================================================
-- 0. EXTENSIONS
-- ======================================================
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ======================================================
-- 1. ENUMS & TYPES
-- ======================================================

-- 1.1 Continents (used by countries)
DO $$
BEGIN
    CREATE TYPE continents AS ENUM (
        'Africa',
        'Antarctica',
        'Asia',
        'Europe',
        'Oceania',
        'North America',
        'South America'
    );
EXCEPTION
    WHEN duplicate_object THEN
        -- do nothing, type already exists
        NULL;
END;
$$;

-- 1.2 Medical Role Types
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'medical_role') THEN
        CREATE TYPE public.medical_role AS ENUM (
            'admin',
            'doctor',
            'nurse',
            'staff',
            'researcher'
        );
    END IF;
END $$;

-- 1.3 Access Levels
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level') THEN
        CREATE TYPE public.access_level AS ENUM (
            'none',
            'read',
            'write',
            'admin'
        );
    END IF;
END $$;

-- 1.4 Document Category
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
        CREATE TYPE public.document_category AS ENUM (
            'clinical',
            'lab',
            'imaging',
            'prescription',
            'administrative'
        );
    END IF;
END $$;

-- 1.5 Patient Status
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_status') THEN
        CREATE TYPE public.patient_status AS ENUM (
            'active',
            'inactive',
            'archived',
            'deceased'
        );
    END IF;
END $$;

-- ======================================================
-- 2. CORE TABLES
-- ======================================================

-- 2.1 PROFILES TABLE
-- Linked to auth.users(id) with advanced role-based columns
create table if not exists public.profiles (
    id uuid primary key references auth.users(id),
    avatar_url varchar,
    email text unique,
    full_name varchar,
    username varchar,
    website varchar,
    updated_at timestamptz default now(),
    -- Medical system extensions
    is_active boolean default true,
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    medical_role public.medical_role not null default 'staff'
);
comment on table public.profiles is 'Extended user profiles with medical_role, is_active, metadata, etc.';

-- 2.2 COUNTRIES TABLE
-- Kept from original schema for reference
create table if not exists public.countries (
    id integer primary key,
    iso2 varchar not null,
    iso3 varchar,
    name varchar,
    local_name varchar,
    continent continents
);
comment on table public.countries is 'List of countries with their ISO codes and continental information';

-- 2.3 INQUERIES TABLE
-- Contact form submissions or user inquiries
create table if not exists public.inqueries (
    id bigint generated always as identity primary key,
    created_at timestamptz default now(),
    email varchar,
    message text not null,
    name varchar,
    user_id uuid references auth.users(id)
);
comment on table public.inqueries is 'User inquiries and contact form submissions';

-- 2.4 DEPARTMENTS TABLE
create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
comment on table public.departments is 'Medical departments within the organization';

-- 2.5 USER_DEPARTMENTS TABLE
create table if not exists public.user_departments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade,
    department_id uuid references public.departments(id) on delete cascade,
    access_level public.access_level not null default 'read',
    is_primary boolean default false,
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id, department_id)
);
comment on table public.user_departments is 'Maps users to departments with access levels';

-- 2.6 RESOURCE_PERMISSIONS TABLE
create table if not exists public.resource_permissions (
    id uuid primary key default gen_random_uuid(),
    resource_type text not null,
    medical_role public.medical_role not null,
    access_level public.access_level not null default 'none',
    conditions jsonb default '{}',
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(resource_type, medical_role)
);
comment on table public.resource_permissions is 'Stores resource-level permissions for users';

-- 2.7 PATIENTS TABLE
create table if not exists public.patients (
    id uuid primary key default gen_random_uuid(),
    mrn varchar(50) unique not null,
    first_name text not null,
    last_name text not null,
    date_of_birth date not null,
    gender text,
    preferred_language text,

    -- Contact Information
    email text,
    phone text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    postal_code text,
    country text,

    -- Emergency Contact
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relationship text,

    -- Medical Information
    blood_type text,
    allergies jsonb default '[]',
    current_medications jsonb default '[]',
    conditions jsonb default '[]',
    vital_signs jsonb default '[]',
    immunizations jsonb default '[]',

    -- Administrative
    primary_care_physician text,
    insurance_provider text,
    insurance_id text,
    department_id uuid, -- references public.departments(id) if desired
    clinical_data jsonb default '{}',
    social_determinants jsonb default '{}',
    custom_fields jsonb default '{}',

    status public.patient_status not null default 'active',
    patient_embedding vector(1536),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    created_by uuid references auth.users(id),
    last_modified_by uuid references auth.users(id)
);
comment on table public.patients is 'Stores comprehensive patient information including personal details, medical history, and administrative data';

-- 2.8 PATIENT_DOCUMENTS TABLE
create table if not exists public.patient_documents (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references public.patients(id) on delete cascade,

    title text not null,
    category public.document_category not null,
    document_type jsonb not null default '{}',
    file_path text not null,
    file_type text not null,
    file_size integer not null,
    checksum text not null,

    document_date date not null,
    provider_name text,
    facility_name text,
    department text,

    processing_status text not null default 'pending',
    is_processed boolean default false,
    processing_error text,

    content_text text,
    content_summary text,
    key_findings jsonb,
    metadata jsonb,

    document_embedding vector(1536),
    chunk_embeddings jsonb,

    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    uploaded_by uuid references auth.users(id),
    last_modified_by uuid references auth.users(id)
);
comment on table public.patient_documents is 'Stores patient documents with support for file metadata, content extraction, and vector embeddings';

-- 2.9 DOCUMENT_CHUNKS TABLE
create table if not exists public.document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references public.patient_documents(id) on delete cascade,
    content text not null,
    chunk_index integer not null,
    token_count integer not null,
    metadata jsonb default '{}',
    chunk_type text,
    importance_score float,
    heading text,
    page_number integer,
    position_start integer,
    position_end integer,
    position_metadata jsonb default '{}',
    chunk_embedding vector(1536),
    related_chunks jsonb default '[]',

    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
comment on table public.document_chunks is 'Stores document chunks for semantic search';

-- 2.10 AUDIT_LOGS TABLE
create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id),
    action text not null,
    entity_type text not null,
    entity_id uuid not null,
    changes jsonb,
    metadata jsonb default '{}',
    ip_address text,
    user_agent text,
    created_at timestamptz default now(),
    department_id uuid references public.departments(id)
);
comment on table public.audit_logs is 'Comprehensive audit logging for all system actions';

-- ======================================================
-- 3. FUNCTIONS
-- ======================================================

-- 3.1 handle_updated_at()
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
comment on function public.handle_updated_at is 'Automatically updates the updated_at timestamp when a row is modified';

-- 3.2 validate_document_type()
create or replace function public.validate_document_type(
    doc_type jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
immutable
as $$
begin
    return (
        doc_type is not null
        and jsonb_typeof(doc_type) = 'object'
        and doc_type ? 'type'
        and jsonb_typeof(doc_type->'type') = 'string'
    );
end;
$$;
comment on function public.validate_document_type is 'Validates that a document type JSONB has the required structure';

-- 3.3 check_resource_access()
create or replace function public.check_resource_access(
    resource_type text,
    required_level public.access_level
)
returns boolean
language plpgsql
security invoker
set search_path = ''
stable
as $$
declare
    user_role public.medical_role;
    actual_level public.access_level;
begin
    -- Get user's role from profiles
    select medical_role into user_role
    from public.profiles
    where id = auth.uid();

    -- If user is admin, automatically has access
    if user_role = 'admin' then
        return true;
    end if;

    -- Otherwise, check resource_permissions
    select access_level into actual_level
    from public.resource_permissions
    where medical_role = user_role
      and resource_type = check_resource_access.resource_type;

    -- Compare levels
    return case actual_level
        when 'admin' then true
        when 'write' then required_level in ('read', 'write')
        when 'read' then required_level = 'read'
        else false
    end;
end;
$$;
comment on function public.check_resource_access is 'Checks if the current user has sufficient access level for a resource type';

-- 3.4 check_document_category_access()
create or replace function public.check_document_category_access(
    category public.document_category,
    required_level public.access_level
)
returns boolean
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
    -- Administrative docs require special resource
    if category = 'administrative' then
        return public.check_resource_access('administrative_docs', required_level);
    end if;
    -- Otherwise, check normal 'documents' resource
    return public.check_resource_access('documents', required_level);
end;
$$;
comment on function public.check_document_category_access is 'Checks if the current user has sufficient access for a specific document category';

-- 3.5 validate_jsonb_fields() - from create_types
create or replace function public.validate_jsonb_fields(fields jsonb[])
returns boolean
language plpgsql
security invoker
set search_path = ''
immutable
as $$
begin
    for i in 1..array_length(fields, 1) loop
        if fields[i] is not null and jsonb_typeof(fields[i]) != 'object' then
            return false;
        end if;
    end loop;
    return true;
end;
$$;
comment on function public.validate_jsonb_fields is 'Validates that all provided JSONB fields are either null or objects';

-- 3.6 match_patient_documents() - from patients
create or replace function public.match_patient_documents(
    embedding vector,
    match_threshold float,
    match_count integer,
    patient_id uuid default null
)
returns table (
    id uuid,
    document_id uuid,
    content text,
    similarity float
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
    return query
    select
        dc.id,
        dc.document_id,
        dc.content,
        1 - (dc.chunk_embedding <=> embedding) as similarity
    from public.document_chunks dc
    join public.patient_documents pd on dc.document_id = pd.id
    where
        (patient_id is null or pd.patient_id = patient_id)
        and 1 - (dc.chunk_embedding <=> embedding) > match_threshold
    order by dc.chunk_embedding <=> embedding
    limit match_count;
end;
$$;
comment on function public.match_patient_documents is 'Performs similarity search across patient document chunks';

-- ======================================================
-- 4. TABLE TRIGGERS
-- ======================================================
create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.handle_updated_at();

create trigger set_updated_at_patients
before update on public.patients
for each row execute function public.handle_updated_at();

create trigger set_updated_at_patient_documents
before update on public.patient_documents
for each row execute function public.handle_updated_at();

create trigger set_updated_at_document_chunks
before update on public.document_chunks
for each row execute function public.handle_updated_at();

create trigger set_updated_at_audit_logs
before update on public.audit_logs
for each row execute function public.handle_updated_at();

create trigger set_updated_at_departments
before update on public.departments
for each row execute function public.handle_updated_at();

create trigger set_updated_at_user_departments
before update on public.user_departments
for each row execute function public.handle_updated_at();

-- ======================================================
-- 5. RLS ENABLE
-- ======================================================
alter table public.profiles enable row level security;
alter table public.inqueries enable row level security;
alter table public.departments enable row level security;
alter table public.user_departments enable row level security;
alter table public.resource_permissions enable row level security;
alter table public.patients enable row level security;
alter table public.patient_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.audit_logs enable row level security;

-- ======================================================
-- 6. RLS POLICIES
-- ======================================================

-- 6.1 PROFILES
create policy "Users can view all active profiles"
    on public.profiles
    for select
    to authenticated
    using (is_active = true);

create policy "Users can update their own profile"
    on public.profiles
    for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

-- 6.2 INQUERIES
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

-- 6.3 DEPARTMENTS
create policy "Admins can create departments"
    on public.departments
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    );

create policy "Admins can update departments"
    on public.departments
    for update
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    )
    with check (true);

create policy "Admins can delete departments"
    on public.departments
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    );

-- 6.4 USER_DEPARTMENTS
create policy "Admins can create department assignments"
    on public.user_departments
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    );

create policy "Admins can update department assignments"
    on public.user_departments
    for update
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    )
    with check (true);

create policy "Admins can delete department assignments"
    on public.user_departments
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    );

-- 6.5 RESOURCE_PERMISSIONS
create policy "Admins can create permissions"
    on public.resource_permissions
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    );

create policy "Admins can update permissions"
    on public.resource_permissions
    for update
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    )
    with check (true);

create policy "Admins can delete permissions"
    on public.resource_permissions
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where id = (select auth.uid())
            and medical_role = 'admin'
            and is_active = true
        )
    );

-- 6.6 PATIENTS
create policy "Users can view patients based on role and department"
    on public.patients
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                (ud.department_id = patients.department_id and ud.access_level >= 'read')
                or public.check_resource_access('patients', 'read')
            )
        )
    );

create policy "Medical staff can create patients with valid metadata"
    on public.patients
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles up
            where up.id = (select auth.uid())
            and up.is_active = true
            and public.check_resource_access('patients', 'write')
        )
        and public.validate_jsonb_fields(array[clinical_data, social_determinants, custom_fields])
    );

create policy "Medical staff can update patients"
    on public.patients
    for update
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                (ud.department_id = patients.department_id and ud.access_level >= 'write')
                or public.check_resource_access('patients', 'write')
            )
        )
    )
    with check (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                (ud.department_id = patients.department_id and ud.access_level >= 'write')
                or public.check_resource_access('patients', 'write')
            )
        )
    );

create policy "Admins can delete patients"
    on public.patients
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            where up.id = (select auth.uid())
            and up.is_active = true
            and public.check_resource_access('patients', 'admin')
        )
    );

-- 6.7 PATIENT_DOCUMENTS & DOCUMENT_CHUNKS
create policy "Medical staff can create documents with valid metadata"
    on public.patient_documents
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            join public.patients p on p.id = patient_documents.patient_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                (ud.department_id = p.department_id and ud.access_level >= 'write')
                or (
                    public.check_resource_access('documents', 'write')
                    and public.check_document_category_access(category, 'write')
                )
            )
        )
        and public.validate_document_type(document_type)
    );

create policy "Users can view documents based on category and role"
    on public.patient_documents
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            join public.patients p on p.id = patient_documents.patient_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                (ud.department_id = p.department_id and ud.access_level >= 'read')
                or (
                    public.check_resource_access('documents', 'read')
                    and public.check_document_category_access(category, 'read')
                )
            )
        )
    );

create policy "Users can update documents based on category and role"
    on public.patient_documents
    for update
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            join public.patients p on p.id = patient_documents.patient_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                (ud.department_id = p.department_id and ud.access_level >= 'write')
                or (
                    public.check_resource_access('documents', 'write')
                    and public.check_document_category_access(category, 'write')
                )
            )
        )
    )
    with check (true);

create policy "Admins can delete documents"
    on public.patient_documents
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            where up.id = (select auth.uid())
            and up.is_active = true
            and public.check_resource_access('documents', 'admin')
        )
    );

create policy "Users can view document chunks based on document access"
    on public.document_chunks
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            join public.patient_documents pd on pd.id = document_chunks.document_id
            join public.patients p on p.id = pd.patient_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                (ud.department_id = p.department_id and ud.access_level >= 'read')
                or (
                    public.check_resource_access('documents', 'read')
                    and public.check_document_category_access(pd.category, 'read')
                )
            )
        )
    );

-- 6.8 AUDIT_LOGS
create policy "Users can create audit logs"
    on public.audit_logs
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and (
            exists (
                select 1 from public.profiles up
                join public.user_departments ud on up.id = ud.user_id
                join public.patients p on p.department_id = ud.department_id
                where up.id = (select auth.uid())
                and up.is_active = true
                and (
                    entity_type = 'patients' and entity_id::uuid = p.id
                    or entity_type = 'patient_documents' and entity_id::uuid in (
                        select id from public.patient_documents where patient_id = p.id
                    )
                )
            )
            and department_id = (
                case entity_type
                    when 'patients' then (
                        select department_id from public.patients where id = entity_id::uuid
                    )
                    when 'patient_documents' then (
                        select p.department_id
                        from public.patient_documents pd
                        join public.patients p on p.id = pd.patient_id
                        where pd.id = entity_id::uuid
                    )
                    else null
                end
            )
        )
    );

-- 6.9 (Optional) Users can view audit logs with department context
create policy "Users can view audit logs with department context"
    on public.audit_logs
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles up
            join public.user_departments ud on up.id = ud.user_id
            where up.id = (select auth.uid())
            and up.is_active = true
            and (
                ud.department_id = audit_logs.department_id
                or exists (
                    select 1 from public.patients pat
                    where pat.department_id = ud.department_id
                    and (
                        entity_type = 'patients' and entity_id::uuid = pat.id
                        or entity_type = 'patient_documents'
                           and entity_id::uuid in (
                               select id from public.patient_documents
                               where patient_id = pat.id
                           )
                    )
                )
            )
        )
        or public.check_resource_access('audit', 'admin')
    );

-- ======================================================
-- 7. INDEXES
-- ======================================================
-- 7.1 PROFILES INDEXES
create index if not exists idx_profiles_role on public.profiles using btree (medical_role);
create index if not exists idx_profiles_email on public.profiles using btree (email);

-- 7.2 INQUERIES INDEXES
create index if not exists idx_inqueries_user_id on public.inqueries using btree (user_id);

-- 7.3 USER_DEPARTMENTS INDEX
create index if not exists idx_user_departments_access
    on public.user_departments (user_id, department_id, access_level, is_primary);

-- 7.4 RESOURCE_PERMISSIONS INDEX (resource_type, medical_role)
create index if not exists idx_resource_permissions_type_role
    on public.resource_permissions (resource_type, medical_role);

-- 7.5 PATIENTS INDEXES
create index if not exists idx_patients_mrn on public.patients using btree (mrn);
create index if not exists idx_patients_department_access
    on public.patients using btree (department_id, status, created_at desc);

-- gin_trgm_ops for searching name
create index if not exists idx_patients_name_search on public.patients
using gin (
    (first_name || ' ' || last_name) gin_trgm_ops,
    (lower(first_name) || ' ' || lower(last_name)) gin_trgm_ops
);

-- 7.6 PATIENT_DOCUMENTS INDEXES
create index if not exists idx_patient_documents_processing_access
    on public.patient_documents (patient_id, processing_status, category, created_at desc);
create index if not exists idx_patient_documents_document_type_gin
    on public.patient_documents using gin (document_type);
create index if not exists idx_patient_documents_category_access
    on public.patient_documents (category, patient_id);

-- 7.7 DOCUMENT_CHUNKS INDEXES
create index if not exists idx_document_chunks_document_id
    on public.document_chunks using btree (document_id);
create index if not exists idx_document_chunks_metadata
    on public.document_chunks using gin (metadata);
create index if not exists idx_document_chunks_importance
    on public.document_chunks using btree (importance_score);

-- 7.8 AUDIT_LOGS INDEXES
create index if not exists idx_audit_logs_entity_type_id
    on public.audit_logs using btree (entity_type, entity_id);
create index if not exists idx_audit_logs_user_id
    on public.audit_logs using btree (user_id);
create index if not exists idx_audit_logs_created_at
    on public.audit_logs using btree (created_at);

-- 7.9 VECTOR INDEXES
create index if not exists idx_patient_documents_embedding
    on public.patient_documents using ivfflat (document_embedding vector_l2_ops)
    with (lists = 100);

create index if not exists idx_document_chunks_embedding
    on public.document_chunks using ivfflat (chunk_embedding vector_l2_ops)
    with (lists = 100);

-- ======================================================
-- 8. DEFAULT RESOURCE PERMISSIONS (Optional)
-- ======================================================
-- This can be pre-seeded if desired:
insert into public.resource_permissions (resource_type, medical_role, access_level)
values
    -- Patients
    ('patients', 'admin', 'admin'),
    ('patients', 'doctor', 'write'),
    ('patients', 'nurse', 'write'),
    ('patients', 'staff', 'read'),
    ('patients', 'researcher', 'read'),

    -- Documents
    ('documents', 'admin', 'admin'),
    ('documents', 'doctor', 'write'),
    ('documents', 'nurse', 'write'),
    ('documents', 'staff', 'read'),
    ('documents', 'researcher', 'read'),

    -- Lab Results
    ('lab_results', 'admin', 'admin'),
    ('lab_results', 'doctor', 'write'),
    ('lab_results', 'nurse', 'write'),
    ('lab_results', 'staff', 'read'),
    ('lab_results', 'researcher', 'read'),

    -- Administrative docs
    ('administrative_docs', 'admin', 'admin'),
    ('administrative_docs', 'doctor', 'read'),
    ('administrative_docs', 'nurse', 'none'),
    ('administrative_docs', 'staff', 'none'),
    ('administrative_docs', 'researcher', 'none'),

    -- Audit logs
    ('audit', 'admin', 'admin'),
    ('audit', 'doctor', 'read'),
    ('audit', 'nurse', 'read'),
    ('audit', 'staff', 'none'),
    ('audit', 'researcher', 'none')
on conflict do nothing;

-- ======================================================
-- END OF INITIAL MEDICAL SCHEMA
-- ======================================================
