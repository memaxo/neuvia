'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function PatientDataForm() {
  const [symptoms, setSymptoms] = useState('')
  const [medicalHistory, setMedicalHistory] = useState('')
  const [currentMedications, setCurrentMedications] = useState('')
  const [allergies, setAllergies] = useState('')
  const [vitalSigns, setVitalSigns] = useState('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Logic to send patient data for report generation would go here.
    console.log({
      symptoms,
      medicalHistory,
      currentMedications,
      allergies,
      vitalSigns,
    })
  }

  return (
    <form className="space-y-4 rounded-lg bg-card p-4" onSubmit={handleSubmit}>
      <div>
        <Label className="mb-1 block" htmlFor="symptoms">Symptoms</Label>
        <Input 
          className="w-full" 
          id="symptoms" 
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Enter symptoms separated by commas"
          value={symptoms} 
        />
      </div>
      <div>
        <Label className="mb-1 block" htmlFor="medicalHistory">Medical History</Label>
        <Textarea 
          className="w-full" 
          id="medicalHistory" 
          onChange={(e) => setMedicalHistory(e.target.value)}
          placeholder="Enter medical history"
          value={medicalHistory} 
        />
      </div>
      <div>
        <Label className="mb-1 block" htmlFor="currentMedications">Current Medications</Label>
        <Input 
          className="w-full" 
          id="currentMedications" 
          onChange={(e) => setCurrentMedications(e.target.value)}
          placeholder="List current medications"
          value={currentMedications} 
        />
      </div>
      <div>
        <Label className="mb-1 block" htmlFor="allergies">Allergies</Label>
        <Input 
          className="w-full" 
          id="allergies" 
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="List allergies"
          value={allergies} 
        />
      </div>
      <div>
        <Label className="mb-1 block" htmlFor="vitalSigns">Vital Signs</Label>
        <Input 
          className="w-full" 
          id="vitalSigns" 
          onChange={(e) => setVitalSigns(e.target.value)}
          placeholder="e.g., Blood Pressure, Heart Rate"
          value={vitalSigns} 
        />
      </div>
      <div className="flex justify-end">
        <Button className="mt-4" type="submit">Submit Data</Button>
      </div>
    </form>
  )
} 