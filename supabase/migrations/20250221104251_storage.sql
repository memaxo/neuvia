-- Create a secure storage bucket for medical scans
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false);

comment on table storage.objects is 'Medical scan files uploaded by authenticated users';

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Policy: Allow authenticated users to view their own uploaded files
create policy "Users can view their own uploaded files"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'scans'
    and owner = auth.uid()
);

-- Policy: Allow authenticated users to upload files
create policy "Users can upload files"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'scans'
    and (storage.foldername(name))[1] = 'uploads'
);

-- Policy: Allow authenticated users to update their own files
create policy "Users can update their own files"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'scans'
    and owner = auth.uid()
)
with check (
    bucket_id = 'scans'
    and owner = auth.uid()
);

-- Policy: Allow authenticated users to delete their own files
create policy "Users can delete their own files"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'scans'
    and owner = auth.uid()
);
