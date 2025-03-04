/**
 * Supabase Types - Single Source of Truth
 * 
 * This file serves as the central definition for all database-related types.
 * It exports database types and provides mappings to domain models.
 */

import type { Database } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// ==========================================================================
// Core Type Definitions
// ==========================================================================

/**
 * Typed Supabase Client with our Database schema
 */
export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Database schema type from Supabase
 */
export type { Database } from '@/lib/supabase'

/**
 * JSON type from Supabase
 */
export type { Json } from '@/lib/supabase'

/**
 * Generic table type from the Database
 */
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

// ==========================================================================
// Table Row Types
// ==========================================================================

/**
 * Helper type to extract row data from Database tables
 */
export type TableRow<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

/**
 * Helper type to extract insert data format from Database tables
 */
export type TableInsert<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert']

/**
 * Helper type to extract update data format from Database tables
 */
export type TableUpdate<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update']

// ==========================================================================
// Direct Enum Exports
// ==========================================================================

/**
 * Document category enum from database
 */
export type DocumentCategory = Database['public']['Enums']['document_category']

/**
 * Workflow step enum from database
 */
export type DbWorkflowStep = Database['public']['Enums']['workflow_step']

/**
 * Access level enum from database
 */
export type AccessLevel = Database['public']['Enums']['access_level']

/**
 * Medical role enum from database
 */
export type MedicalRole = Database['public']['Enums']['medical_role']

/**
 * Patient status enum from database
 */
export type PatientStatus = Database['public']['Enums']['patient_status']

/**
 * Continent enum from database
 */
export type Continent = Database['public']['Enums']['continents']

// ==========================================================================
// Common Type Utilities 
// ==========================================================================

/**
 * Timestamp type for consistent date/time handling
 * Accepts ISO string or Date object
 */
export type Timestamp = string | Date

/**
 * UUID type for consistent ID handling
 */
export type UUID = string

/**
 * Standardized resource type for permissions
 */
export type ResourceType = 
  | 'patient'
  | 'document'
  | 'report'
  | 'chat'
  | 'verification'
  | 'department'
  | 'research'

/**
 * Base entity interface with common properties
 */
export interface BaseEntity {
  id: UUID
  created_at?: Timestamp
  updated_at?: Timestamp
}

/**
 * Base entity with ownership information
 */
export interface OwnedEntity extends BaseEntity {
  created_by?: UUID
  updated_by?: UUID
  last_modified_by?: UUID
}

/**
 * Helper to convert Timestamp to Date
 */
export const toDate = (timestamp?: Timestamp): Date | undefined => {
  if (!timestamp) return undefined
  return typeof timestamp === 'string' ? new Date(timestamp) : timestamp
}

/**
 * Helper to convert Date to ISO string
 */
export const toISOString = (date?: Timestamp): string | undefined => {
  if (!date) return undefined
  return typeof date === 'string' ? date : date.toISOString()
}
