export interface TrendPoint {
  date: string
  value: number
}

export interface PatientDistribution {
  status: string
  count: number
  color: string
}

export interface Appointment {
  id: string
  patientName: string
  type: string
  date: string
  status: 'upcoming' | 'completed' | 'cancelled'
  analysisData?: DocumentAnalysis
}

export interface DocumentAnalysis {
  patientName: string
  symptoms: string[]
  diagnosis?: string
  extractedData: Record<string, string>
}

export type NotificationType = 'alert' | 'update' | 'reminder' | 'message'
export type NotificationPriority = 'high' | 'medium' | 'low'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  priority: NotificationPriority
  read: boolean
  actionUrl?: string
  relatedTo?: {
    type: 'patient' | 'report' | 'scan'
    id: string
    name: string
  }
}

// (No mock data exported; live data will be fetched from API endpoints)
export const mockTrendData: Record<string, TrendPoint[]> = []
export const mockPatientDistribution: PatientDistribution[] = []
export const mockAppointments: Appointment[] = []
export const mockNotifications: Notification[] = []
