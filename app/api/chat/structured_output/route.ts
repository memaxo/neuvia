/**
 * API Route: /api/chat/structured_output
 * 
 * Example endpoint demonstrating Zod Schema validation with typed responses
 */
import { NextRequest } from 'next/server'
import { withZodValidation } from '@/lib/api/middleware/zod-validation'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { isChatMessage } from '@/lib/types/chat'
import { ValidationError } from '@/lib/errors'

// Define schemas specific to this endpoint
const StructuredOutputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  outputFormat: z.enum(['json', 'markdown', 'text']).default('json'),
  maxItems: z.number().int().positive().max(50).default(10),
  includeMetadata: z.boolean().default(false)
})

type StructuredOutputRequest = z.infer<typeof StructuredOutputSchema>

/**
 * POST handler for structured output
 */
export async function POST(req: NextRequest) {
  return withZodValidation(StructuredOutputSchema)(req, async (data) => {
    try {
      // Process the validated data
      const { query, outputFormat, maxItems, includeMetadata } = data
      
      // Generate a response (simulated)
      const responseItems = Array.from({ length: Math.min(maxItems, 5) }, (_, i) => ({
        id: uuidv4(),
        title: `Result ${i+1} for "${query}"`,
        description: `This is a ${outputFormat} result for your query`,
        score: Math.random().toFixed(2),
        ...(includeMetadata ? {
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'structured_output_api',
            processingTime: Math.floor(Math.random() * 500)
          }
        } : {})
      }))
      
      // Create a message to validate
      const message = {
        id: uuidv4(),
        content: `Results for "${query}"`,
        role: 'assistant',
        createdAt: new Date().toISOString(),
        metadata: {
          isStructuredOutput: true,
          format: outputFormat,
          itemCount: responseItems.length
        }
      }
      
      // Validate with type guard
      if (!isChatMessage(message)) {
        throw new ValidationError({
          message: 'Invalid message structure',
          code: 'INVALID_MESSAGE'
        })
      }
      
      return Response.json({
        success: true,
        data: {
          message,
          results: responseItems,
          format: outputFormat,
          query
        }
      })
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json(
          { error: { message: error.message, code: error.code, data: error.data } },
          { status: error.statusCode }
        )
      }
      
      console.error('Error in structured output:', error)
      return Response.json(
        { error: { message: 'An error occurred', code: 'INTERNAL_ERROR' } },
        { status: 500 }
      )
    }
  })
}