import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Pencil, Plus } from 'lucide-react'
import type { Company, CompanyInput, PageResult } from '../domain/career'
import type { Status } from '../types/application'
import { companyInputSchema } from '../domain/career'
import { useDebounced, useMutation, useResource } from '../hooks/useResource'
import { useUI } from '../state/useUI'
import { PageHeading } from '../components/PageHeading'
import { CompanyMark } from '../components/CompanyMark'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { DraftDialog } from '../components/ui/DraftDialog'
import { RemoteState } from '../components/ui/RemoteState'
import { Pagination } from '../components/ui/Pagination'
import { formatDateTime } from '../utils/dates'

function CompanyForm({ company, onClose }: { company?: Company; onClose: () => void }) {
  const [initial] = useState<CompanyInput>(() => company ?? { name: '', website: '', industry: '', location: '', notes: '' })
  const [draft, setDraft] = useState(initial), [validation, setValidation] = useState('')
  const mutation = useMutation()
  return <DraftDialog title={company ? 'Edit company' : 'Add company'} dirty={JSON.stringify(draft) !== JSON.stringify(initial)} pending={mutation.pending} onClose={onClose}>{close => <form noValidate onSubmit={async event => {
    event.preventDefault(); const result = companyInputSchema.safeParse(draft)
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    if (await mutation.save(company ? `/companies/${company.id}` : '/companies', company ? 'PUT' : 'POST', { ...result.data, version: company?.version })) { useUI.getState().toast('Company saved'); onClose() }
  }}><div className="form-body"><div className="form-grid">
    <Field label="Company name *">{props => <input {...props} autoFocus value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} maxLength={100} />}</Field>
    <Field label="Company website">{props => <input {...props} type="url" value={draft.website} onChange={event => setDraft(current => ({ ...current, website: event.target.value }))} />}</Field>
    <Field label="Industry">{props => <input {...props} value={draft.industry} onChange={event => setDraft(current => ({ ...current, industry: event.target.value }))} maxLength={100} />}</Field>
    <Field label="Company location">{props => <input {...props} value={draft.location} onChange={event => setDraft(current => ({ ...current, location: event.target.value }))} maxLength={120} />}</Field>
    <Field label="Company research" className="full-width">{props => <textarea {...props} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} maxLength={10000} rows={6} />}</Field>
    </div>{(mutation.error || validation) && <p role="alert" className="form-error">{mutation.error || validation}</p>}</div><div className="dialog-actions"><Button type="button" variant="secondary" disabled={mutation.pending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.pending}>Save company</Button></div></form>}</DraftDialog>
}

interface CompanyView {
  company: Company
  applications: PageResult<{ id: string; company: string; position: string; status: Status; archivedAt: string }>
  contacts: { id: string; name: string; role: string; email: string; linkedInUrl: string }[]
  interviews: { id: string; applicationId: string; type: string; round: string; scheduledAt: string; outcome: string }[]
}

function CompanyDetails({ id }: { id: string }) {
  const [params, setParams] = useSearchParams(), [editing, setEditing] = useState(false)
  const resource = useResource<CompanyView>(`/companies/${id}?page=${Math.max(1, Number(params.get('page')) || 1)}`)
  useEffect(() => { if (resource.data) useUI.getState().remember({ href: `/companies/${id}`, label: resource.data.company.name }) }, [id, resource.data])
  if (!resource.data) return <RemoteState {...resource} />
  const { company, applications, contacts, interviews } = resource.data
  return <><Link className="back-link" to="/companies"><ArrowLeft size={15} />All companies</Link><PageHeading title={company.name} action={<Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={15} />Edit company</Button>} />
    <div className="career-columns"><section className="panel career-panel"><div className="panel-heading"><div><h2>Company research</h2></div></div><div className="career-content"><p className="muted">{[company.industry, company.location].filter(Boolean).join(' · ') || 'Add context to prepare for conversations.'}</p>{company.website && <a className="text-link" href={company.website} target="_blank" rel="noopener noreferrer">Company website <ExternalLink size={14} /></a>}<p className={company.notes ? 'preserved-text' : 'muted'}>{company.notes || 'No research notes yet.'}</p></div></section>
    <section className="panel"><div className="panel-heading"><div><h2>Contacts</h2></div></div><ul className="crm-list">{contacts.map(contact => <li className="company-contact" key={contact.id}><strong>{contact.name}</strong><p>{contact.role}</p>{contact.email && <a className="text-link" href={`mailto:${contact.email}`}>{contact.email}</a>}</li>)}</ul>{!contacts.length && <div className="small-empty"><p>No contacts linked to this company yet.</p></div>}</section></div>
    <section className="panel"><div className="panel-heading"><div><h2>Applications · {applications.total}</h2></div></div><ul className="crm-list">{applications.items.map(app => <li key={app.id} className="company-application"><Link to={`/applications/${app.id}`}>{app.position}</Link><StatusBadge status={app.status} />{app.archivedAt && <span className="muted">Archived</span>}</li>)}</ul>{!applications.total && <div className="small-empty"><p>Applications with this company name will appear here.</p></div>}<Pagination result={applications} onPage={page => setParams({ page: String(page) })} /></section>
    <section className="panel company-interviews"><div className="panel-heading"><div><h2>Recent interviews</h2></div></div><ul className="crm-list">{interviews.map(item => <li key={item.id}><Link to={`/applications/${item.applicationId}?interview=${item.id}`}>{item.round || item.type} interview</Link><p className="muted">{formatDateTime(item.scheduledAt)} · {item.outcome}</p></li>)}</ul>{!interviews.length && <div className="small-empty"><p>No interviews recorded.</p></div>}</section>
    {editing && <CompanyForm company={company} onClose={() => setEditing(false)} />}
  </>
}

export default function Companies() {
  const { id } = useParams(), [params, setParams] = useSearchParams(), [editing, setEditing] = useState(false)
  const query = useDebounced(params.get('q') ?? '')
  const resource = useResource<PageResult<Company>>(id ? null : `/companies?q=${encodeURIComponent(query)}&page=${Math.max(1, Number(params.get('page')) || 1)}`)
  if (id) return <CompanyDetails id={id} />
  return <><PageHeading title="Companies" action={<Button onClick={() => setEditing(true)}><Plus size={16} />Add company</Button>} /><p className="page-intro">Keep research and see your application history with each company.</p><div className="crm-toolbar"><input aria-label="Search companies" placeholder="Search companies…" value={params.get('q') ?? ''} onChange={event => setParams({ q: event.target.value }, { replace: true })} /></div>
    {!resource.data ? <RemoteState {...resource} /> : <section className="panel"><ul className="crm-list">{resource.data.items.map(company => <li key={company.id}><Link className="company-directory-row" to={`/companies/${company.id}`}><CompanyMark company={company.name} /><div><strong>{company.name}</strong><p>{[company.industry, company.location].filter(Boolean).join(' · ') || 'Open company profile'}</p></div></Link></li>)}</ul>{!resource.data.items.length && <div className="small-empty"><p>No matching companies. Add one, or create an application to start a company history.</p></div>}<Pagination result={resource.data} onPage={page => setParams({ q: query, page: String(page) })} /></section>}
    {editing && <CompanyForm onClose={() => setEditing(false)} />}
  </>
}
