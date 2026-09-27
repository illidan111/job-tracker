import { useState } from 'react'
import { CalendarCheck, Check, Pencil } from 'lucide-react'
import type { Application } from '../types/application'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { dateKey, formatDate } from '../utils/dates'
import { Field } from './ui/Field'
import { Button } from './ui/Button'

export function FollowUp({ app }: { app: Application }) {
  const [editing, setEditing] = useState(false), [date, setDate] = useState(app.followUpDate)
  const [reason, setReason] = useState(app.followUpReason), [note, setNote] = useState(app.followUpNote)
  const pending = useWorkspace(state => state.pending), error = useWorkspace(state => state.storageError)
  const save = async (complete: boolean) => {
    if (await useWorkspace.getState().saveFollowUp(app.id, editing ? date : app.followUpDate, complete, editing ? reason : app.followUpReason, editing ? note : app.followUpNote)) { setEditing(false); useUI.getState().toast(complete ? 'Follow-up completed' : 'Follow-up saved') }
  }
  return <section id="follow-up" className="panel followup-panel" tabIndex={-1}><div className="aside-title"><CalendarCheck size={18} /><h2>Next follow-up</h2></div>
    {editing ? <form onSubmit={event => { event.preventDefault(); void save(false) }}><Field label="Follow up on" hint="Leave empty to remove the follow-up.">{props => <input {...props} type="date" value={date} onChange={event => setDate(event.target.value)} autoFocus />}</Field><Field label="Reason">{props => <input {...props} value={reason} maxLength={120} onChange={event => setReason(event.target.value)} placeholder="e.g. Check application status" />}</Field><Field label="Follow-up note">{props => <textarea {...props} value={note} maxLength={1000} onChange={event => setNote(event.target.value)} rows={3} />}</Field>{error && <p className="form-error" role="alert">{error}</p>}<div className="inline-actions"><Button type="submit" size="sm" disabled={pending}>Save follow-up</Button><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button></div></form> : <>
      {app.followUpDate ? <><strong>{formatDate(app.followUpDate, { month: 'long', day: 'numeric' })}</strong><p>{app.followUpCompletedAt ? 'Completed' : app.followUpDate < dateKey() ? 'Overdue' : app.followUpDate === dateKey() ? 'Due today' : 'Scheduled'}</p>{app.followUpReason && <p>{app.followUpReason}</p>}{app.followUpNote && <p className="muted">{app.followUpNote}</p>}</> : <p className="muted">No follow-up scheduled.</p>}
      <div className="followup-actions">{app.followUpDate && !app.followUpCompletedAt && <button className="text-link" disabled={pending} onClick={() => void save(true)}><Check size={14} />Mark complete</button>}<button className="text-link" onClick={() => { setDate(app.followUpDate); setReason(app.followUpReason); setNote(app.followUpNote); useWorkspace.getState().dismissError(); setEditing(true) }}><Pencil size={13} />{app.followUpDate ? 'Change date' : 'Set follow-up'}</button></div>
    </>}
  </section>
}
