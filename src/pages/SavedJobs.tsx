import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookmarkPlus, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import type { SavedJob, SavedJobInput } from '../types/application'
import { APPLICATION_SOURCES } from '../types/application'
import { dateSchema, savedJobInputSchema } from '../validation/application'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { dateKey, formatDate } from '../utils/dates'
import { formatSalary } from '../utils/applications'
import { PageHeading } from '../components/PageHeading'
import { CompanyMark } from '../components/CompanyMark'
import { Dialog, ConfirmDialog } from '../components/ui/Dialog'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useDebounced, useResource } from '../hooks/useResource'
import type { PageResult } from '../domain/career'
import { Pagination } from '../components/ui/Pagination'
import { RemoteState } from '../components/ui/RemoteState'

const blank: SavedJobInput = { company: '', position: '', location: '', jobUrl: '', salary: undefined, source: '', deadline: '', notes: '' }

function SavedJobForm({ job, onClose }: { job?: SavedJob; onClose: () => void }) {
  const [draft, setDraft] = useState<SavedJobInput>(job ? { company: job.company, position: job.position, location: job.location, jobUrl: job.jobUrl, salary: job.salary, source: job.source, deadline: job.deadline, notes: job.notes } : blank)
  const [error, setError] = useState(''), [discard, setDiscard] = useState(false)
  const pending = useWorkspace(state => state.pending), serverError = useWorkspace(state => state.storageError)
  const toast = useUI(state => state.toast)
  const changed = JSON.stringify(draft) !== JSON.stringify(job ? { company: job.company, position: job.position, location: job.location, jobUrl: job.jobUrl, salary: job.salary, source: job.source, deadline: job.deadline, notes: job.notes } : blank)
  const close = () => changed ? setDiscard(true) : onClose()
  const set = <K extends keyof SavedJobInput>(key: K, value: SavedJobInput[K]) => setDraft(current => ({ ...current, [key]: value }))
  const save = async () => {
    const result = savedJobInputSchema.safeParse(draft)
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Check this saved job.'); return }
    setError('')
    const success = job ? await useWorkspace.getState().updateSavedJob(job.id, result.data, job.version) : await useWorkspace.getState().createSavedJob(result.data)
    if (success) { toast(job ? 'Saved job updated' : 'Job saved'); onClose() }
  }
  return <><Dialog title={job ? 'Edit saved job' : 'Save a job'} onClose={close} className="application-dialog">
    <form className="saved-job-form" onSubmit={event => { event.preventDefault(); void save() }} noValidate>
      <div className="form-body"><div className="form-grid">
        <label>Company *<input autoFocus value={draft.company} maxLength={100} onChange={event => set('company', event.target.value)} placeholder="e.g. Linear" /></label>
        <label>Position *<input value={draft.position} maxLength={150} onChange={event => set('position', event.target.value)} placeholder="e.g. Product Engineer" /></label>
        <label>Location<input value={draft.location} maxLength={120} onChange={event => set('location', event.target.value)} placeholder="City or Remote" /></label>
        <label>Annual salary (USD)<input inputMode="decimal" value={draft.salary ?? ''} onChange={event => set('salary', event.target.value ? Number(event.target.value) : undefined)} placeholder="Optional" /></label>
        <label className="full-width">Job URL<input type="url" value={draft.jobUrl} onChange={event => set('jobUrl', event.target.value)} placeholder="https://company.com/careers/…" /></label>
        <label>Source<select value={draft.source} onChange={event => set('source', event.target.value as SavedJobInput['source'])}><option value="">Not specified</option>{APPLICATION_SOURCES.map(source => <option key={source}>{source}</option>)}</select></label>
        <label>Application deadline<input type="date" value={draft.deadline} onChange={event => set('deadline', event.target.value)} /></label>
        <label className="full-width">Notes<textarea rows={4} value={draft.notes} maxLength={10000} onChange={event => set('notes', event.target.value)} placeholder="Why this role is interesting, people to contact, questions to ask…" /></label>
      </div>{(error || serverError) && <p className="form-error" role="alert">{error || serverError}</p>}</div>
      <div className="dialog-actions"><Button type="button" variant="secondary" onClick={close} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving…' : job ? 'Save changes' : 'Save job'}</Button></div>
    </form>
  </Dialog>{discard && <ConfirmDialog title="Discard your changes?" description="This saved job has unsaved changes." confirmLabel="Discard changes" onConfirm={onClose} onClose={() => setDiscard(false)} />}</>
}

export default function SavedJobs() {
  const [params, setParams] = useSearchParams()
  const query = useResource<PageResult<SavedJob>>('/saved-jobs/page?' + useDebounced(params.toString()))
  const jobs = query.data?.items ?? []
  const pending = useWorkspace(state => state.pending), error = useWorkspace(state => state.storageError)
  const [editing, setEditing] = useState<SavedJob | 'new' | null>(null), [deleting, setDeleting] = useState<SavedJob | null>(null), [applying, setApplying] = useState<SavedJob | null>(null)
  const [appliedDate, setAppliedDate] = useState(dateKey())
  const navigate = useNavigate(), toast = useUI(state => state.toast)
  return <><PageHeading title="Saved jobs" action={<Button onClick={() => setEditing('new')}><Plus size={17} />Save job</Button>} />
    <p className="page-intro">Keep opportunities here until you apply. Your details move into the application automatically.</p>
    <label className="career-search">Search saved jobs<input value={params.get('q') ?? ''} onChange={event => setParams({ q: event.target.value }, { replace: true })} /></label>
    <RemoteState {...query} />{query.data && <Pagination result={query.data} onPage={page => setParams({ q: params.get('q') ?? '', page: String(page) })} />}
    {jobs.length ? <div className="saved-jobs-grid">{jobs.map(job => <article className="panel saved-job-card" key={job.id}>
      <div className="saved-job-heading"><CompanyMark company={job.company} /><div><h2>{job.company}</h2><p>{job.position}</p></div></div>
      <p className="saved-job-meta">{job.location || 'Location not specified'}{job.salary !== undefined ? ` · ${formatSalary(job.salary)} / year` : ''}</p>
      {job.source && <p className="saved-job-meta">Found via {job.source}</p>}{job.deadline && <p className={job.deadline <= dateKey() ? 'saved-job-meta deadline-due' : 'saved-job-meta'}>{job.deadline < dateKey() ? 'Deadline passed' : job.deadline === dateKey() ? 'Deadline today' : `Apply by ${formatDate(job.deadline)}`}</p>}<p className="saved-job-meta">Saved {formatDate(job.createdAt)}</p>
      {job.notes && <p className="saved-job-note">{job.notes}</p>}
      <div className="saved-job-actions"><Button size="sm" disabled={pending} onClick={() => { setApplying(job); setAppliedDate(dateKey()) }}>Mark applied</Button><button className="icon-button" aria-label={`Edit ${job.company} saved job`} onClick={() => setEditing(job)}><Pencil size={16} /></button>{job.jobUrl && <a className="icon-button" href={job.jobUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${job.company} job listing`}><ExternalLink size={16} /></a>}<button className="icon-button delete-button" aria-label={`Delete ${job.company} saved job`} onClick={() => setDeleting(job)}><Trash2 size={16} /></button></div>
    </article>)}</div> : query.data && <EmptyState title="No saved jobs yet" description="Save a promising role now and turn it into an application when you apply." action={<Button onClick={() => setEditing('new')}><BookmarkPlus size={16} />Save a job</Button>} />}
    {editing && <SavedJobForm key={editing === 'new' ? 'new' : editing.id} job={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {applying && <Dialog title={`Applied to ${applying.company}?`} description="Choose the date you applied. The saved details will become an application." onClose={() => setApplying(null)} className="confirm-dialog"><form onSubmit={async event => { event.preventDefault(); if (!dateSchema.safeParse(appliedDate).success) return; if (await useWorkspace.getState().applySavedJob(applying.id, applying.version, appliedDate)) { const id = useWorkspace.getState().applications[0].id; toast('Application created from saved job'); setApplying(null); navigate(`/applications/${id}`) } }}><div className="form-body"><label>Date applied<input type="date" required value={appliedDate} onChange={event => setAppliedDate(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="dialog-actions"><Button type="button" variant="secondary" onClick={() => setApplying(null)} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending || !dateSchema.safeParse(appliedDate).success}>Create application</Button></div></form></Dialog>}
    {deleting && <ConfirmDialog title={`Delete saved job at ${deleting.company}?`} description="This saved job will be removed. Existing applications are unaffected." confirmLabel="Delete saved job" error={error} onClose={() => setDeleting(null)} onConfirm={async () => { if (await useWorkspace.getState().deleteSavedJob(deleting.id, deleting.version)) { toast('Saved job deleted'); setDeleting(null) } }} />}
  </>
}
