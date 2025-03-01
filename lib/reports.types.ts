import type { Database } from './supabase'

// Report types
export type Report = Database['public']['Tables']['reports']['Row']
export type ReportInsert = Database['public']['Tables']['reports']['Insert']
export type ReportUpdate = Database['public']['Tables']['reports']['Update']

// Audit Log types for reports
export type ReportAuditLog =
  Database['public']['Tables']['report_audit_logs']['Row']
export type ReportAuditLogInsert =
  Database['public']['Tables']['report_audit_logs']['Insert']
export type ReportAuditLogUpdate =
  Database['public']['Tables']['report_audit_logs']['Update']

// Additional helper types
export type ReportStatus = Report['status'] // 'processing' | 'completed' | 'failed'
export type ReportType = Report['type'] // 'diagnostic' | 'progress' | 'analytics'
