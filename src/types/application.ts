export const STATUSES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED'] as const
export type Status = (typeof STATUSES)[number]
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]
export const WORK_MODES = ['Not specified', 'Remote', 'Hybrid', 'Onsite'] as const
export type WorkMode = (typeof WORK_MODES)[number]
export const INTERVIEW_TYPES = ['Phone', 'Video', 'Technical', 'Behavioral', 'Onsite'] as const
export const INTERVIEW_OUTCOMES = ['Scheduled', 'Completed', 'Next round', 'Not moving forward', 'Cancelled'] as const
export const EVENT_TYPES = ['created', 'updated', 'status', 'contact', 'interview_scheduled', 'interview_updated', 'interview_completed', 'interview_cancelled', 'interview_deleted', 'followup_scheduled', 'followup_completed'] as const

export interface Contact {
  id: string
  name: string
  email: string
  company: string
  role: string
  linkedInUrl: string
  notes: string
  version: number
  createdAt: string
  updatedAt: string
}
export type ContactInput = Omit<Contact, 'id' | 'version' | 'createdAt' | 'updatedAt'>

export interface Interview {
  id: string
  scheduledAt: string
  type: (typeof INTERVIEW_TYPES)[number]
  interviewer: string
  meetingUrl: string
  notes: string
  outcome: (typeof INTERVIEW_OUTCOMES)[number]
  createdAt: string
  updatedAt: string
}
export type InterviewInput = Omit<Interview, 'id' | 'createdAt' | 'updatedAt'>

export interface Notification {
  id: string
  applicationId: string
  kind: 'interview' | 'followup'
  title: string
  message: string
  dueAt: string
  readAt: string | null
}

export interface AuthUser { id: string; email: string }
export interface Workspace {
  user: AuthUser
  profile: Profile
  applications: Application[]
  contacts: Contact[]
  notifications: Notification[]
}

export interface TimelineEvent {
  id: string
  type: (typeof EVENT_TYPES)[number]
  at: string
  status?: Status
  description?: string
}

export interface Application {
  id: string
  company: string
  position: string
  location: string
  salary?: number
  employmentType: EmploymentType
  status: Status
  dateApplied: string
  jobUrl: string
  recruiter: string
  recruiterEmail: string
  interviewDate: string
  notes: string
  tags: string[]
  createdAt: string
  updatedAt: string
  timeline: TimelineEvent[]
  version: number
  workMode: WorkMode
  followUpDate: string
  followUpCompletedAt: string
  contacts: Contact[]
  interviews: Interview[]
}

export type ApplicationInput = Omit<Application, 'id' | 'createdAt' | 'updatedAt' | 'timeline' | 'version' | 'contacts' | 'interviews' | 'followUpCompletedAt'>

export interface Profile {
  name: string
  email: string
  headline: string
  weeklyGoal: number
  appearance: 'light' | 'dark' | 'system'
  interviewReminders: boolean
}

export const STATUS_META: Record<Status, { label: string; color: string; className: string }> = {
  APPLIED: { label: 'Applied', color: '#6481b8', className: 'applied' },
  SCREENING: { label: 'Screening', color: '#bf944b', className: 'screening' },
  INTERVIEW: { label: 'Interview', color: '#9280bc', className: 'interview' },
  OFFER: { label: 'Offer', color: '#3b8969', className: 'offer' },
  REJECTED: { label: 'Rejected', color: '#bd7b7b', className: 'rejected' },
}
