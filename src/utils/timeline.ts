import type { TimelineEvent } from '../types/application'
import { STATUS_META } from '../types/application'
const labels: Record<TimelineEvent['type'], string> = {
  created: 'Application added', updated: 'Application details updated', status: 'Status updated', contact: 'Contact updated',
  interview_scheduled: 'Interview scheduled', interview_updated: 'Interview updated', interview_completed: 'Interview completed', interview_cancelled: 'Interview cancelled', interview_deleted: 'Interview removed',
  followup_scheduled: 'Follow-up scheduled', followup_completed: 'Follow-up completed',
}
export function eventLabel(event: TimelineEvent) {
  return event.type === 'status' && event.status ? `Moved to ${STATUS_META[event.status].label}` : event.description || labels[event.type]
}
