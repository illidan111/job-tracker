import type { Application, ApplicationSource, EmploymentType, Status, WorkMode } from '../types/application'
import { daysAgo, dateKey, parseDate, startOfWeek } from './dates'

export interface Filters {
  search: string; status: Status | ''; location: string; employmentType: EmploymentType | ''
  minSalary: string; maxSalary: string; from: string; to: string; tag: string; workMode: WorkMode | ''; source: ApplicationSource | ''
}
export const emptyFilters: Filters = { search: '', status: '', location: '', employmentType: '', minSalary: '', maxSalary: '', from: '', to: '', tag: '', workMode: '', source: '' }
export type SortKey = 'newest' | 'oldest' | 'company' | 'salary'

export function filterApplications(applications: Application[], filters: Filters, sort: SortKey = 'newest') {
  const query = filters.search.trim().toLowerCase()
  return applications.filter(app =>
    (!query || [app.company, app.position, app.location, app.recruiter, app.notes, ...app.contacts.map(contact => contact.name), ...app.tags].join(' ').toLowerCase().includes(query)) &&
    (!filters.status || app.status === filters.status) &&
    (!filters.location || app.location === filters.location) &&
    (!filters.employmentType || app.employmentType === filters.employmentType) &&
    (!filters.workMode || app.workMode === filters.workMode) &&
    (!filters.source || app.source === filters.source) &&
    (!filters.tag || app.tags.some(tag => tag.toLowerCase() === filters.tag.toLowerCase())) &&
    (!filters.minSalary || (app.salary !== undefined && app.salary >= Number(filters.minSalary))) &&
    (!filters.maxSalary || (app.salary !== undefined && app.salary <= Number(filters.maxSalary))) &&
    (!filters.from || app.dateApplied >= filters.from) &&
    (!filters.to || app.dateApplied <= filters.to),
  ).sort((a, b) => sort === 'company' ? a.company.localeCompare(b.company)
    : sort === 'salary' ? (b.salary ?? -1) - (a.salary ?? -1)
    : sort === 'oldest' ? a.dateApplied.localeCompare(b.dateApplied) : b.dateApplied.localeCompare(a.dateApplied))
}

export function hasReached(app: Application, status: 'INTERVIEW' | 'OFFER') {
  return app.status === status || (status === 'INTERVIEW' && (app.status === 'OFFER' || app.interviews.some(interview => interview.outcome !== 'Cancelled'))) || app.timeline.some(event => event.status === status || (status === 'INTERVIEW' && (event.status === 'OFFER' || event.type === 'interview_completed')))
}

export function getMetrics(applications: Application[]) {
  const total = applications.length
  const interviews = applications.filter(app => hasReached(app, 'INTERVIEW')).length
  const offers = applications.filter(app => hasReached(app, 'OFFER')).length
  const today = dateKey()
  const thisMonth = applications.filter(app => app.dateApplied.slice(0, 7) === today.slice(0, 7) && app.dateApplied <= today).length
  return {
    total, interviews, offers, thisMonth,
    active: applications.filter(app => !app.archivedAt && !['OFFER', 'REJECTED'].includes(app.status)).length,
    rejectionRate: total ? Math.round(applications.filter(app => app.status === 'REJECTED').length / total * 100) : 0,
    rejections: applications.filter(app => app.status === 'REJECTED').length,
    thisWeek: applications.filter(app => app.dateApplied >= startOfWeek() && app.dateApplied <= dateKey()).length,
    interviewRate: total ? Math.round(interviews / total * 100) : 0,
    offerRate: total ? Math.round(offers / total * 100) : 0,
  }
}

export function activityData(applications: Application[], period: 'weekly' | 'monthly') {
  return Array.from({ length: period === 'weekly' ? 8 : 6 }, (_, index) => {
    const start = parseDate(period === 'weekly' ? daysAgo((7 - index) * 7 + 6) : dateKey(new Date(new Date().getFullYear(), new Date().getMonth() - (5 - index), 1)))
    const end = new Date(start)
    if (period === 'weekly') end.setDate(end.getDate() + 6)
    else end.setMonth(end.getMonth() + 1, 0)
    return {
      label: start.toLocaleDateString('en-US', period === 'weekly' ? { month: 'short', day: 'numeric' } : { month: 'short' }),
      applications: applications.filter(app => app.dateApplied >= dateKey(start) && app.dateApplied <= dateKey(end)).length,
    }
  })
}

export function upcomingInterviews(applications: Application[]) {
  return applications.flatMap(app => app.interviews.filter(item => item.outcome === 'Scheduled' && new Date(item.scheduledAt) >= new Date()).map(item => ({ ...app, interviewDate: item.scheduledAt, interviewId: item.id, interviewType: item.type })))
    .sort((a, b) => Date.parse(a.interviewDate) - Date.parse(b.interviewDate))
}

export function upcomingFollowUps(applications: Application[]) {
  return applications.filter(app => app.followUpDate && !app.followUpCompletedAt).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))
}

export function formatSalary(salary?: number) {
  return salary === undefined ? 'Not specified' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(salary)
}
