import type { Application, Status, TimelineEvent } from '../types/application'
import type { getMetrics, activityData } from '../utils/applications'
import type { PageResult } from './career'

export interface ApplicationPage extends PageResult<Application> { current: number; archived: number; statuses: Record<Status, number>; locations: string[]; tags: string[] }
type Basic = Pick<Application, 'id' | 'company' | 'position' | 'dateApplied' | 'status'>
export interface Overview {
  metrics: ReturnType<typeof getMetrics>; statuses: Record<Status, number>; currentStatuses: Record<Status, number>; current: number
  weekly: ReturnType<typeof activityData>; monthly: ReturnType<typeof activityData>
  breakdown: Record<'location' | 'employmentType' | 'source', { label: string; count: number; percent: number }[]>
  responseCount: number; responseAverage: number | null; savedCount: number; deadlines: number; dueToday: number
  recent: Basic[]; followups: (Basic & { followUpDate: string })[]
  upcoming: { id: string; company: string; position: string; interviewId: string; interviewDate: string; interviewType: string }[]
  activity: { app: { id: string; company: string }; event: TimelineEvent }[]
}
