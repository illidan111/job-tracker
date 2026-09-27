import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Application } from '../types/application'
import { formatDate } from '../utils/dates'
import { formatSalary } from '../utils/applications'
import { CompanyMark } from './CompanyMark'
import { StatusBadge } from './StatusBadge'

export function ApplicationTable({ applications, compact = false }: { applications: Application[]; compact?: boolean }) {
  return <div className={`table-wrap ${compact ? 'compact-table' : ''}`}><table className="application-table">
    <thead><tr><th scope="col">Company & role</th><th scope="col">Status</th><th scope="col" className="location-cell">Location</th>{!compact && <th scope="col" className="salary-cell">Salary <span className="salary-unit">· USD/yr</span></th>}<th scope="col" className="date-cell">Applied</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
    <tbody>{applications.map(app => <tr key={app.id}>
      <td><div className="company-cell"><CompanyMark company={app.company} /><div><Link className="company-link" title={app.company} to={`/applications/${app.id}`}>{app.company}</Link><p title={app.position}>{app.position}</p><span className="mobile-meta">{app.location || 'Location not set'} · {formatDate(app.dateApplied)}</span></div></div></td>
      <td><StatusBadge status={app.status} /></td>
      <td className="location-cell"><span className="location-text">{app.location || '—'}</span></td>
      {!compact && <td className="salary-cell">{app.salary === undefined ? '—' : formatSalary(app.salary)}</td>}
      <td className="date-cell">{formatDate(app.dateApplied)}</td>
      <td className="row-arrow"><Link className="icon-button" to={`/applications/${app.id}`} aria-label={`View ${app.company} application`}><ChevronRight size={17} /></Link></td>
    </tr>)}</tbody>
  </table></div>
}
