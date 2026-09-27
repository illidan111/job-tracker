import type { Application } from '../types/application'
import { dateKey, formatDate } from './dates'
export type Opportunity = Application & { nextTask?: { id: string; title: string; dueDate: string; priority: string } }
export function nextAction(app: Opportunity, now = new Date()) {
  const href = `/applications/${app.id}`
  if (app.archivedAt) return { title: 'Filed for reference', detail: 'Archived', href, urgent: false }
  const today = dateKey(now)
  if (app.followUpDate && !app.followUpCompletedAt && app.followUpDate <= today) return { title: app.followUpReason || 'Follow up', detail: app.followUpDate < today ? 'Overdue' : 'Due today', href, urgent: true }
  const task = app.nextTask
  if (task?.dueDate && task.dueDate <= today) return { title: task.title, detail: task.priority === 'HIGH' ? 'High priority' : 'Task due', href: `/tasks?task=${task.id}`, urgent: true }
  const interview = app.interviews.find(item => item.outcome === 'Scheduled' && Date.parse(item.scheduledAt) >= now.getTime())
  if (interview) return { title: 'Prepare for interview', detail: formatDate(interview.scheduledAt.slice(0, 10)), href: href + '?interview=' + interview.id, urgent: false }
  if (task) return { title: task.title, detail: task.priority === 'HIGH' ? 'High priority' : 'Your next step', href: `/tasks?task=${task.id}`, urgent: false }
  if (app.followUpDate && !app.followUpCompletedAt) return { title: app.followUpReason || 'Follow up', detail: formatDate(app.followUpDate), href, urgent: false }
  return { title: app.status === 'OFFER' ? 'Review your offer' : app.status === 'REJECTED' ? 'Reflect and move forward' : 'Waiting for a response', detail: 'Define a next step', href: href + '?tab=tasks', urgent: false }
}
