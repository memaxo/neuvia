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
  status: "upcoming" | "completed" | "cancelled"
}

export type NotificationType = "alert" | "update" | "reminder" | "message"
export type NotificationPriority = "high" | "medium" | "low"

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
    type: "patient" | "report" | "scan"
    id: string
    name: string
  }
}

// Mock data for visualizations
export const mockTrendData: Record<string, TrendPoint[]> = {
  "total-patients": Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
    value: 1200 + Math.floor(Math.random() * 50)
  })),
  "pending-uploads": Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
    value: 3 + Math.floor(Math.random() * 4)
  })),
  "high-risk": Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
    value: 10 + Math.floor(Math.random() * 5)
  }))
}

export const mockPatientDistribution: PatientDistribution[] = [
  { status: "Healthy", count: 850, color: "rgb(74, 222, 128)" },
  { status: "At Risk", count: 250, color: "rgb(251, 146, 60)" },
  { status: "High Risk", count: 134, color: "rgb(248, 113, 113)" }
]

export const mockAppointments: Appointment[] = [
  {
    id: "1",
    patientName: "Jane Smith",
    type: "Check-up",
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: "upcoming"
  },
  {
    id: "2",
    patientName: "John Doe",
    type: "Scan Review",
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: "upcoming"
  },
  {
    id: "3",
    patientName: "Alice Johnson",
    type: "Follow-up",
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    status: "upcoming"
  }
]

export const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "alert",
    title: "High Risk Patient Alert",
    message: "John Smith's risk level has increased significantly",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    priority: "high",
    read: false,
    relatedTo: {
      type: "patient",
      id: "2",
      name: "John Smith"
    }
  },
  {
    id: "2",
    type: "update",
    title: "Scan Analysis Complete",
    message: "New scan results available for Jane Doe",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    priority: "medium",
    read: false,
    relatedTo: {
      type: "scan",
      id: "123",
      name: "Brain MRI"
    }
  },
  {
    id: "3",
    type: "reminder",
    title: "Upcoming Appointment",
    message: "Follow-up appointment with Alice Johnson tomorrow",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    priority: "medium",
    read: true,
    actionUrl: "/dashboard/appointments"
  },
  {
    id: "4",
    type: "message",
    title: "New Message from Dr. Wilson",
    message: "Review requested for recent patient report",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    priority: "low",
    read: true
  }
] 