/**
 * Simple script to generate the OpenAPI spec file
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to openapi.json
const OPENAPI_PATH = path.join(__dirname, '../public/openapi/openapi.json');

// Make directory if it doesn't exist
const openApiDir = path.dirname(OPENAPI_PATH);
if (!fs.existsSync(openApiDir)) {
  fs.mkdirSync(openApiDir, { recursive: true });
}

// Import the spec and save it to file
try {
  // Execute next.js app to get the OpenAPI spec
  const spec = execSync('node -e "console.log(JSON.stringify(require(\'../lib/api/openapi\').getOpenAPISpecAsJSON()))"', {
    cwd: __dirname,
    encoding: 'utf8'
  });
  
  // Write the spec to file
  fs.writeFileSync(OPENAPI_PATH, spec);
  
  console.log(`OpenAPI spec generated at ${OPENAPI_PATH}`);
} catch (error) {
  console.error('Error generating OpenAPI spec:', error);
  process.exit(1);
}