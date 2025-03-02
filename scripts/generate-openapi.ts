/**
 * Script to generate OpenAPI specification
 * 
 * This script exports the OpenAPI specification to a JSON file
 * and also optionally generates TypeScript types from the spec.
 */
import path from 'path'
import { exportOpenAPIToFile } from '../lib/api/openapi-export'

// Import to ensure all paths are registered
import '../lib/api/openapi/paths'

// Output paths
const outputDir = path.resolve(__dirname, '../public/openapi')
const outputPath = path.join(outputDir, 'openapi.json')

/**
 * Generate OpenAPI specification
 */
function generateOpenAPI() {
  console.log('Generating OpenAPI specification...')
  
  try {
    // Export OpenAPI spec to JSON file
    exportOpenAPIToFile(outputPath)
    console.log(`OpenAPI specification generated successfully at ${outputPath}`)
    
    // Could add TypeScript generation here if needed
    // generateTypeScript()
    
    console.log('OpenAPI generation completed successfully')
  } catch (error) {
    console.error('Error generating OpenAPI specification:', error)
    process.exit(1)
  }
}

/**
 * Run the generator
 */
generateOpenAPI()