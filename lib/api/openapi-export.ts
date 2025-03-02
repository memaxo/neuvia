/**
 * OpenAPI Specification Export
 * 
 * This file provides utilities for exporting the OpenAPI specification
 * to different formats and for serving it via an API endpoint.
 */
import { openAPISpec, getOpenAPISpecAsJSON } from './openapi'
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

/**
 * Export the OpenAPI spec to a JSON file
 * @param outputPath Path to write the OpenAPI JSON spec
 */
export function exportOpenAPIToFile(outputPath: string): void {
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  fs.writeFileSync(outputPath, getOpenAPISpecAsJSON())
  console.log(`OpenAPI spec exported to ${outputPath}`)
}

/**
 * Create a Next.js route handler for serving the OpenAPI spec
 * This can be used in an API route file
 */
export function createOpenAPIRoute() {
  return function handler(req: NextRequest): NextResponse {
    // Allow both JSON and YAML format based on Accept header or format query param
    const format = req.nextUrl.searchParams.get('format') || 'json'
    const acceptHeader = req.headers.get('accept')
    
    if (format === 'json' || acceptHeader?.includes('application/json')) {
      return NextResponse.json(openAPISpec, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=3600, public'
        }
      })
    } else {
      // For now, we only support JSON
      return NextResponse.json(openAPISpec, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=3600, public'
        }
      })
    }
  }
}

/**
 * Get HTML for Swagger UI to display the OpenAPI spec
 * @param specUrl URL to the OpenAPI spec JSON
 */
export function getSwaggerUIHtml(specUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Neuvia API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        withCredentials: true,
        requestInterceptor: (request) => {
          // Add any auth tokens or other request modifications here
          return request;
        }
      });
    };
  </script>
</body>
</html>
`
}

/**
 * Create a Next.js route handler for serving Swagger UI
 * This can be used in an API route file
 */
export function createSwaggerUIRoute(specUrl: string) {
  return function handler(): NextResponse {
    const html = getSwaggerUIHtml(specUrl)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'max-age=3600, public'
      }
    })
  }
}