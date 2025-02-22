'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-card p-4">
      <div>
        <Label htmlFor="symptoms" className="mb-1 block">Symptoms</Label>
        <Input 
          id="symptoms" 
          value={symptoms} 
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Enter symptoms separated by commas"
          className="w-full" 
        />
      </div>
      <div>
        <Label htmlFor="medicalHistory" className="mb-1 block">Medical History</Label>
        <Textarea 
          id="medicalHistory" 
          value={medicalHistory} 
          onChange={(e) => setMedicalHistory(e.target.value)}
          placeholder="Enter medical history"
          className="w-full" 
        />
      </div>
      <div>
        <Label htmlFor="currentMedications" className="mb-1 block">Current Medications</Label>
        <Input 
          id="currentMedications" 
          value={currentMedications} 
          onChange={(e) => setCurrentMedications(e.target.value)}
          placeholder="List current medications"
          className="w-full" 
        />
      </div>
      <div>
        <Label htmlFor="allergies" className="mb-1 block">Allergies</Label>
        <Input 
          id="allergies" 
          value={allergies} 
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="List allergies"
          className="w-full" 
        />
      </div>
      <div>
        <Label htmlFor="vitalSigns" className="mb-1 block">Vital Signs</Label>
        <Input 
          id="vitalSigns" 
          value={vitalSigns} 
          onChange={(e) => setVitalSigns(e.target.value)}
          placeholder="e.g., Blood Pressure, Heart Rate"
          className="w-full" 
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" className="mt-4">Submit Data</Button>
      </div>
    </form>
  )
} 