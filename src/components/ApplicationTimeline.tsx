import { useState } from 'react'
import { Check, Clock3 } from 'lucide-react'
import type { PageResult } from '../domain/career'
import { STATUS_META, type TimelineEvent } from '../types/application'
import { useResource } from '../hooks/useResource'
import { eventLabel } from '../utils/timeline'
import { formatDateTime } from '../utils/dates'
import { Pagination } from './ui/Pagination'
import { RemoteState } from './ui/RemoteState'
export function ApplicationTimeline({ applicationId }: { applicationId: string }) {
  const [page, setPage] = useState(1)
  const resource = useResource<PageResult<TimelineEvent>>(`/applications/${applicationId}/activity?page=${page}`)
  return <section className="panel"><div className="panel-heading"><div><h2>Timeline</h2></div><Clock3 size={18} className="muted" /></div><RemoteState {...resource} />{resource.data && <><ol className="timeline">{resource.data.items.map((event, index) => <li key={event.id}><span className={`timeline-dot ${index === 0 ? 'latest' : ''}`}><Check size={12} /></span><div><strong>{eventLabel(event)}</strong><p>{formatDateTime(event.at)}{event.type === 'created' && event.status ? ` · ${STATUS_META[event.status].label}` : ''}</p></div></li>)}</ol><Pagination result={resource.data} onPage={setPage} /></>}</section>
}
