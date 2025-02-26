/**
 * API Route for medical diagnoses using Perplexity
 * 
 * This route connects document extraction with Perplexity research.
 */
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { performMedicalDiagnosis } from '@/lib/services/research/perplexity-client';

/**
 * POST handler for medical diagnoses
 */
export async function POST(req: NextRequest) {
  // Create Supabase client
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  try {
    // Parse request body
    const body = await req.json();
    const { documentId, query } = body;
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }
    
    // Get document data
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (documentError || !document) {
      return NextResponse.json(
        { error: `Document not found: ${documentError?.message || ''}` },
        { status: 404 }
      );
    }
    
    // Collect patient data from available sources
    let patientData = '';
    
    // Try to get structured content if available
    const { data: structuredData, error: structuredError } = await supabase
      .from('document_data')  // Adjust table name if different
      .select('content')
      .eq('document_id', documentId)
      .single();
    
    if (!structuredError && structuredData?.content) {
      patientData = typeof structuredData.content === 'string'
        ? structuredData.content
        : JSON.stringify(structuredData.content, null, 2);
    }
    
    // If no structured content, get from document chunks
    if (!patientData) {
      const { data: chunks, error: chunksError } = await supabase
        .from('document_chunks')
        .select('content')
        .eq('document_id', documentId)
        .order('page_number', { ascending: true });
      
      if (!chunksError && chunks && chunks.length > 0) {
        patientData = chunks.map(chunk => chunk.content).join('\n\n');
      }
    }
    
    // If still no data, use document content directly
    if (!patientData && document.content) {
      patientData = document.content;
    }
    
    if (!patientData) {
      return NextResponse.json(
        { error: 'No content found for document' },
        { status: 400 }
      );
    }
    
    // Get start time for timing
    const startTime = Date.now();
    
    // Perform medical diagnosis
    const result = await performMedicalDiagnosis(
      query || 'Provide a comprehensive differential diagnosis based on the patient data',
      patientData,
      {
        maxTokens: 4000,
        temperature: 0.5
      }
    );
    
    // Calculate elapsed time
    const elapsedTime = Date.now() - startTime;
    
    // Return results
    return NextResponse.json({
      result,
      documentId,
      timing: {
        elapsedSeconds: elapsedTime / 1000,
        requestTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in medical diagnosis:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 