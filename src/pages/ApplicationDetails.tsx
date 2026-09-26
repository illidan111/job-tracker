import { Interviews } from '../components/Interviews'
import { Contacts } from '../components/Contacts'
import { FollowUp } from '../components/FollowUp'
import { eventLabel } from '../utils/timeline'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, Check, Clock3, ExternalLink, FileText, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { STATUSES, STATUS_META } from '../types/application'
import type { Status } from '../types/application'
import { formatDate, formatDateTime } from '../utils/dates'
import { formatSalary } from '../utils/applications'
import { CompanyMark } from '../components/CompanyMark'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'

export default function ApplicationDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const application = useWorkspace(state => state.applications.find(app => app.id === id))
  const deleteApplication = useWorkspace(state => state.deleteApplication)
  const changeStatus = useWorkspace(state => state.changeStatus)
  const openEditor = useUI(state => state.openEditor)
  const toast = useUI(state => state.toast)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const error = useWorkspace(state => state.storageError)
  const pending = useWorkspace(state => state.pending)
  if (!application) return <EmptyState title="This opportunity isn’t here" description="It may have been removed, or this link is no longer available." action={<Link className="button button-primary" to="/applications">Back to applications</Link>} />
  const app = application
  return <>
    <Link to="/applications" className="back-link"><ArrowLeft size={16} />All applications</Link>
    <div className="details-heading"><div className="details-company"><CompanyMark company={app.company} /><div><p>{app.company}</p><h1>{app.position}</h1><div className="details-subtitle"><span><MapPin size={14} />{app.location || 'Location not specified'}</span><span>·</span><span>{app.employmentType}{app.workMode !== 'Not specified' && app.workMode !== app.location ? ` · ${app.workMode}` : ''}</span><StatusBadge status={app.status} /></div></div></div><div className="details-actions"><Button variant="secondary" onClick={() => openEditor(app.id)}><Pencil size={15} />Edit application</Button><button className="icon-button delete-button" aria-label="Delete application" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button></div></div>
    <div className="details-grid"><div className="details-main">
      <section className="panel"><div className="panel-heading"><div><h2>Opportunity details</h2><p>The essentials, all in one place.</p></div><BriefcaseBusiness size={19} className="muted" /></div><dl className="details-facts"><div><dt>Annual salary</dt><dd>{formatSalary(app.salary)}{app.salary !== undefined && <span> USD / year</span>}</dd></div><div><dt>Date applied</dt><dd>{formatDate(app.dateApplied, { month: 'long', day: 'numeric', year: 'numeric' })}</dd></div><div><dt>Employment type</dt><dd>{app.employmentType}</dd></div><div><dt>Job listing</dt><dd>{app.jobUrl ? <a className="text-link" href={app.jobUrl} target="_blank" rel="noopener noreferrer">Open original listing<ExternalLink size={14} /></a> : 'No link added'}</dd></div></dl>{app.tags.length > 0 && <div className="details-tags"><span className="label-text">Tags</span><div className="tags">{app.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>}</section>
      <section className="panel"><div className="panel-heading"><div><h2>Notes & preparation</h2><p>Your thoughts, questions, and next steps.</p></div><FileText size={18} className="muted" /></div><div className="notes-content">{app.notes ? <p>{app.notes}</p> : <div className="small-empty"><p>Keep everything you want to remember about this opportunity here.</p><button className="text-link" onClick={() => openEditor(app.id)}>Add a note <Pencil size={13} /></button></div>}</div></section>
      <Interviews app={app} />
      <section className="panel"><div className="panel-heading"><div><h2>Your journey with {app.company}</h2><p>A timeline of this opportunity.</p></div><Clock3 size={18} className="muted" /></div><ol className="timeline">{[...app.timeline].sort((a, b) => b.at.localeCompare(a.at)).map((event, index) => <li key={event.id}><span className={`timeline-dot ${index === 0 ? 'latest' : ''}`}><Check size={12} /></span><div><strong>{eventLabel(event)}</strong><p>{formatDateTime(event.at)}{event.type === 'created' && event.status ? ` · ${STATUS_META[event.status].label}` : ''}</p></div></li>)}{app.timeline.length === 0 && <li><span className="timeline-dot"><Check size={12} /></span><div><strong>Application created</strong><p>{formatDateTime(app.createdAt)}</p></div></li>}</ol></section>
    </div><aside className="details-aside">
      <section className="panel status-panel"><h2>Where things stand</h2><label htmlFor="detail-status">Application status</label><select id="detail-status" value={app.status} disabled={pending} onChange={async event => { const status = event.target.value as Status; if (await changeStatus(app.id, status)) toast(`Moved to ${STATUS_META[status].label}`) }}>{STATUSES.map(status => <option key={status} value={status}>{STATUS_META[status].label}</option>)}</select><p>Keep your pipeline up to date as conversations move forward.</p></section>
      <FollowUp app={app} />
      <Contacts app={app} />
      <div className="record-dates"><p>Created {formatDateTime(app.createdAt)}</p><p>Updated {formatDateTime(app.updatedAt)}</p></div>
    </aside></div>
    {confirmDelete && <ConfirmDialog title={`Delete ${app.company} application?`} description="This application and its timeline will be permanently removed from your account. This cannot be undone." confirmLabel="Delete application" onClose={() => setConfirmDelete(false)} error={error} onConfirm={async () => { if (await deleteApplication(app.id)) { toast('Application deleted'); navigate('/applications') } }} />}
  </>
}
