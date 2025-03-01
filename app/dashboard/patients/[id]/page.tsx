import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { Clock, FilePlus, FileUp } from 'lucide-react'
import Link from 'next/link'
import { getPatient, getPatientDocumentStats } from '../actions'
import { PatientDocumentStats } from './components/patient-document-stats'
import { PatientDocumentTimeline } from './components/patient-document-timeline'
import { PatientDocuments } from './components/patient-documents'
import { PatientMedicalInfo } from './components/patient-medical-info'
import { PatientOverview } from './components/patient-overview'

export default async function PatientDetailPage({
  params,
}: { params: { id: string } }) {
  const patient = await getPatient(params.id)
  const documentStats = await getPatientDocumentStats(params.id)

  return (
    <div className="space-y-6 p-6">
      {/* Patient header with key information */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {patient.first_name} {patient.last_name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-muted-foreground text-sm">
              MRN: {patient.mrn} • DOB:{' '}
              {format(new Date(patient.date_of_birth), 'PP')} •
              {patient.gender &&
                ` ${patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}`}
            </p>
            <Badge
              variant={patient.status === 'active' ? 'default' : 'secondary'}
            >
              {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/patients/${params.id}/edit`}>
              Edit Patient
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/dashboard/patients/${params.id}/documents/upload`}>
              <FileUp className="mr-2 size-4" />
              Upload Document
            </Link>
          </Button>
        </div>
      </div>

      {/* Document stats */}
      <PatientDocumentStats stats={documentStats} />

      {/* Tabbed interface */}
      <Tabs className="w-full" defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="mr-2 size-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="medical">Medical Info</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="overview">
          <PatientOverview patient={patient} />
        </TabsContent>

        <TabsContent className="mt-6" value="documents">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Patient Documents</CardTitle>
                  <CardDescription>
                    All documents associated with this patient record
                  </CardDescription>
                </div>
                <Button asChild size="sm">
                  <Link
                    href={`/dashboard/patients/${params.id}/documents/upload`}
                  >
                    <FilePlus className="mr-2 size-4" />
                    Add Document
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PatientDocuments
                documents={patient.documents}
                patientId={params.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6" value="timeline">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Document Timeline</CardTitle>
                  <CardDescription>
                    Chronological view of patient documents
                  </CardDescription>
                </div>
                <Button asChild size="sm">
                  <Link
                    href={`/dashboard/patients/${params.id}/documents/upload`}
                  >
                    <FilePlus className="mr-2 size-4" />
                    Add Document
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PatientDocumentTimeline
                documents={patient.documents}
                patientId={params.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6" value="medical">
          <PatientMedicalInfo patient={patient} />
        </TabsContent>

        <TabsContent className="mt-6" value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Generated medical reports for this patient
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Reports will be implemented in Phase 2 */}
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No reports available yet
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/patients/${params.id}/reports/new`}>
                    Generate New Report
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
