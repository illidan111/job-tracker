import { Link } from 'react-router-dom'
import type { Application } from '../types/application'
import { eventLabel } from '../utils/timeline'
import { formatDateTime } from '../utils/dates'
import { CompanyMark } from './CompanyMark'
export function RecentActivity({ applications }: { applications: Application[] }) {
  const events = applications.flatMap(app => app.timeline.map(event => ({ app, event }))).sort((a, b) => b.event.at.localeCompare(a.event.at)).slice(0, 5)
  return <div className="activity-feed">{events.length ? events.map(({ app, event }) => <Link to={`/applications/${app.id}`} key={event.id}><CompanyMark company={app.company} small /><div><strong>{app.company}</strong><p>{eventLabel(event)}</p><small>{formatDateTime(event.at)}</small></div></Link>) : <div className="small-empty"><p>Your activity will appear as you take the next step.</p></div>}</div>
}
