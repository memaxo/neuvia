/**
 * Ajv (Another JSON Validator) configuration
 * 
 * This file configures Ajv for JSON Schema validation of API requests and responses
 */
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

/**
 * Create and configure Ajv instance
 */
export const ajv = new Ajv({
  allErrors: true,  // Return all errors, not just the first
  removeAdditional: false,  // Don't remove additional properties
  useDefaults: true,  // Use default values defined in the schema
  coerceTypes: true,  // Convert values to correct types when possible
  strict: false,  // Don't report errors for ambiguous schemas
})

// Add formats for date, time, email, uuid, etc.
addFormats(ajv, {
  formats: [
    'date',
    'date-time',
    'time',
    'email',
    'uuid',
    'uri',
    'url',
    'byte',
    'hostname',
    'ipv4',
    'ipv6'
  ]
})

// Add custom formats if needed
ajv.addFormat('phone', /^\+?[1-9]\d{1,14}$/)

// Add custom keywords if needed
ajv.addKeyword({
  keyword: 'isNotEmpty',
  type: 'string',
  validate: (schema: boolean, data: string) => {
    return schema === false || data.trim().length > 0
  },
  errors: false
})

/**
 * Validate data against a JSON schema
 * @param schema JSON schema to validate against
 * @param data Data to validate
 * @returns Validation result with errors if any
 */
export function validateSchema(
  schema: object,
  data: unknown
): { valid: boolean; errors: any[] | null } {
  const validate = ajv.compile(schema)
  const valid = validate(data)
  
  return {
    valid,
    errors: validate.errors || null
  }
}