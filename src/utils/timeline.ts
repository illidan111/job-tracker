import type { TimelineEvent } from '../types/application'
import { STATUS_META } from '../types/application'
const labels: Record<TimelineEvent['type'], string> = {
  created: 'Application added', updated: 'Application details updated', status: 'Status updated', contact: 'Contact updated',
  interview_scheduled: 'Interview scheduled', interview_updated: 'Interview updated', interview_completed: 'Interview completed', interview_cancelled: 'Interview cancelled', interview_deleted: 'Interview removed',
  followup_scheduled: 'Follow-up scheduled', followup_completed: 'Follow-up completed',
  task_created: 'Task created', task_completed: 'Task completed', task_updated: 'Task updated', note_added: 'Note added', note_updated: 'Note updated', note_deleted: 'Note deleted', materials_updated: 'Application materials updated', preparation_updated: 'Interview preparation updated',
}
export function eventLabel(event: TimelineEvent) {
  return event.type === 'status' && event.status ? `Moved to ${STATUS_META[event.status].label}` : event.description || labels[event.type]
}
