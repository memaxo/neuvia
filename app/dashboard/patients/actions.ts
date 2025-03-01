'use server'

import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/supabase'
import { createServerClient } from '@/lib/supabase/clients'

type PatientInsert = Database['public']['Tables']['patients']['Insert']

export async function createPatient(formData: FormData) {
  const supabase = await createServerClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null || user === undefined) throw new Error('Not authenticated')

  // Extract form data
  const fullName = formData.get('fullName')?.toString() ?? ''
  const [firstName, ...lastNameParts] = fullName.split(' ')
  const lastName = lastNameParts.join(' ')
  const dateOfBirth = formData.get('dateOfBirth')?.toString()

  if (!dateOfBirth) {
    throw new Error('Date of birth is required')
  }

  // Basic information
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
    mrn: formData.get('mrn')?.toString() || 'TBD', // Use provided MRN or placeholder
  }

  // Add contact information
  data.address_line1 = formData.get('addressLine1')?.toString() || null
  data.address_line2 = formData.get('addressLine2')?.toString() || null
  data.city = formData.get('city')?.toString() || null
  data.state = formData.get('state')?.toString() || null
  data.postal_code = formData.get('postalCode')?.toString() || null
  data.country = formData.get('country')?.toString() || null

  // Add emergency contact
  data.emergency_contact_name =
    formData.get('emergencyContactName')?.toString() || null
  data.emergency_contact_phone =
    formData.get('emergencyContactPhone')?.toString() || null
  data.emergency_contact_relationship =
    formData.get('emergencyContactRelationship')?.toString() || null

  // Add medical information
  data.blood_type = formData.get('bloodType')?.toString() || null

  // Convert string fields to JSON arrays/objects
  const allergies = formData.get('allergies')?.toString()
  if (allergies) {
    data.allergies = JSON.stringify(
      allergies
        .split('\n')
        .filter(Boolean)
        .map((item) => ({ name: item.trim() }))
    )
  }

  const medications = formData.get('currentMedications')?.toString()
  if (medications) {
    data.current_medications = JSON.stringify(
      medications
        .split('\n')
        .filter(Boolean)
        .map((item) => ({ name: item.trim() }))
    )
  }

  const conditions = formData.get('conditions')?.toString()
  if (conditions) {
    data.conditions = JSON.stringify(
      conditions
        .split('\n')
        .filter(Boolean)
        .map((item) => ({ name: item.trim() }))
    )
  }

  // Add administrative information
  data.primary_care_physician =
    formData.get('primaryCarePhysician')?.toString() || null
  data.insurance_provider =
    formData.get('insuranceProvider')?.toString() || null
  data.insurance_id = formData.get('insuranceId')?.toString() || null

  // Insert into patients table
  const { data: patient, error } = await supabase
    .from('patients')
    .insert(data)
    .select()
    .single()

  if (error !== null) {
    throw error
  }

  // Revalidate the patients list page
  revalidatePath('/dashboard/patients')

  return patient.id
}

export async function getPatient(id: string) {
  const supabase = await createServerClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      *,
      documents:patient_documents(
        id,
        title,
        category,
        document_type,
        file_type,
        document_date,
        processing_status,
        is_processed,
        created_at,
        key_findings
      )
    `)
    .eq('id', id)
    .single()

  if (error !== null) {
    throw error
  }

  return patient
}

export async function getPatientDocumentStats(patientId: string) {
  const supabase = await createServerClient()

  // Get document counts by category
  const { data: categoryStats, error: categoryError } = await supabase
    .from('patient_documents')
    .select('category, count(*)')
    .eq('patient_id', patientId)
    .group('category')

  // Get document counts by processing status
  const { data: statusStats, error: statusError } = await supabase
    .from('patient_documents')
    .select('processing_status, count(*)')
    .eq('patient_id', patientId)
    .group('processing_status')

  if (categoryError || statusError) {
    throw categoryError || statusError
  }

  return {
    byCategory: categoryStats || [],
    byStatus: statusStats || [],
    total: categoryStats
      ? categoryStats.reduce((sum, item) => sum + parseInt(item.count, 10), 0)
      : 0,
    patientId,
  }
}
