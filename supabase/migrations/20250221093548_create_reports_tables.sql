-- Create reports table for storing medical diagnostic reports and analysis
create table public.reports (
  -- Strictly controlled fields
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.patients(id) on delete cascade not null,
  type text not null check (type in ('diagnostic', 'progress', 'analytics')),
  status text not null check (status in ('processing', 'completed', 'failed')),
  title text not null,
  department_id uuid references public.departments(id) not null,
  
  -- Required metadata with strict structure
  metadata jsonb not null check (
    metadata ? 'patientInfo' and
    (metadata->'patientInfo') ? 'symptoms' and
    (metadata->'patientInfo') ? 'medicalHistory' and
    (metadata->'patientInfo') ? 'currentMedications' and
    (metadata->'patientInfo') ? 'allergies' and
    (metadata->'patientInfo') ? 'vitalSigns'
  ),
  
  -- Compliance metadata (strict but with defaults)
  compliance_metadata jsonb not null default '{
    "hipaa_access_log": [],
    "data_retention_policy": "standard",
    "regulatory_flags": []
  }'::jsonb check (
    compliance_metadata ? 'hipaa_access_log' and
    compliance_metadata ? 'data_retention_policy' and
    compliance_metadata ? 'regulatory_flags' and
    jsonb_typeof(compliance_metadata->'hipaa_access_log') = 'array'
  ),
  
  -- Flexible clinical content (basic type checking only)
  summary text,
  content jsonb,
  findings jsonb check (
    findings is null or jsonb_typeof(findings) = 'array'
  ),
  recommendations jsonb check (
    recommendations is null or jsonb_typeof(recommendations) = 'array'
  ),
  differential_diagnoses jsonb check (
    differential_diagnoses is null or jsonb_typeof(differential_diagnoses) = 'array'
  ),
  evidence_mapping jsonb check (
    evidence_mapping is null or jsonb_typeof(evidence_mapping) = 'object'
  ),
  
  -- Medical codes (flexible)
  snomed_codes jsonb check (
    snomed_codes is null or jsonb_typeof(snomed_codes) = 'array'
  ),
  icd_codes jsonb check (
    icd_codes is null or jsonb_typeof(icd_codes) = 'array'
  ),
  
  -- AI model metadata (semi-strict)
  model_metadata jsonb not null default '{
    "version": "1.0.0",
    "training_date": null,
    "reasoning_chain": []
  }'::jsonb check (
    model_metadata ? 'version' and
    model_metadata ? 'training_date' and
    model_metadata ? 'reasoning_chain'
  ),
  
  -- Validation metadata (semi-strict)
  validation_metadata jsonb not null default '{
    "checksum": "",
    "uncertainty_metrics": {},
    "reviewer_attestation": {"reviewed": false}
  }'::jsonb check (
    validation_metadata ? 'checksum' and
    validation_metadata ? 'uncertainty_metrics' and
    validation_metadata ? 'reviewer_attestation'
  ),
  
  -- Supporting documentation (flexible)
  source_documents jsonb check (
    source_documents is null or jsonb_typeof(source_documents) = 'array'
  ),
  medical_references jsonb check (
    medical_references is null or jsonb_typeof(medical_references) = 'array'
  ),
  clinical_guidelines jsonb check (
    clinical_guidelines is null or jsonb_typeof(clinical_guidelines) = 'array'
  ),
  
  -- Quality metrics (semi-strict)
  confidence_score numeric check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  ),
  
  -- Error handling
  error_message text,
  
  -- Audit trail (strict)
  created_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  created_by uuid references auth.users(id) not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid references auth.users(id) not null,
  reviewed_at timestamp with time zone,
  reviewed_by uuid references auth.users(id)
);

-- Create trigger functions for detailed JSON validation
create or replace function public.validate_report_json()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Only validate non-null arrays that have content
  -- Findings validation (if present and non-empty)
  if new.findings is not null and jsonb_array_length(new.findings) > 0 then
    if not (
      select bool_and(
        value ? 'description' and
        value ? 'category' and
        value ? 'severity' and
        (value->>'severity')::text in ('low', 'medium', 'high')
      )
      from jsonb_array_elements(new.findings)
    ) then
      raise exception 'Invalid findings structure';
    end if;
  end if;

  -- Recommendations validation (if present and non-empty)
  if new.recommendations is not null and jsonb_array_length(new.recommendations) > 0 then
    if not (
      select bool_and(
        value ? 'recommendation' and
        value ? 'priority' and
        (value->>'priority')::text in ('low', 'medium', 'high')
      )
      from jsonb_array_elements(new.recommendations)
    ) then
      raise exception 'Invalid recommendations structure';
    end if;
  end if;

  -- Differential diagnoses validation (if present and non-empty)
  if new.differential_diagnoses is not null and jsonb_array_length(new.differential_diagnoses) > 0 then
    if not (
      select bool_and(
        value ? 'condition' and
        value ? 'confidence' and
        (value->>'confidence')::numeric between 0 and 1
      )
      from jsonb_array_elements(new.differential_diagnoses)
    ) then
      raise exception 'Invalid differential diagnoses structure';
    end if;
  end if;

  -- Medical codes validation (if present)
  if new.snomed_codes is not null and jsonb_array_length(new.snomed_codes) > 0 then
    -- Validate SNOMED CT code format (if needed)
    -- This is a basic check, adjust pattern as needed
    if not (
      select bool_and(value::text ~ '^\d+$')
      from jsonb_array_elements_text(new.snomed_codes)
    ) then
      raise exception 'Invalid SNOMED CT code format';
    end if;
  end if;

  if new.icd_codes is not null and jsonb_array_length(new.icd_codes) > 0 then
    -- Validate ICD-10 code format (if needed)
    -- This is a basic check, adjust pattern as needed
    if not (
      select bool_and(value::text ~ '^[A-Z]\d{2}(\.\d+)?$')
      from jsonb_array_elements_text(new.icd_codes)
    ) then
      raise exception 'Invalid ICD-10 code format';
    end if;
  end if;

  return new;
end;
$$;

-- Create trigger for JSON validation
create trigger validate_report_json_trigger
before insert or update on public.reports
for each row
execute function public.validate_report_json();

-- Add indexes for performance optimization
create index reports_patient_id_idx on public.reports (patient_id);
create index reports_created_by_idx on public.reports (created_by);
create index reports_status_idx on public.reports (status);
create index reports_created_at_idx on public.reports (created_at desc);
create index reports_department_id_idx on public.reports (department_id);
create index reports_type_idx on public.reports (type);
create index reports_reviewed_by_idx on public.reports (reviewed_by);
create index reports_completed_at_idx on public.reports (completed_at desc);

-- Add GiST index for full text search on content and summary
create index reports_content_search_idx on public.reports using gin (to_tsvector('english', content::text));
create index reports_summary_search_idx on public.reports using gin (to_tsvector('english', summary));

-- Add GIN indexes for efficient JSON querying
create index reports_findings_gin_idx on public.reports using gin (findings);
create index reports_differential_diagnoses_gin_idx on public.reports using gin (differential_diagnoses);
create index reports_snomed_codes_gin_idx on public.reports using gin (snomed_codes);
create index reports_icd_codes_gin_idx on public.reports using gin (icd_codes);

-- Add comments for documentation
comment on table public.reports is 'Medical reports generated through AI analysis of patient data';
comment on column public.reports.type is 'Type of report: diagnostic, progress, or analytics';
comment on column public.reports.status is 'Current status of report generation: processing, completed, or failed';
comment on column public.reports.title is 'Report title generated based on findings and type';
comment on column public.reports.summary is 'Executive summary of the report findings';
comment on column public.reports.content is 'Generated report content in HTML format';
comment on column public.reports.metadata is 'Patient information used for report generation including symptoms, history, medications, etc';
comment on column public.reports.findings is 'Key medical findings identified during analysis';
comment on column public.reports.recommendations is 'Treatment and follow-up recommendations';
comment on column public.reports.differential_diagnoses is 'Ranked list of possible diagnoses with confidence scores';
comment on column public.reports.evidence_mapping is 'Mapping between symptoms and diagnoses with supporting evidence';
comment on column public.reports.snomed_codes is 'Structured clinical terminology codes for findings';
comment on column public.reports.icd_codes is 'International Classification of Diseases codes for diagnoses';
comment on column public.reports.confidence_score is 'AI confidence score for the analysis (0-1)';
comment on column public.reports.source_documents is 'References to source documents used in analysis';
comment on column public.reports.medical_references is 'Citations and DOIs of referenced medical literature';
comment on column public.reports.clinical_guidelines is 'Referenced clinical guidelines and protocols';
comment on column public.reports.model_metadata is 'AI model information including version, training date, and reasoning chain';
comment on column public.reports.validation_metadata is 'Quality assurance data including checksums and uncertainty metrics';
comment on column public.reports.compliance_metadata is 'Regulatory compliance tracking including HIPAA logs';
comment on column public.reports.error_message is 'Error message if report generation failed';
comment on column public.reports.department_id is 'Department that generated the report';
comment on column public.reports.reviewed_at is 'Timestamp of clinical review';
comment on column public.reports.reviewed_by is 'Clinician who reviewed the report';

-- Enable RLS
alter table public.reports enable row level security;

-- Policies for authenticated users
create policy "Reports are viewable by authenticated users who created them or have access to the patient"
on public.reports
for select
to authenticated
using (
  auth.uid() = created_by
  or exists (
    select 1 
    from public.patients p
    where p.id = reports.patient_id
    and (
      exists (
        select 1 
        from public.user_departments ud
        where ud.user_id = auth.uid()
        and ud.department_id = p.department_id
      )
      or p.primary_care_physician = auth.uid()::text
    )
  )
);

create policy "Reports can be created by authenticated users with patient access"
on public.reports
for insert
to authenticated
with check (
  exists (
    select 1 
    from public.patients p
    where p.id = patient_id
    and (
      exists (
        select 1 
        from public.user_departments ud
        where ud.user_id = auth.uid()
        and ud.department_id = p.department_id
      )
      or p.primary_care_physician = auth.uid()::text
    )
  )
);

create policy "Reports can be updated by users who created them or reviewers"
on public.reports
for update
to authenticated
using (
  auth.uid() = created_by
  or (
    auth.uid() in (
      select user_id 
      from public.user_departments ud
      where ud.department_id = department_id
    )
  )
)
with check (
  auth.uid() = created_by
  or (
    auth.uid() in (
      select user_id 
      from public.user_departments ud
      where ud.department_id = department_id
    )
  )
);

create policy "Reports can be deleted by users who created them"
on public.reports
for delete
to authenticated
using (auth.uid() = created_by);

-- Create audit log table for tracking all report actions
create table public.report_audit_logs (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.reports(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  changes jsonb,
  timestamp timestamp with time zone default now()
);

comment on table public.report_audit_logs is 'Audit trail for all report-related actions';

-- Enable RLS on audit logs
alter table public.report_audit_logs enable row level security;

-- Only allow insert, admins can view
create policy "Audit logs can be inserted by authenticated users"
on public.report_audit_logs
for insert
to authenticated
with check (true);

create policy "Audit logs viewable by admins only"
on public.report_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles up
    where up.id = (select auth.uid())
    and up.medical_role = 'admin'
  )
);

-- Add trigger to automatically log report changes
create or replace function public.log_report_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into report_audit_logs (report_id, user_id, action, changes)
    values (new.id, auth.uid(), 'create', to_jsonb(new));
  elsif (tg_op = 'UPDATE') then
    insert into report_audit_logs (report_id, user_id, action, changes)
    values (
      new.id,
      auth.uid(),
      'update',
      jsonb_build_object(
        'old', to_jsonb(old),
        'new', to_jsonb(new),
        'changed_fields', (
          select jsonb_object_agg(key, value)
          from jsonb_each(to_jsonb(new))
          where to_jsonb(new) -> key <> to_jsonb(old) -> key
        )
      )
    );
  elsif (tg_op = 'DELETE') then
    insert into report_audit_logs (report_id, user_id, action, changes)
    values (old.id, auth.uid(), 'delete', to_jsonb(old));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger log_report_changes_trigger
after insert or update or delete on public.reports
for each row
execute function public.log_report_changes();

-- Add trigger to set created_by and updated_by on insert/update
create or replace function public.set_report_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  elsif (tg_op = 'UPDATE') then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger set_report_audit_fields_trigger
before insert or update on public.reports
for each row
execute function public.set_report_audit_fields();
