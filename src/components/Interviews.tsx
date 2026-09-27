import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { CalendarDays, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Application, Interview } from '../types/application'
import { INTERVIEW_OUTCOMES, INTERVIEW_TYPES } from '../types/application'
import { interviewInputSchema, validDate } from '../validation/application'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { formatDateTime, localDateTime } from '../utils/dates'
import { ConfirmDialog, Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Field } from './ui/Field'

const formSchema = interviewInputSchema.extend({ scheduledAt: z.string().refine(value => Boolean(value) && validDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value)), 'Enter a valid date and time') })
function InterviewForm({ app, interview, onClose }: { app: Application; interview?: Interview; onClose: () => void }) {
  const error = useWorkspace(state => state.storageError)
  const [version, setVersion] = useState(app.version), [discard, setDiscard] = useState(false)
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: interview ? { ...interview, scheduledAt: localDateTime(interview.scheduledAt) } : { scheduledAt: '', type: 'Video', interviewer: '', meetingUrl: '', notes: '', outcome: 'Scheduled' } })
  const close = () => { if (!isSubmitting) { if (isDirty) setDiscard(true); else onClose() } }
  return <><Dialog title={interview ? 'Edit interview' : 'Schedule interview'} className="application-dialog" onClose={close}>
    <form onSubmit={handleSubmit(async values => {
      const saved = await useWorkspace.getState().saveInterview(app.id, { ...values, scheduledAt: new Date(values.scheduledAt).toISOString() }, interview?.id, version)
      if (saved) { useUI.getState().toast(interview ? 'Interview updated' : 'Interview scheduled'); onClose() }
      else setVersion(useWorkspace.getState().applications.find(item => item.id === app.id)?.version ?? version)
    })} noValidate><div className="form-body"><div className="form-grid">
      <Field label="Date & time *" error={errors.scheduledAt?.message} hint="In your current timezone.">{props => <input {...props} {...register('scheduledAt')} type="datetime-local" autoFocus />}</Field>
      <Field label="Interview type" error={errors.type?.message}>{props => <select {...props} {...register('type')}>{INTERVIEW_TYPES.map(type => <option key={type}>{type}</option>)}</select>}</Field>
      <Field label="Interviewer" error={errors.interviewer?.message}>{props => <input {...props} {...register('interviewer')} placeholder="Name or team" />}</Field>
      <Field label="Outcome" error={errors.outcome?.message}>{props => <select {...props} {...register('outcome')}>{INTERVIEW_OUTCOMES.map(outcome => <option key={outcome}>{outcome}</option>)}</select>}</Field>
      <Field label="Meeting URL" error={errors.meetingUrl?.message} className="full-width">{props => <input {...props} {...register('meetingUrl')} type="url" placeholder="https://meet.google.com/…" />}</Field>
      <Field label="Preparation & notes" error={errors.notes?.message} className="full-width">{props => <textarea {...props} {...register('notes')} rows={4} placeholder="Topics to prepare, questions to ask, or how it went." />}</Field>
    </div>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="dialog-actions"><Button type="button" variant="secondary" disabled={isSubmitting} onClick={close}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : interview ? 'Save interview' : 'Schedule interview'}</Button></div></form>
  </Dialog>{discard && <ConfirmDialog title="Discard interview changes?" description="Your unsaved interview details will be lost." confirmLabel="Discard changes" onClose={() => setDiscard(false)} onConfirm={onClose} />}</>
}
export function Interviews({ app }: { app: Application }) {
  const [editing, setEditing] = useState<Interview | 'new' | null>(null), [deleting, setDeleting] = useState<Interview | null>(null)
  const error = useWorkspace(state => state.storageError), pending = useWorkspace(state => state.pending)
  const open = (value: Interview | 'new') => { useWorkspace.getState().dismissError(); setEditing(value) }
  return <section className="panel"><div className="panel-heading"><div><h2>Interviews <span className="count-badge">{app.interviews.length}</span></h2></div><Button variant="secondary" size="sm" onClick={() => open('new')}><Plus size={14} />Schedule</Button></div>
    <div className="detail-list">{app.interviews.length ? app.interviews.map(item => <article className="interview-row" key={item.id}><div className="detail-row-heading"><span className="detail-row-icon"><CalendarDays size={17} /></span><div><h3>{item.type} interview</h3><p>{formatDateTime(item.scheduledAt)}</p></div><div className="row-actions"><button className="icon-button" onClick={() => open(item)} aria-label={`Edit ${item.type} interview`}><Pencil size={15} /></button><button className="icon-button delete-button" disabled={pending} onClick={() => { useWorkspace.getState().dismissError(); setDeleting(item) }} aria-label={`Delete ${item.type} interview`}><Trash2 size={15} /></button></div></div><div className="interview-meta"><span>{item.outcome}</span>{item.interviewer && <span>With {item.interviewer}</span>}{item.outcome === 'Scheduled' && new Date(item.scheduledAt) < new Date() && <span>Update the outcome when you’re ready.</span>}{item.meetingUrl && <a className="text-link" href={item.meetingUrl} target="_blank" rel="noopener noreferrer">Meeting link <ExternalLink size={12} /></a>}</div>{item.notes && <p className="detail-notes">{item.notes}</p>}</article>) : <div className="small-empty"><p>No interviews scheduled.</p></div>}</div>
    {editing && <InterviewForm app={app} interview={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {deleting && <ConfirmDialog title="Delete this interview?" description="Its details will be removed. A record of the removal stays in your application timeline." confirmLabel="Delete interview" error={error} onClose={() => setDeleting(null)} onConfirm={async () => { if (await useWorkspace.getState().deleteInterview(app.id, deleting.id)) { useUI.getState().toast('Interview deleted'); setDeleting(null) } }} />}
  </section>
}
