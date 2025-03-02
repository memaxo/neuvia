import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'
import { OpenAIEmbeddings } from '@langchain/openai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { apiError, apiSuccess, withErrorHandling } from '@/lib/api-response'
import { ExternalServiceError, ValidationError } from '@/lib/errors'
import logger from '@/lib/logger'

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
    const moduleLogger = logger.withMetadata({
      module: 'RetrievalIngest',
      method: 'POST',
      requestId: req.headers.get('x-request-id')
    })
    
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
    
    const text = body.text;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      moduleLogger.warn('Missing or empty text in request body');
      throw new ValidationError({
        message: 'Text is required and must be a non-empty string',
        code: 'MISSING_TEXT'
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
        textLength: text.length
      });
      
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PRIVATE_KEY!
      );

      const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
        chunkSize: 256,
        chunkOverlap: 20,
      });

      moduleLogger.info('Splitting document into chunks');
      const splitDocuments = await splitter.createDocuments([text]);
      
      moduleLogger.info('Creating vector embeddings', {
        chunkCount: splitDocuments.length
      });
      
      const vectorstore = await SupabaseVectorStore.fromDocuments(
        splitDocuments,
        new OpenAIEmbeddings(),
        {
          client,
          tableName: 'documents',
          queryName: 'match_documents',
        }
      );

      moduleLogger.info('Document ingestion completed successfully', {
        chunkCount: splitDocuments.length
      });

      return apiSuccess({ 
        ok: true,
        chunks: splitDocuments.length
      });
    } catch (error) {
      moduleLogger.error('Failed to ingest document', {
        textLength: text?.length
      }, error);
      
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
