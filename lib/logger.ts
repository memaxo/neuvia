/**
 * Centralized logging system for Neuvia application
 * Handles structured logging, environment-specific behavior, and integration points
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogMetadata {
  module?: string
  component?: string
  userId?: string
  requestId?: string
  [key: string]: any
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  metadata?: LogMetadata
  error?: Error | unknown
}

/**
 * Format an error object for logging
 */
function formatError(error: unknown): Record<string, any> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      cause: error.cause ? formatError(error.cause) : undefined,
      ...(error as any).data,
    }
  }
  
  return { error }
}

/**
 * Core logging function
 */
function logMessage(level: LogLevel, message: string, metadata?: LogMetadata, error?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  }

  if (error) {
    entry.error = formatError(error)
  }

  // Development: Console output with formatting
  if (process.env.NODE_ENV === 'development') {
    const console_method = level === 'debug' ? console.debug 
      : level === 'info' ? console.info
      : level === 'warn' ? console.warn
      : console.error

    console_method(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, 
      metadata ? { metadata } : '',
      error ? entry.error : '')
    return
  }

  // Production: Structured logging
  if (process.env.NODE_ENV === 'production') {
    // Structured JSON for log aggregation systems
    console.log(JSON.stringify(entry))

    // Here you would add integrations with external logging services
    // Examples: 
    // - sendToLogDrain(entry)
    // - logToNewRelic(entry)
    // - sentryCapture(level, message, metadata, error)
  }
}

const logger = {
  debug: (message: string, metadata?: LogMetadata) => 
    logMessage('debug', message, metadata),
  
  info: (message: string, metadata?: LogMetadata) => 
    logMessage('info', message, metadata),
  
  warn: (message: string, metadata?: LogMetadata, error?: unknown) => 
    logMessage('warn', message, metadata, error),
  
  error: (message: string, metadata?: LogMetadata, error?: unknown) => 
    logMessage('error', message, metadata, error),
  
  fatal: (message: string, metadata?: LogMetadata, error?: unknown) => 
    logMessage('fatal', message, metadata, error),

  // Create a logger with default metadata (useful for components/modules)
  withMetadata: (defaultMetadata: LogMetadata) => ({
    debug: (message: string, metadata?: LogMetadata) => 
      logMessage('debug', message, { ...defaultMetadata, ...metadata }),
    
    info: (message: string, metadata?: LogMetadata) => 
      logMessage('info', message, { ...defaultMetadata, ...metadata }),
    
    warn: (message: string, metadata?: LogMetadata, error?: unknown) => 
      logMessage('warn', message, { ...defaultMetadata, ...metadata }, error),
    
    error: (message: string, metadata?: LogMetadata, error?: unknown) => 
      logMessage('error', message, { ...defaultMetadata, ...metadata }, error),
    
    fatal: (message: string, metadata?: LogMetadata, error?: unknown) => 
      logMessage('fatal', message, { ...defaultMetadata, ...metadata }, error),
  })
}

export default logger