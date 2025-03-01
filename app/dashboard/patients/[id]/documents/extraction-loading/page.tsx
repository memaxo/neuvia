'use client'

import { useParams } from 'next/navigation'

export default function ExtractionLoadingPage() {
  const params = useParams()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Extracting Document...
      </h1>
      <p className="text-muted-foreground mt-2">
        We are currently processing and extracting data from your uploaded
        document.
      </p>
      <p className="text-muted-foreground mt-2">
        router.push(`/dashboard/chat?mode=verification&patientId=${params.id}`);
      </p>
      <div className="mt-4 flex items-center space-x-2">
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
        <span className="text-sm text-muted-foreground">Please wait...</span>
      </div>
    </div>
  )
}
