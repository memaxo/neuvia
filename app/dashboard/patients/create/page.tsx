import { redirect } from 'next/navigation'

import { createPatient } from '../actions'
import { PatientForm } from '../components/patient-form'

export default function CreatePatientPage() {
  async function onSubmit(formData: FormData) {
    'use server'

    try {
      const patientId = await createPatient(formData)
      redirect(`/dashboard/patients/${patientId}/documents/upload`)
    } catch (error) {
      console.error('Error creating patient:', error)
      throw error
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create Patient Record
        </h1>
        <p className="text-muted-foreground">
          Enter the patient&apos;s basic information. You&apos;ll be able to
          upload documents in the next step.
        </p>
      </div>

      <PatientForm action={onSubmit} />
    </div>
  )
}
