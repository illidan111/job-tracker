import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate } from '../utils/dates'
import { nextAction } from '../utils/nextAction'
import type { Opportunity } from '../utils/nextAction'
import { CompanyMark } from './CompanyMark'
import { StatusBadge } from './StatusBadge'

export function ApplicationTable({ applications, compact = false, selected, onSelect, onSelectAll }: { applications: Opportunity[]; compact?: boolean; selected?: string[]; onSelect?: (id: string, checked: boolean) => void; onSelectAll?: (checked: boolean) => void }) {
  return <div className={`opportunity-list ${compact ? 'compact-opportunities' : ''}`}>
    <div className="opportunity-heading">{onSelect && <input type="checkbox" aria-label="Select all applications on this page" checked={applications.length > 0 && applications.every(app => selected?.includes(app.id))} onChange={event => onSelectAll?.(event.target.checked)} />}<span>Opportunity</span><span>Next move</span><span>Last activity</span></div>
    <ul>{applications.map(app => { const next = nextAction(app); return <li className={`opportunity-row ${onSelect ? 'selectable' : ''}`} key={app.id}>
      {onSelect && <input className="opportunity-select" type="checkbox" aria-label={`Select ${app.company} ${app.position}`} checked={Boolean(selected?.includes(app.id))} onChange={event => onSelect(app.id, event.target.checked)} />}
      <div className="opportunity-identity"><CompanyMark company={app.company} /><div><Link className="company-link" to={`/applications/${app.id}`}>{app.company}</Link><p>{app.position}</p><div className="opportunity-meta"><StatusBadge status={app.status} />{app.location && <span>{app.location}</span>}</div></div></div>
      <Link className={`opportunity-next ${next.urgent ? 'attention' : ''}`} to={next.href}><span>{next.title}</span><small>{next.detail}</small></Link>
      <div className="opportunity-updated"><time dateTime={app.updatedAt}>{formatDate(app.updatedAt.slice(0, 10))}</time><Link className="icon-button" to={`/applications/${app.id}`} aria-label={`View ${app.company} application`}><ArrowUpRight size={17} /></Link></div>
    </li> })}</ul>
  </div>
}
