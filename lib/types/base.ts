/**
 * Base type definitions used throughout the application
 * These types serve as the foundation for the type system
 */

/**
 * Type alias for UUID strings
 * Used for consistency in typing IDs
 */
export type UUID = string;

/**
 * Type alias for ISO8601 timestamp strings
 * Used for consistency in typing dates
 */
export type Timestamp = string;

/**
 * Base entity with common fields
 * This is the foundation for most database-backed entities
 */
export interface BaseEntity {
  /** Unique identifier for the entity */
  id: UUID;
  /** When the entity was created */
  createdAt: Timestamp;
  /** When the entity was last updated */
  updatedAt: Timestamp;
}

/**
 * Entity owned by an organization and user
 * Extends BaseEntity with ownership fields
 */
export interface OwnedEntity extends BaseEntity {
  /** Organization that owns this entity */
  organizationId: UUID;
  /** User that owns this entity */
  userId: UUID;
}

/**
 * Utility to convert ISO string to Date
 * @param isoString - ISO8601 timestamp string
 * @returns Date object
 */
export function toDate(isoString: Timestamp | null | undefined): Date | null {
  if (!isoString) return null;
  return new Date(isoString);
}

/**
 * Utility to convert Date to ISO string
 * @param date - Date object or timestamp number
 * @returns ISO8601 timestamp string
 */
export function toISOString(date: Date | number | null | undefined): Timestamp | null {
  if (!date) return null;
  return new Date(date).toISOString();
}

/**
 * Type guard for checking if a value is a UUID
 * @param value - Value to check
 * @returns True if the value is a valid UUID
 */
export function isUUID(value: unknown): value is UUID {
  if (typeof value !== 'string') return false;
  
  // Basic UUID validation (not exhaustive)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard for checking if a value is a Timestamp
 * @param value - Value to check
 * @returns True if the value is a valid ISO8601 timestamp
 */
export function isTimestamp(value: unknown): value is Timestamp {
  if (typeof value !== 'string') return false;
  
  // Check if string can be parsed as a valid date
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
}