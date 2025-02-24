'use server';

import { revalidatePath } from 'next/cache';

import type { Database } from '@/lib/supabase';
import { createServerClient } from '@/lib/supabase/clients';

type PatientInsert = Database['public']['Tables']['patients']['Insert'];

export async function createPatient(formData: FormData) {
  const supabase = await createServerClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null || user === undefined) throw new Error('Not authenticated');

  // Extract form data
  const fullName = formData.get('fullName')?.toString() ?? '';
  const [firstName, ...lastNameParts] = fullName.split(' ');
  const lastName = lastNameParts.join(' ');
  const dateOfBirth = formData.get('dateOfBirth')?.toString();
  
  if (!dateOfBirth) {
    throw new Error('Date of birth is required');
  }

  const data: PatientInsert = {
    first_name: firstName,
    last_name: lastName || '',
    date_of_birth: dateOfBirth,
    gender: formData.get('gender')?.toString() ?? null,
    preferred_language: formData.get('preferredLanguage')?.toString() ?? null,
    email: formData.get('email')?.toString() ?? null,
    phone: formData.get('phone')?.toString() ?? null,
    created_by: user.id,
    last_modified_by: user.id,
    status: 'active',
    mrn: 'TBD' // Medical Record Number is required, using placeholder
  };

  // Insert into patients table
  const { data: patient, error } = await supabase
    .from('patients')
    .insert(data)
    .select()
    .single();

  if (error !== null) {
    throw error;
  }

  // Revalidate the patients list page
  revalidatePath('/dashboard/patients');

  return patient.id;
}

export async function getPatient(id: string) {
  const supabase = await createServerClient();
  
  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      *,
      documents:patient_documents(*)
    `)
    .eq('id', id)
    .single();

  if (error !== null) {
    throw error;
  }

  return patient;
} 