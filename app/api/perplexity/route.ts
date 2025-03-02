import type { ResearchOptions } from '@/lib/processing/types/research'
import { perplexityService } from '@/lib/services/perplexity/perplexity-service'
import { createServerClient } from '@/lib/supabase/clients'
import { apiError, apiSuccess, getRequestId, withErrorHandling } from '@/lib/api-response'
import { 
  ApplicationError, 
  AuthenticationError, 
  ExternalServiceError, 
  NotFoundError, 
  SystemError, 
  ValidationError 
} from '@/lib/errors'
import logger from '@/lib/logger'
/**
 * Perplexity Research API Route
 *
 * Handles all research requests including medical diagnoses and general research
 * through a unified API endpoint.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * POST handler for research requests
 *
 * @param req The request object
 * @returns JSON response with research results
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const requestId = getRequestId(req);
    const moduleLogger = logger.withMetadata({
      module: 'PerplexityResearch',
      method: 'POST',
      requestId
    });

    moduleLogger.info('Starting research request');

    // Create Supabase client
    const supabase = await createServerClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      moduleLogger.warn('Authentication failed', { userId: user?.id, authError });
      throw new AuthenticationError({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
        data: { error: authError?.message }
      });
    }

    // Parse the request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      moduleLogger.error('Failed to parse request JSON', {}, error);
      throw new ValidationError({
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      });
    }

    const { query, options, documentId } = body;

    // Validate the request
    if (!query && !documentId) {
      moduleLogger.warn('Missing required parameters', { hasQuery: !!query, hasDocumentId: !!documentId });
      throw new ValidationError({
        message: 'Either query or documentId is required',
        code: 'MISSING_PARAMETERS'
      });
    }

    if (query && typeof query !== 'string') {
      moduleLogger.warn('Invalid query type', { queryType: typeof query });
      throw new ValidationError({
        message: 'Query must be a string',
        code: 'INVALID_QUERY_TYPE'
      });
    }

    // Prepare research options
    const researchOptions: ResearchOptions = {
      depth: options?.depth || 'standard',
      sourcesLimit: options?.sourcesLimit || 5,
      includeSourceContent: options?.includeSourceContent ?? true,
      isMedicalDiagnosis: options?.isMedicalDiagnosis || false,
      patientData: options?.patientData,
    };

    // Handle document-based research (primarily for medical diagnoses)
    if (documentId) {
      moduleLogger.info('Processing document-based research', { documentId });
      
      // Mark as medical diagnosis if not explicitly set
      researchOptions.isMedicalDiagnosis = options?.isMedicalDiagnosis !== false;

      try {
        // Get document data
        const { data: document, error: documentError } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (documentError) {
          moduleLogger.error('Failed to retrieve document', { documentId }, documentError);
          
          if (documentError.code === 'PGRST116') {
            throw new NotFoundError({
              message: 'Document not found',
              resource: 'Document',
              code: 'DOCUMENT_NOT_FOUND',
              data: { documentId }
            });
          }
          
          throw new SystemError({
            message: 'Failed to retrieve document data',
            code: 'DB_ERROR',
            data: { documentId },
            cause: documentError
          });
        }

        if (!document) {
          moduleLogger.warn('Document not found', { documentId });
          throw new NotFoundError({
            message: 'Document not found',
            resource: 'Document',
            code: 'DOCUMENT_NOT_FOUND',
            data: { documentId }
          });
        }

        // Collect patient data from available sources
        let patientData = '';

        // Try various approaches to get document content
        moduleLogger.info('Attempting to retrieve document chunks', { documentId });

        try {
          // Try to get document chunks
          const { data: chunks, error: chunksError } = await supabase
            .from('document_chunks')
            .select('content')
            .eq('document_id', documentId)
            .order('page_number', { ascending: true });

          if (chunksError) {
            moduleLogger.warn('Error retrieving document chunks', { documentId }, chunksError);
          } else if (chunks && chunks.length > 0) {
            patientData = chunks
              .map((chunk) => (chunk as { content: string }).content)
              .join('\n\n');
            
            moduleLogger.info('Retrieved document content from chunks', { 
              documentId, 
              chunkCount: chunks.length 
            });
          }
        } catch (chunkError) {
          // Silent catch - continue with alternative method - this is not fatal
          moduleLogger.warn('Error in chunk retrieval, trying alternative methods', {}, chunkError);
        }

        // If still no data, use document content directly - check both field names
        if (!patientData) {
          moduleLogger.info('No chunks found, attempting to use direct document content');
          
          // Handle different field names in different document tables
          if (typeof document === 'object') {
            if ('content_text' in document && document.content_text) {
              patientData = document.content_text;
              moduleLogger.info('Using content_text field from document');
            } else if ('content' in document && document.content) {
              patientData =
                typeof document.content === 'string'
                  ? document.content
                  : JSON.stringify(document.content, null, 2);
              moduleLogger.info('Using content field from document');
            }
          }
        }

        if (!patientData) {
          moduleLogger.error('No content found for document', { 
            documentId, 
            documentType: document.category 
          });
          
          throw new ValidationError({
            message: 'No content found for document',
            code: 'DOCUMENT_CONTENT_MISSING',
            data: { documentId, documentType: document.category }
          });
        }

        // Set the patient data in options
        researchOptions.patientData = patientData;

        // For medical diagnoses from documents, use optimized parameters if not specified
        if (researchOptions.isMedicalDiagnosis) {
          researchOptions.maxTokens = options?.maxTokens || 4000;
          researchOptions.temperature = options?.temperature || 0.5;
          researchOptions.depth = options?.depth || 'comprehensive';
          
          moduleLogger.info('Using optimized parameters for medical diagnosis', {
            maxTokens: researchOptions.maxTokens,
            temperature: researchOptions.temperature,
            depth: researchOptions.depth
          });
        }
      } catch (dbError) {
        if (dbError instanceof ApplicationError) {
          // ApplicationError is already properly formatted, just rethrow
          throw dbError;
        }
        
        moduleLogger.error('Database error retrieving document data', { documentId }, dbError);
        
        throw new SystemError({
          message: 'Failed to retrieve document data',
          code: 'DATABASE_ERROR',
          data: { documentId },
          cause: dbError
        });
      }
    }

    // Record the start time for metrics
    const startTime = Date.now();

    // Determine appropriate query text
    const queryText =
      query ||
      (researchOptions.isMedicalDiagnosis
        ? 'Provide a comprehensive differential diagnosis based on the patient data'
        : 'Research this topic thoroughly');

    moduleLogger.info('Executing research query', { 
      queryTextLength: queryText.length,
      isMedicalDiagnosis: researchOptions.isMedicalDiagnosis,
      depth: researchOptions.depth
    });

    try {
      // Perform the research using the unified Perplexity service
      const result =
        researchOptions.isMedicalDiagnosis && researchOptions.patientData
          ? await perplexityService.performMedicalDiagnosis(
              queryText,
              researchOptions.patientData,
              researchOptions
            )
          : await perplexityService.performDeepResearch(
              queryText,
              researchOptions
            );

      // Calculate the elapsed time
      const elapsed = Date.now() - startTime;

      moduleLogger.info('Research completed successfully', { 
        elapsedMs: elapsed,
        isMedicalDiagnosis: researchOptions.isMedicalDiagnosis,
        hasResults: !!result
      });

      // Prepare the response
      const response = {
        ...result,
        _meta: {
          elapsed: `${elapsed}ms`,
          provider: 'perplexity',
          requestTime: new Date().toISOString(),
          ...(documentId ? { documentId } : {}),
        },
      };

      // Return the result with timing information
      return apiSuccess(response);
    } catch (apiError) {
      moduleLogger.error('Research operation failed', {
        queryTextLength: queryText.length,
        isMedicalDiagnosis: researchOptions.isMedicalDiagnosis,
        elapsedMs: Date.now() - startTime
      }, apiError);

      throw new ExternalServiceError({
        message: 'Research operation failed',
        service: 'Perplexity',
        code: 'PERPLEXITY_API_ERROR',
        data: {
          query: queryText.substring(0, 100) + (queryText.length > 100 ? '...' : ''),
          isMedicalDiagnosis: researchOptions.isMedicalDiagnosis,
          elapsedMs: Date.now() - startTime
        },
        cause: apiError
      });
    }
  }, {
    logMetadata: { endpoint: '/api/perplexity' }
  });
}
