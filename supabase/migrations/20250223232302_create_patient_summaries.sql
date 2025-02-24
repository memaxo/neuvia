/*
 * Migration: Create patient summaries table
 * Description: Creates a table to store AI-generated summaries of patient medical documents
 * with proper RLS policies and triggers.
 * 
 * Tables affected:
 * - public.patient_summaries (created)
 * - public.audit_logs (referenced)
 * 
 * Security:
 * - Enables RLS
 * - Implements department-based access control
 * - Follows principle of least privilege
 */

-- Create patient summaries table to store consolidated medical information
create table if not exists public.patient_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade not null,
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  generated_at timestamptz not null default now(),
  document_count integer not null check (document_count >= 0),
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  department_id uuid references public.departments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) not null,
  last_modified_by uuid references auth.users(id) not null,
  -- Add validation for summary structure
  constraint summary_structure_check check (
    summary ? 'patientInfo' and
    summary ? 'medicalHistory' and
    summary ? 'currentConditions' and
    summary ? 'medications' and
    summary ? 'recentFindings' and
    summary ? 'treatmentPlans' and
    summary ? 'labResults' and
    summary ? 'imagingResults' and
    summary ? 'recommendations' and
    summary ? 'metadata'
  )
);

-- Add detailed table comment
comment on table public.patient_summaries is 'Stores AI-generated summaries of patient medical documents for consolidated review. Each summary contains structured medical information extracted from multiple documents, organized by category (e.g., patient info, medical history, etc.) and includes verification metadata.';

-- Add column comments
comment on column public.patient_summaries.id is 'Unique identifier for the summary';
comment on column public.patient_summaries.patient_id is 'Reference to the patient this summary belongs to';
comment on column public.patient_summaries.summary is 'JSON structure containing the organized medical information';
comment on column public.patient_summaries.generated_at is 'Timestamp when the AI generated this summary';
comment on column public.patient_summaries.document_count is 'Number of documents processed for this summary';
comment on column public.patient_summaries.verified_at is 'Timestamp when a medical professional verified this summary';
comment on column public.patient_summaries.verified_by is 'Reference to the user who verified this summary';
comment on column public.patient_summaries.department_id is 'Department that owns this summary';
comment on column public.patient_summaries.created_by is 'User who created this summary';
comment on column public.patient_summaries.last_modified_by is 'User who last modified this summary';

-- Add indexes for better query performance
create index patient_summaries_patient_id_idx on public.patient_summaries(patient_id);
create index patient_summaries_verified_at_idx on public.patient_summaries(verified_at);
create index patient_summaries_verified_by_idx on public.patient_summaries(verified_by);
create index patient_summaries_generated_at_idx on public.patient_summaries(generated_at);
create index patient_summaries_department_id_idx on public.patient_summaries(department_id);
create index patient_summaries_created_by_idx on public.patient_summaries(created_by);

-- Enable Row Level Security
alter table public.patient_summaries enable row level security;

-- Create RLS policies for authenticated users
create policy "Summaries are viewable by authenticated users with department access"
on public.patient_summaries
for select
to authenticated
using (
  exists (
    select 1 
    from public.user_departments ud
    where ud.department_id = patient_summaries.department_id
      and ud.user_id = auth.uid()
      and ud.access_level >= 'read'
  )
  or exists (
    select 1 
    from public.profiles up
    where up.id = auth.uid()
      and up.medical_role = 'admin'
  )
);

create policy "Summaries can be created by authenticated users with write access"
on public.patient_summaries
for insert
to authenticated
with check (
  exists (
    select 1 
    from public.user_departments ud
    where ud.department_id = department_id
      and ud.user_id = auth.uid()
      and ud.access_level >= 'write'
  )
  and created_by = auth.uid()
  and last_modified_by = auth.uid()
);

create policy "Summaries can be updated by authenticated users with write access"
on public.patient_summaries
for update
to authenticated
using (
  exists (
    select 1 
    from public.user_departments ud
    where ud.department_id = patient_summaries.department_id
      and ud.user_id = auth.uid()
      and ud.access_level >= 'write'
  )
)
with check (
  exists (
    select 1 
    from public.user_departments ud
    where ud.department_id = department_id
      and ud.user_id = auth.uid()
      and ud.access_level >= 'write'
  )
  and last_modified_by = auth.uid()
);

create policy "Summaries can be deleted by authenticated users with admin access"
on public.patient_summaries
for delete
to authenticated
using (
  exists (
    select 1 
    from public.profiles up
    where up.id = auth.uid()
      and up.medical_role = 'admin'
  )
);

-- Create trigger to update updated_at timestamp
create trigger set_updated_at_patient_summaries
  before update on public.patient_summaries
  for each row
  execute function public.handle_updated_at();

-- Create trigger to log changes to audit_logs
create or replace function public.log_patient_summary_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      changes,
      department_id
    ) values (
      auth.uid(),
      'create',
      'patient_summaries',
      new.id,
      jsonb_build_object('summary', new.summary),
      new.department_id
    );
  elsif (tg_op = 'UPDATE') then
    insert into audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      changes,
      department_id
    ) values (
      auth.uid(),
      'update',
      'patient_summaries',
      new.id,
      jsonb_build_object(
        'old', to_jsonb(old),
        'new', to_jsonb(new),
        'changed_fields', (
          select jsonb_object_agg(key, value)
          from jsonb_each(to_jsonb(new))
          where to_jsonb(new) -> key <> to_jsonb(old) -> key
        )
      ),
      new.department_id
    );
  elsif (tg_op = 'DELETE') then
    insert into audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      changes,
      department_id
    ) values (
      auth.uid(),
      'delete',
      'patient_summaries',
      old.id,
      to_jsonb(old),
      old.department_id
    );
  end if;
  return coalesce(new, old);
end;
$$;

comment on function public.log_patient_summary_changes is 'Trigger function to log changes to patient_summaries table in audit_logs';

create trigger log_patient_summary_changes_trigger
  after insert or update or delete on public.patient_summaries
  for each row
  execute function public.log_patient_summary_changes();
