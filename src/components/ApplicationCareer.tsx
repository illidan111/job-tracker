import { useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import type { CareerNote, Materials, PageResult, Preparation } from '../domain/career'
import { INTERVIEW_REFLECTIONS, materialsInputSchema, noteInputSchema, preparationInputSchema } from '../domain/career'
import { useMutation, useResource } from '../hooks/useResource'
import { useUI } from '../state/useUI'
import { formatDateTime } from '../utils/dates'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { DraftDialog } from './ui/DraftDialog'
import { ConfirmDialog } from './ui/Dialog'
import { RemoteState } from './ui/RemoteState'
import { Pagination } from './ui/Pagination'

function MaterialsForm({ value, onClose }: { value: Materials; onClose: () => void }) {
  const [draft, setDraft] = useState(value), [skills, setSkills] = useState(value.skills.join(', ')), [validation, setValidation] = useState('')
  const mutation = useMutation()
  const dirty = JSON.stringify(draft) !== JSON.stringify(value) || skills !== value.skills.join(', ')
  const field = (key: keyof Materials, text: string) => setDraft(current => ({ ...current, [key]: text }))
  return <DraftDialog title="Application materials" dirty={dirty} pending={mutation.pending} onClose={onClose}>{close => <form noValidate onSubmit={async event => {
    event.preventDefault()
    const result = materialsInputSchema.safeParse({ ...draft, skills: skills.split(',').map(skill => skill.trim()).filter(Boolean) })
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    if (await mutation.save(`/applications/${value.applicationId}/materials`, 'PUT', { ...result.data, version: value.version }, value.applicationId)) { useUI.getState().toast('Materials saved'); onClose() }
  }}><div className="form-body"><div className="form-grid">
    <Field label="Resume version">{props => <input {...props} autoFocus value={draft.resumeVersion} maxLength={120} onChange={event => field('resumeVersion', event.target.value)} placeholder="e.g. Frontend v4" />}</Field>
    <Field label="Resume URL">{props => <input {...props} type="url" value={draft.resumeUrl} onChange={event => field('resumeUrl', event.target.value)} placeholder="https://…" />}</Field>
    <Field label="Portfolio URL">{props => <input {...props} type="url" value={draft.portfolioUrl} onChange={event => field('portfolioUrl', event.target.value)} placeholder="https://…" />}</Field>
    <Field label="Take-home assignment URL">{props => <input {...props} type="url" value={draft.assignmentUrl} onChange={event => field('assignmentUrl', event.target.value)} placeholder="https://…" />}</Field>
    <Field label="Skills & requirements" className="full-width" hint="Separate skills with commas. Add up to 30.">{props => <input {...props} value={skills} onChange={event => setSkills(event.target.value)} placeholder="React, TypeScript, SQL" />}</Field>
    <Field label="Job description" className="full-width" hint="Paste the description to keep it after the listing closes.">{props => <textarea {...props} rows={7} maxLength={30000} value={draft.jobDescription} onChange={event => field('jobDescription', event.target.value)} />}</Field>
    <Field label="Cover letter" className="full-width">{props => <textarea {...props} rows={6} maxLength={15000} value={draft.coverLetter} onChange={event => field('coverLetter', event.target.value)} />}</Field>
  </div>{(mutation.error || validation) && <p className="form-error" role="alert">{mutation.error || validation}</p>}</div><div className="dialog-actions"><Button type="button" variant="secondary" disabled={mutation.pending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.pending}>Save materials</Button></div></form>}</DraftDialog>
}

export function ApplicationMaterials({ applicationId }: { applicationId: string }) {
  const resource = useResource<Materials>(`/applications/${applicationId}/materials`)
  const [editing, setEditing] = useState(false), [query, setQuery] = useState('')
  if (!resource.data) return <RemoteState {...resource} />
  const value = resource.data
  const matches = !query || value.jobDescription.toLowerCase().includes(query.toLowerCase())
  return <section className="panel career-panel"><div className="panel-heading"><div><h2>Preparation & materials</h2></div><Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil size={15} />Edit materials</Button></div>
    <div className="career-content"><dl className="material-facts"><div><dt>Resume version</dt><dd>{value.resumeVersion || 'Not recorded'}</dd></div>{([['Resume', value.resumeUrl], ['Portfolio', value.portfolioUrl], ['Take-home assignment', value.assignmentUrl]] as const).map(([label, url]) => url && <div key={label}><dt>{label}</dt><dd><a className="text-link" href={url} target="_blank" rel="noopener noreferrer">Open {label.toLowerCase()} <ExternalLink size={13} /></a></dd></div>)}</dl>
    {value.skills.length > 0 && <div className="tags">{value.skills.map(skill => <span key={skill}>{skill}</span>)}</div>}
    <h3>Job description</h3>{value.jobDescription ? <><input aria-label="Search job description" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a requirement…" />{query && <p role="status" className="muted">{matches ? 'Found in the description.' : 'No match in this description.'}</p>}<p className="preserved-text">{value.jobDescription}</p></> : <p className="muted">Keep the original role description and requirements here.</p>}
    <h3>Cover letter</h3><p className={value.coverLetter ? 'preserved-text' : 'muted'}>{value.coverLetter || 'No cover letter recorded.'}</p><p className="muted">Use an application task for a take-home or preparation deadline.</p></div>
    {editing && <MaterialsForm value={value} onClose={() => setEditing(false)} />}
  </section>
}

function NoteForm({ note, applicationId, onClose }: { note?: CareerNote; applicationId: string; onClose: () => void }) {
  const [body, setBody] = useState(note?.body ?? ''), [validation, setValidation] = useState(''), [requestId] = useState(() => crypto.randomUUID())
  const mutation = useMutation()
  return <DraftDialog title={note ? 'Edit note' : 'Add note'} dirty={body !== (note?.body ?? '')} pending={mutation.pending} onClose={onClose}>{close => <form noValidate onSubmit={async event => {
    event.preventDefault(); const result = noteInputSchema.safeParse({ body })
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    if (await mutation.save(`/applications/${applicationId}/notes${note ? `/${note.id}` : ''}`, note ? 'PUT' : 'POST', { body: result.data.body, version: note?.version, requestId }, applicationId)) { useUI.getState().toast('Note saved'); onClose() }
  }}><div className="form-body"><Field label="Note *">{props => <textarea {...props} autoFocus rows={8} maxLength={10000} value={body} onChange={event => setBody(event.target.value)} placeholder="What happened, what did you learn, and what comes next?" />}</Field>{(mutation.error || validation) && <p className="form-error" role="alert">{mutation.error || validation}</p>}</div><div className="dialog-actions"><Button type="button" variant="secondary" disabled={mutation.pending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.pending}>Save note</Button></div></form>}</DraftDialog>
}

export function ApplicationNotes({ applicationId }: { applicationId: string }) {
  const [page, setPage] = useState(1), [editing, setEditing] = useState<CareerNote | 'new' | null>(null), [deleting, setDeleting] = useState<CareerNote | null>(null)
  const resource = useResource<PageResult<CareerNote>>(`/applications/${applicationId}/notes?page=${page}`), mutation = useMutation()
  return <section className="panel"><div className="panel-heading"><div><h2>Conversation & outcome notes</h2></div><Button size="sm" variant="secondary" onClick={() => setEditing('new')}><Plus size={15} />Add note</Button></div>
    {!resource.data ? <RemoteState {...resource} /> : <>{resource.data.items.length ? <ul className="crm-list">{resource.data.items.map(note => <li className="note-entry" key={note.id}><div className="note-heading"><time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time><div className="row-actions"><button className="icon-button" aria-label="Edit note" onClick={() => setEditing(note)}><Pencil size={15} /></button><button className="icon-button delete-button" aria-label="Delete note" onClick={() => setDeleting(note)}><Trash2 size={15} /></button></div></div><p className="preserved-text">{note.body}</p></li>)}</ul> : <div className="small-empty"><p>No notes yet. Record conversations, feedback and lessons from this application.</p></div>}<Pagination result={resource.data} onPage={setPage} /></>}
    {editing && <NoteForm applicationId={applicationId} note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {deleting && <ConfirmDialog title="Delete this note?" description="Its text will be permanently removed. Export a backup first if you want to keep a copy." confirmLabel="Delete note" error={mutation.error} onClose={() => setDeleting(null)} onConfirm={async () => { if (await mutation.save(`/applications/${applicationId}/notes/${deleting.id}`, 'DELETE', { version: deleting.version }, applicationId)) setDeleting(null) }} />}
  </section>
}

function PreparationForm({ value, onClose }: { value: Preparation; onClose: () => void }) {
  const [draft, setDraft] = useState(value), [topic, setTopic] = useState(''), [validation, setValidation] = useState('')
  const mutation = useMutation()
  return <DraftDialog title="Interview preparation" dirty={JSON.stringify(draft) !== JSON.stringify(value) || Boolean(topic)} pending={mutation.pending} onClose={onClose}>{close => <form noValidate onSubmit={async event => {
    event.preventDefault(); const result = preparationInputSchema.safeParse({ ...draft, topics: topic.trim() ? [...draft.topics, { title: topic.trim(), done: false }] : draft.topics })
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    if (await mutation.save(`/interviews/${value.interviewId}/preparation`, 'PUT', { ...result.data, version: value.version }, value.applicationId)) { useUI.getState().toast('Interview preparation saved'); onClose() }
  }}><div className="form-body"><h3>Topics to prepare</h3><ul className="preparation-checklist">{draft.topics.map((item, index) => <li key={index}><label><input type="checkbox" checked={item.done} onChange={event => setDraft(current => ({ ...current, topics: current.topics.map((entry, target) => target === index ? { ...entry, done: event.target.checked } : entry) }))} />{item.title}</label><button type="button" className="icon-button" aria-label={`Remove topic ${item.title}`} onClick={() => setDraft(current => ({ ...current, topics: current.topics.filter((_, target) => target !== index) }))}><Trash2 size={14} /></button></li>)}</ul>
    <div className="topic-add"><input autoFocus aria-label="New preparation topic" value={topic} maxLength={200} onChange={event => setTopic(event.target.value)} placeholder="e.g. SQL joins" /><Button type="button" size="sm" variant="secondary" disabled={!topic.trim() || draft.topics.length >= 40} onClick={() => { setDraft(current => ({ ...current, topics: [...current.topics, { title: topic.trim(), done: false }] })); setTopic('') }}>Add topic</Button></div>
    <div className="form-grid"><Field label="Questions I want to ask" className="full-width">{props => <textarea {...props} rows={4} value={draft.questionsToAsk} maxLength={10000} onChange={event => setDraft(current => ({ ...current, questionsToAsk: event.target.value }))} />}</Field><Field label="Questions I expect to receive" className="full-width">{props => <textarea {...props} rows={4} value={draft.expectedQuestions} maxLength={10000} onChange={event => setDraft(current => ({ ...current, expectedQuestions: event.target.value }))} />}</Field><Field label="My impression after the interview" className="full-width" hint="Your own reflection, separate from the hiring outcome.">{props => <select {...props} value={draft.reflection} onChange={event => setDraft(current => ({ ...current, reflection: event.target.value as Preparation['reflection'] }))}>{INTERVIEW_REFLECTIONS.map(item => <option key={item}>{item}</option>)}</select>}</Field><Field label="Post-interview notes" className="full-width">{props => <textarea {...props} rows={4} value={draft.reflectionNotes} maxLength={10000} onChange={event => setDraft(current => ({ ...current, reflectionNotes: event.target.value }))} />}</Field></div>
    {(mutation.error || validation) && <p className="form-error" role="alert">{mutation.error || validation}</p>}</div><div className="dialog-actions"><Button type="button" variant="secondary" disabled={mutation.pending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.pending}>Save preparation</Button></div></form>}</DraftDialog>
}

export function InterviewPreparation({ interviewId, onClose }: { interviewId: string; onClose: () => void }) {
  const resource = useResource<Preparation>(`/interviews/${interviewId}/preparation`)
  return resource.data ? <PreparationForm value={resource.data} onClose={onClose} /> : <div><RemoteState {...resource} /><Button variant="secondary" onClick={onClose}>Close preparation</Button></div>
}
