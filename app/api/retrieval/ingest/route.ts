import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'
import { OpenAIEmbeddings } from '@langchain/openai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, withErrorHandling, getRequestId } from '@/lib/api-response'
import { 
  ExternalServiceError, 
  ValidationError, 
  AuthenticationError,
  SystemError 
} from '@/lib/errors'
import logger from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/clients'

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
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
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
    
    // Parse request body
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
    
    // Validate request parameters
    const text = body.text;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      moduleLogger.warn('Missing or empty text in request body');
      throw new ValidationError({
        message: 'Text is required and must be a non-empty string',
        code: 'MISSING_TEXT',
        fields: { text: 'Required non-empty string' }
      });
    }

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
        chunkSize: 256,
        chunkOverlap: 20,
      });

      moduleLogger.info('Splitting document into chunks');
      
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
        ok: true,
        chunks: splitDocuments.length,
        message: 'Document successfully ingested into vector store'
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
    logMetadata: { endpoint: '/api/retrieval/ingest' }
  });
}