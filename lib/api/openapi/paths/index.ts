/**
 * OpenAPI path definitions index
 * 
 * This file exports all API path definitions and registers them with the OpenAPI schema
 */
import { openAPISpec, registerPath } from '../index'
import { sendEmailPath } from './send'
import { verificationPaths } from './verification'
import { researchPaths } from './research'
import { authPaths } from './auth'
import { securityPaths } from './security'
import { reportPaths } from './reports'
import { chatPaths } from './chat'
import { patientPaths } from './patient'

/**
 * Register all API paths with the OpenAPI schema
 */
export function registerAllPaths(): void {
  // Register each path in the schema
  Object.entries(sendEmailPath).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
  
  Object.entries(verificationPaths).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
  
  Object.entries(researchPaths).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
  
  Object.entries(authPaths).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
  
  Object.entries(securityPaths).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
  
  Object.entries(reportPaths).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
  
  Object.entries(chatPaths).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
  
  Object.entries(patientPaths).forEach(([path, pathItem]) => {
    registerPath(path, pathItem)
  })
}

// Register all paths when this module is imported
registerAllPaths()

/**
 * Export all path definitions
 */
export const allPaths = {
  ...sendEmailPath,
  ...verificationPaths,
  ...researchPaths,
  ...authPaths,
  ...securityPaths,
  ...reportPaths,
  ...chatPaths,
  ...patientPaths
}