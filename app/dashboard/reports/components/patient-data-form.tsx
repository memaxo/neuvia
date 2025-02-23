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
    <form className="card-premium animate-fade-in space-y-4 p-6" onSubmit={handleSubmit}>
      <div>
        <Label className="mb-1.5 block text-[rgb(var(--foreground)/var(--opacity-90))]" htmlFor="symptoms">
          Symptoms
        </Label>
        <Input 
          className="search-input" 
          id="symptoms" 
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Enter symptoms separated by commas"
          value={symptoms} 
        />
      </div>
      <div>
        <Label className="mb-1.5 block text-[rgb(var(--foreground)/var(--opacity-90))]" htmlFor="medicalHistory">
          Medical History
        </Label>
        <Textarea 
          className="search-input min-h-[100px] resize-y" 
          id="medicalHistory" 
          onChange={(e) => setMedicalHistory(e.target.value)}
          placeholder="Enter medical history"
          value={medicalHistory} 
        />
      </div>
      <div>
        <Label className="mb-1.5 block text-[rgb(var(--foreground)/var(--opacity-90))]" htmlFor="currentMedications">
          Current Medications
        </Label>
        <Input 
          className="search-input" 
          id="currentMedications" 
          onChange={(e) => setCurrentMedications(e.target.value)}
          placeholder="List current medications"
          value={currentMedications} 
        />
      </div>
      <div>
        <Label className="mb-1.5 block text-[rgb(var(--foreground)/var(--opacity-90))]" htmlFor="allergies">
          Allergies
        </Label>
        <Input 
          className="search-input" 
          id="allergies" 
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="List allergies"
          value={allergies} 
        />
      </div>
      <div>
        <Label className="mb-1.5 block text-[rgb(var(--foreground)/var(--opacity-90))]" htmlFor="vitalSigns">
          Vital Signs
        </Label>
        <Input 
          className="search-input" 
          id="vitalSigns" 
          onChange={(e) => setVitalSigns(e.target.value)}
          placeholder="e.g., Blood Pressure, Heart Rate"
          value={vitalSigns} 
        />
      </div>
      <div className="flex justify-end pt-2">
        <Button 
          className="action-button px-6 py-2" 
          type="submit"
        >
          Submit Data
        </Button>
      </div>
    </form>
  )
} 