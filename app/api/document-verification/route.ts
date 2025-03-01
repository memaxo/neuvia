import { verificationService } from '@/lib/services/verification/verification-service'
import { createServerClient } from '@/lib/supabase/clients'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { documentId, workflowId } = await req.json()

    // Validate required fields
    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createServerClient()

    // Fetch the document from patient_documents
    const { data: patientDocument, error: docError } = await supabase
      .from('patient_documents')
      .select('*, patients(*)')
      .eq('id', documentId)
      .single()

    if (docError || !patientDocument) {
      console.error('Error fetching patient document:', docError)
      return NextResponse.json(
        { error: 'Patient document not found' },
        { status: 404 }
      )
    }

    // Get workflow state
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_states')
      .select('*')
      .eq('id', workflowId)
      .single()

    if (workflowError || !workflow) {
      console.error('Error fetching workflow:', workflowError)
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Format the data to match the expected ExtractedDocument structure
    // using patient_documents fields directly
    const extractedDocument = {
      id: patientDocument.id,
      patientId: patientDocument.patient_id,
      documentType: {
        category: patientDocument.category || 'clinical',
        type: 'medical_record', // Default document type
      },
      extractedData: {
        rawText: patientDocument.content_text || '',
        entities: patientDocument.key_findings || [],
        metadata: patientDocument.metadata || {},
        confidence: 0.7, // Default confidence value
      },
      processingStatus: {
        status: patientDocument.processing_status || 'processed',
        processedAt: patientDocument.updated_at,
      },
      fileName: patientDocument.file_path?.split('/').pop() || '',
      fileType: patientDocument.file_type,
    }

    // Generate verification items
    const verificationItems =
      verificationService.generateVerificationItems(extractedDocument)

    // Prepare response with both document and verification items
    return NextResponse.json({
      document: extractedDocument,
      verificationItems,
      workflow,
    })
  } catch (error) {
    console.error('Document verification API error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createServerClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get URL parameters
    const { searchParams } = new URL(request.url)
    const extractedDocumentId = searchParams.get('extractedDocumentId')

    if (!extractedDocumentId) {
      return NextResponse.json(
        { error: 'Missing extractedDocumentId parameter' },
        { status: 400 }
      )
    }

    // Get patient document
    const { data: patientDocument, error: docError } = await supabase
      .from('patient_documents')
      .select('*')
      .eq('id', extractedDocumentId)
      .single()

    if (docError || !patientDocument) {
      return NextResponse.json(
        { error: 'Patient document not found' },
        { status: 404 }
      )
    }

    // Transform to expected format
    const extractedDocument = {
      id: patientDocument.id,
      createdAt: new Date(patientDocument.created_at || Date.now()),
      documentType: patientDocument.document_type,
      patientId: patientDocument.patient_id,
      extractedData: {
        rawText: patientDocument.content_text || '',
        metadata: patientDocument.metadata || {},
        chunks: [],
      },
      isSuccessful: patientDocument.is_processed || false,
      errorMessage: patientDocument.processing_error,
    }

    // Generate verification items
    const verificationItems =
      verificationService.generateVerificationItems(extractedDocument)

    // Return verification items
    return NextResponse.json({
      success: true,
      verificationItems,
    })
  } catch (error) {
    console.error('[API] Verification generation error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
      },
      { status: 500 }
    )
  }
}
