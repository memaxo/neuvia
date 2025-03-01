'use client'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  AlertCircle,
  ClipboardList,
  HeartPulse,
  Pill,
  Stethoscope,
  Syringe,
} from 'lucide-react'

interface PatientMedicalInfoProps {
  patient: any
}

export function PatientMedicalInfo({ patient }: PatientMedicalInfoProps) {
  // Helper to parse JSON arrays with fallback
  const parseJsonArray = (
    jsonString: string | null,
    defaultValue: any[] = []
  ) => {
    if (!jsonString) return defaultValue
    try {
      return JSON.parse(jsonString)
    } catch (e) {
      return defaultValue
    }
  }

  // Parse JSON arrays
  const allergies = parseJsonArray(patient.allergies)
  const medications = parseJsonArray(patient.current_medications)
  const conditions = parseJsonArray(patient.conditions)
  const vitalSigns = parseJsonArray(patient.vital_signs)
  const immunizations = parseJsonArray(patient.immunizations)

  return (
    <Tabs defaultValue="overview">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="allergies">Allergies</TabsTrigger>
        <TabsTrigger value="medications">Medications</TabsTrigger>
        <TabsTrigger value="conditions">Conditions</TabsTrigger>
        <TabsTrigger value="vitals">Vitals</TabsTrigger>
        <TabsTrigger value="immunizations">Immunizations</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center text-sm font-medium">
                <HeartPulse className="mr-2 size-4 text-red-500" />
                Blood Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {patient.blood_type || 'Unknown'}
              </div>
              <p className="text-muted-foreground text-xs">
                {patient.blood_type
                  ? 'Verified blood type'
                  : 'Blood type not recorded'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center text-sm font-medium">
                <Stethoscope className="mr-2 size-4 text-blue-500" />
                Primary Physician
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {patient.primary_care_physician || 'Not assigned'}
              </div>
              {patient.primary_care_physician && (
                <p className="text-muted-foreground text-xs">
                  Patient&apos;s registered physician
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center text-sm font-medium">
                <ClipboardList className="text-primary mr-2 size-4" />
                Medical Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-muted/50 flex flex-col items-center rounded-lg p-3">
                  <AlertCircle className="mb-1 size-6 text-amber-500" />
                  <div className="text-xl font-bold">{allergies.length}</div>
                  <div className="text-muted-foreground text-center text-xs">
                    Allergies
                  </div>
                </div>

                <div className="bg-muted/50 flex flex-col items-center rounded-lg p-3">
                  <Pill className="mb-1 size-6 text-blue-500" />
                  <div className="text-xl font-bold">{medications.length}</div>
                  <div className="text-muted-foreground text-center text-xs">
                    Medications
                  </div>
                </div>

                <div className="bg-muted/50 flex flex-col items-center rounded-lg p-3">
                  <Activity className="mb-1 size-6 text-red-500" />
                  <div className="text-xl font-bold">{conditions.length}</div>
                  <div className="text-muted-foreground text-center text-xs">
                    Conditions
                  </div>
                </div>

                <div className="bg-muted/50 flex flex-col items-center rounded-lg p-3">
                  <Syringe className="mb-1 size-6 text-green-500" />
                  <div className="text-xl font-bold">
                    {immunizations.length}
                  </div>
                  <div className="text-muted-foreground text-center text-xs">
                    Immunizations
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Allergies Tab */}
      <TabsContent value="allergies">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 size-5 text-amber-500" />
              Allergies & Reactions
            </CardTitle>
            <CardDescription>
              Documented allergies and adverse reactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allergies.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No allergies have been recorded
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {allergies.map((allergy: any, index: number) => (
                  <div
                    className="border-b pb-3 last:border-0 last:pb-0"
                    key={index}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{allergy.name}</h4>
                      <Badge className="text-xs" variant="outline">
                        {allergy.severity || 'Severity unknown'}
                      </Badge>
                    </div>
                    {allergy.reaction && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        Reaction: {allergy.reaction}
                      </p>
                    )}
                    {allergy.notes && (
                      <p className="mt-1 text-sm">{allergy.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Medications Tab */}
      <TabsContent value="medications">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Pill className="mr-2 size-5 text-blue-500" />
              Current Medications
            </CardTitle>
            <CardDescription>
              Current prescribed and over-the-counter medications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {medications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No medications have been recorded
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {medications.map((medication: any, index: number) => (
                  <div
                    className="border-b pb-3 last:border-0 last:pb-0"
                    key={index}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{medication.name}</h4>
                      {medication.status && (
                        <Badge
                          className="text-xs capitalize"
                          variant={
                            medication.status === 'active'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {medication.status}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {medication.dosage && (
                        <div>
                          <span className="text-muted-foreground">Dosage:</span>{' '}
                          {medication.dosage}
                        </div>
                      )}
                      {medication.frequency && (
                        <div>
                          <span className="text-muted-foreground">
                            Frequency:
                          </span>{' '}
                          {medication.frequency}
                        </div>
                      )}
                      {medication.prescribedBy && (
                        <div>
                          <span className="text-muted-foreground">
                            Prescribed by:
                          </span>{' '}
                          {medication.prescribedBy}
                        </div>
                      )}
                      {medication.startDate && (
                        <div>
                          <span className="text-muted-foreground">
                            Started:
                          </span>{' '}
                          {medication.startDate}
                        </div>
                      )}
                    </div>
                    {medication.notes && (
                      <p className="mt-2 text-sm">{medication.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Conditions Tab */}
      <TabsContent value="conditions">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="mr-2 size-5 text-red-500" />
              Medical Conditions
            </CardTitle>
            <CardDescription>
              Diagnosed medical conditions and health issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conditions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No medical conditions have been recorded
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {conditions.map((condition: any, index: number) => (
                  <div
                    className="border-b pb-3 last:border-0 last:pb-0"
                    key={index}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{condition.name}</h4>
                      {condition.status && (
                        <Badge
                          className="text-xs capitalize"
                          variant={
                            condition.status === 'active'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {condition.status}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {condition.diagnosedDate && (
                        <div>
                          <span className="text-muted-foreground">
                            Diagnosed:
                          </span>{' '}
                          {condition.diagnosedDate}
                        </div>
                      )}
                      {condition.diagnosedBy && (
                        <div>
                          <span className="text-muted-foreground">
                            Diagnosed by:
                          </span>{' '}
                          {condition.diagnosedBy}
                        </div>
                      )}
                    </div>
                    {condition.notes && (
                      <p className="mt-2 text-sm">{condition.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Vitals Tab */}
      <TabsContent value="vitals">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HeartPulse className="text-primary mr-2 size-5" />
              Vital Signs
            </CardTitle>
            <CardDescription>Record of vital sign measurements</CardDescription>
          </CardHeader>
          <CardContent>
            {vitalSigns.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No vital signs have been recorded
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Vital signs rendering would go here */}
                <p>Vital signs data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Immunizations Tab */}
      <TabsContent value="immunizations">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Syringe className="mr-2 size-5 text-green-500" />
              Immunizations
            </CardTitle>
            <CardDescription>
              Record of vaccinations and immunizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {immunizations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No immunizations have been recorded
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Immunizations rendering would go here */}
                <p>Immunization data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
