import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'
import { OpenAIEmbeddings } from '@langchain/openai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiSuccess, getRequestId } from '@/lib/api-response'
import { 
  ExternalServiceError, 
  ValidationError, 
  AuthenticationError,
  SystemError 
} from '@/lib/errors'
import logger from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/clients'
import { createApiRoute } from '@/lib/api/route-helpers'

export const runtime = 'edge'

// Before running, follow set-up instructions at
// https://js.langchain.com/v0.2/docs/integrations/vectorstores/supabase

/**
 * This handler takes input text, splits it into chunks, and embeds those chunks
 * into a vector store for later retrieval. See the following docs for more information:
 *
 * https://js.langchain.com/v0.2/docs/how_to/recursive_text_splitter
 * https://js.langchain.com/v0.2/docs/integrations/vectorstores/supabase
 */
export const POST = createApiRoute(async (req: NextRequest) => {
  const requestId = getRequestId(req);
  const moduleLogger = logger.withMetadata({
    module: 'RetrievalIngest',
    method: 'POST',
    requestId,
    endpoint: '/api/retrieval/ingest'
  });
  
  moduleLogger.info('Processing vector document ingestion request');
  
  // Verify authentication
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    moduleLogger.warn('Authentication failed', { authError });
    throw new AuthenticationError({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
      data: { error: authError?.message }
    });
  }
  
  // Parse request body - OpenAPI validation will handle this
  const body = await req.json();
  const { text, metadata, patientId, documentId, chunkSize = 256, chunkOverlap = 20 } = body;

  if (process.env.NEXT_PUBLIC_DEMO === 'true') {
    moduleLogger.info('Attempt to ingest in demo mode');
    throw new ValidationError({
      message: [
        'Ingest is not supported in demo mode.',
        'Please set up your own version of the repo here: https://github.com/langchain-ai/langchain-nextjs-template',
      ].join('\n'),
      code: 'DEMO_MODE',
      statusCode: 403
    });
  }

  try {
    moduleLogger.info('Starting document ingestion', {
      textLength: text.length,
      userId: user.id
    });
    
    // Create Supabase client for vector operations
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!
    );

    if (!client) {
      throw new SystemError({
        message: 'Failed to create Supabase client',
        code: 'CLIENT_INITIALIZATION_FAILED'
      });
    }

    // Configure text splitter
    const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
      chunkSize,
      chunkOverlap,
    });

    moduleLogger.info('Splitting document into chunks', {
      chunkSize,
      chunkOverlap
    });
    
    // Split document into chunks
    let splitDocuments;
    try {
      splitDocuments = await splitter.createDocuments([text]);
      
      if (!splitDocuments || splitDocuments.length === 0) {
        throw new ValidationError({
          message: 'Document splitting produced no chunks',
          code: 'EMPTY_DOCUMENT_CHUNKS'
        });
      }
      
      moduleLogger.info('Document successfully split', {
        chunkCount: splitDocuments.length
      });
    } catch (splitError) {
      moduleLogger.error('Failed to split document', {}, splitError);
      throw new SystemError({
        message: 'Document splitting failed',
        code: 'DOCUMENT_SPLITTING_FAILED',
        cause: splitError
      });
    }
    
    // Add metadata to each document if provided
    if (metadata || patientId || documentId) {
      const docMetadata = {
        ...metadata,
        ...(patientId ? { patient_id: patientId } : {}),
        ...(documentId ? { document_id: documentId } : {}),
        ingested_at: new Date().toISOString(),
        ingested_by: user.id
      };
      
      splitDocuments.forEach((doc, index) => {
        doc.metadata = {
          ...doc.metadata,
          ...docMetadata,
          chunk_index: index
        };
      });
      
      moduleLogger.info('Added metadata to document chunks', { 
        metadataFields: Object.keys(docMetadata).join(', ')
      });
    }
    
    // Create embeddings and store in vector database
    moduleLogger.info('Creating vector embeddings', {
      chunkCount: splitDocuments.length
    });
    
    try {
      const embeddings = new OpenAIEmbeddings();
      const vectorstore = await SupabaseVectorStore.fromDocuments(
        splitDocuments,
        embeddings,
        {
          client,
          tableName: 'documents',
          queryName: 'match_documents',
        }
      );

      moduleLogger.info('Vector embeddings created successfully', {
        chunkCount: splitDocuments.length
      });
    } catch (embeddingError) {
      moduleLogger.error('Failed to create embeddings', {
        chunkCount: splitDocuments.length
      }, embeddingError);
      
      throw new ExternalServiceError({
        message: 'Failed to create vector embeddings',
        service: 'OpenAI',
        code: 'EMBEDDING_CREATION_FAILED',
        cause: embeddingError
      });
    }

    moduleLogger.info('Document ingestion completed successfully', {
      chunkCount: splitDocuments.length,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    return apiSuccess({ 
      embeddings: splitDocuments.map((doc, index) => ({
        id: `chunk-${index}`,
        chunkIndex: index,
        metadata: doc.metadata
      })),
      count: splitDocuments.length,
      processingTimeMs: Date.now() - (req.headers.get('x-request-start') ? 
        parseInt(req.headers.get('x-request-start') || '0') : 0)
    });
  } catch (error) {
    moduleLogger.error('Failed to ingest document', {
      textLength: text?.length,
      userId: user?.id
    }, error);
    
    // Rethrow if it's already an ApplicationError
    if (error instanceof ExternalServiceError ||
        error instanceof SystemError ||
        error instanceof ValidationError) {
      throw error;
    }
    
    throw new ExternalServiceError({
      message: 'Failed to ingest document',
      service: 'Supabase Vector Store',
      code: 'INGEST_FAILED',
      cause: error
    });
  }
}, {
  openApiPath: '/retrieval/ingest',
  method: 'post',
  validate: true,
  logMetadata: { endpoint: '/api/retrieval/ingest' }
});