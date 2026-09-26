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
  const pending = useWorkspace(state => state.pending), error = useWorkspace(state => state.storageError)
  const save = async (complete: boolean) => {
    if (await useWorkspace.getState().saveFollowUp(app.id, editing ? date : app.followUpDate, complete)) { setEditing(false); useUI.getState().toast(complete ? 'Follow-up completed' : 'Follow-up saved') }
  }
  return <section className="panel followup-panel"><div className="aside-title"><CalendarCheck size={18} /><h2>Next follow-up</h2></div>
    {editing ? <form onSubmit={event => { event.preventDefault(); void save(false) }}><Field label="Follow up on" hint="Leave empty to remove the follow-up.">{props => <input {...props} type="date" value={date} onChange={event => setDate(event.target.value)} autoFocus />}</Field>{error && <p className="form-error" role="alert">{error}</p>}<div className="inline-actions"><Button type="submit" size="sm" disabled={pending}>Save follow-up</Button><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button></div></form> : <>
      {app.followUpDate ? <><strong>{formatDate(app.followUpDate, { month: 'long', day: 'numeric' })}</strong><p>{app.followUpCompletedAt ? 'Completed. Nice work keeping things moving.' : app.followUpDate < dateKey() ? 'Overdue · A little nudge can go a long way.' : app.followUpDate === dateKey() ? 'Due today' : 'A reminder for your next step.'}</p></> : <p className="muted">Choose a day to check in on this opportunity.</p>}
      <div className="followup-actions">{app.followUpDate && !app.followUpCompletedAt && <button className="text-link" disabled={pending} onClick={() => void save(true)}><Check size={14} />Mark complete</button>}<button className="text-link" onClick={() => { setDate(app.followUpDate); useWorkspace.getState().dismissError(); setEditing(true) }}><Pencil size={13} />{app.followUpDate ? 'Change date' : 'Set follow-up'}</button></div>
    </>}
  </section>
}
