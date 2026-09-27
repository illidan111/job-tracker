import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { ScheduleItem, Task } from '../domain/career'
import { useMutation } from '../hooks/useResource'
import { dateKey, formatDate, formatDateTime } from '../utils/dates'
import { agendaGroup } from '../utils/schedule'
import { useUI } from '../state/useUI'

export function Agenda({ items, group = true }: { items: ScheduleItem[]; group?: boolean }) {
  const mutation = useMutation(), today = dateKey()
  const groups = group ? ['Overdue', 'Today', 'Tomorrow', 'Next 7 days', 'Later'] : ['Events']
  return <div className="agenda">{mutation.error && <p role="alert" className="form-error">{mutation.error}</p>}{!items.length && <div className="small-empty"><p>Nothing scheduled here. Add a task or schedule an interview from an application.</p></div>}{groups.map(label => {
    const entries = group ? items.filter(item => agendaGroup(item.day, today) === label) : items
    if (!entries.length) return null
    return <section className="agenda-group" key={label}>{group && <h2>{label}</h2>}<ul className="crm-list">{entries.map(item => <li className="agenda-row" key={item.id}><span className={`agenda-kind kind-${item.kind}`}>{item.kind === 'followup' ? 'Follow-up' : item.kind}</span><Link className="agenda-main" to={item.href}><strong>{item.title}</strong><span>{item.detail}</span><time className={item.day < today ? 'deadline-due' : ''}>{item.at ? formatDateTime(item.at) : formatDate(item.day)}{item.day < today ? ' · Overdue' : ''}</time></Link>{item.task && <button className="icon-button" disabled={mutation.pending} aria-label={`Complete ${item.title}`} onClick={async () => { if (await mutation.save<Task>(`/tasks/${item.task!.id}`, 'PUT', { ...item.task, status: 'COMPLETED' }, item.task!.applicationId ?? undefined)) useUI.getState().toast('Task completed') }}><Check size={18} /></button>}</li>)}</ul></section>
  })}</div>
}
