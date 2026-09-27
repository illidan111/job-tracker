import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { TASK_PRIORITIES, taskInputSchema } from '../domain/career'
import type { PageResult, Task, TaskInput } from '../domain/career'
import { useDebounced, useMutation, useResource } from '../hooks/useResource'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { dateKey, formatDate } from '../utils/dates'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { DraftDialog } from './ui/DraftDialog'
import { ConfirmDialog } from './ui/Dialog'
import { RemoteState } from './ui/RemoteState'
import { Pagination } from './ui/Pagination'

export function TaskForm({ task, applicationId, onClose }: { task?: Task; applicationId?: string; onClose: () => void }) {
  const [initial] = useState<TaskInput>(() => task ?? { title: '', description: '', applicationId: applicationId ?? null, dueDate: '', priority: 'MEDIUM', status: 'OPEN' })
  const [draft, setDraft] = useState(initial), [validation, setValidation] = useState(''), [requestId] = useState(() => crypto.randomUUID())
  const { save, pending, error } = useMutation()
  const applications = useWorkspace(state => state.applications)
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setDraft(current => ({ ...current, [key]: value }))
  const submit = async () => {
    const result = taskInputSchema.safeParse(draft)
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    if (await save<Task>(task ? `/tasks/${task.id}` : '/tasks', task ? 'PUT' : 'POST', { ...result.data, version: task?.version, requestId }, draft.applicationId ?? undefined)) { useUI.getState().toast(task ? 'Task updated' : 'Task created'); onClose() }
  }
  return <DraftDialog title={task ? 'Edit task' : 'Create task'} dirty={JSON.stringify(draft) !== JSON.stringify(initial)} pending={pending} onClose={onClose}>{close => <form noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
    <div className="form-body"><div className="form-grid">
      <Field label="Task title *" className="full-width">{props => <input {...props} autoFocus value={draft.title} maxLength={160} onChange={event => set('title', event.target.value)} placeholder="e.g. Prepare portfolio walkthrough" />}</Field>
      <Field label="Due date">{props => <input {...props} type="date" value={draft.dueDate} onChange={event => set('dueDate', event.target.value)} />}</Field>
      <Field label="Priority">{props => <select {...props} value={draft.priority} onChange={event => set('priority', event.target.value as TaskInput['priority'])}>{TASK_PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select>}</Field>
      {!applicationId && <Field label="Application" className="full-width" hint="Optional. You can also add a task directly from any application.">{props => <select {...props} value={draft.applicationId ?? ''} onChange={event => set('applicationId', event.target.value || null)}><option value="">Personal task</option>{applications.map(app => <option key={app.id} value={app.id}>{app.company} · {app.position}</option>)}</select>}</Field>}
      <Field label="Task description" className="full-width">{props => <textarea {...props} rows={4} value={draft.description} maxLength={5000} onChange={event => set('description', event.target.value)} />}</Field>
    </div>{(error || validation) && <p className="form-error" role="alert">{error || validation}</p>}</div>
    <div className="dialog-actions"><Button type="button" variant="secondary" disabled={pending} onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving…' : task ? 'Save task' : 'Create task'}</Button></div>
  </form>}</DraftDialog>
}

export function Tasks({ applicationId }: { applicationId?: string }) {
  const [status, setStatus] = useState('OPEN'), [page, setPage] = useState(1), [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Task | 'new' | null>(null), [deleting, setDeleting] = useState<Task | null>(null)
  const q = useDebounced(query)
  const params = new URLSearchParams({ page: String(page), status, q, ...(applicationId ? { applicationId } : {}) })
  const resource = useResource<PageResult<Task>>(`/tasks?${params}`)
  const mutation = useMutation()
  const toggle = async (task: Task) => {
    if (await mutation.save<Task>(`/tasks/${task.id}`, 'PUT', { ...task, status: task.status === 'OPEN' ? 'COMPLETED' : 'OPEN' }, task.applicationId ?? undefined)) useUI.getState().toast(task.status === 'OPEN' ? 'Task completed' : 'Task reopened')
  }
  return <section className="panel task-panel"><div className="panel-heading"><div><h2>{applicationId ? 'Tasks & checklist' : 'Your tasks'}</h2></div><Button variant="secondary" size="sm" onClick={() => setEditing('new')}><Plus size={15} />Create task</Button></div>
    <div className="crm-toolbar"><div className="segmented-control" aria-label="Task state"><button aria-pressed={status === 'OPEN'} onClick={() => { setStatus('OPEN'); setPage(1) }}>Open</button><button aria-pressed={status === 'COMPLETED'} onClick={() => { setStatus('COMPLETED'); setPage(1) }}>Completed</button></div><input aria-label="Search tasks" placeholder="Search tasks…" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></div>
    {mutation.error && <p className="form-error" role="alert">{mutation.error}</p>}
    {!resource.data ? <RemoteState {...resource} /> : <>{resource.data.items.length ? <ul className="crm-list">{resource.data.items.map(task => <li key={task.id} className="task-row">
      <button className="icon-button" disabled={mutation.pending} aria-label={`${task.status === 'OPEN' ? 'Complete' : 'Reopen'} ${task.title}`} onClick={() => void toggle(task)}>{task.status === 'OPEN' ? <Check size={18} /> : <RotateCcw size={17} />}</button>
      <div className="task-main"><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<div className="task-meta"><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority.toLowerCase()} priority</span>{task.dueDate && <span className={task.status === 'OPEN' && task.dueDate < dateKey() ? 'deadline-due' : ''}>{task.status === 'OPEN' && task.dueDate < dateKey() ? 'Overdue · ' : ''}{formatDate(task.dueDate)}</span>}{!applicationId && task.applicationId && <Link to={`/applications/${task.applicationId}`}>{task.applicationLabel || 'Open application'}</Link>}</div></div>
      <div className="row-actions"><button className="icon-button" aria-label={`Edit ${task.title}`} onClick={() => setEditing(task)}><Pencil size={15} /></button><button className="icon-button delete-button" aria-label={`Delete ${task.title}`} onClick={() => setDeleting(task)}><Trash2 size={15} /></button></div>
    </li>)}</ul> : <div className="small-empty"><p>{query ? 'No matching tasks.' : status === 'OPEN' ? 'No open tasks. Add your next step when you have one.' : 'No completed tasks yet.'}</p></div>}<Pagination result={resource.data} onPage={setPage} /></>}
    {editing && <TaskForm task={editing === 'new' ? undefined : editing} applicationId={applicationId} onClose={() => setEditing(null)} />}
    {deleting && <ConfirmDialog title="Delete this task?" description="The task will be permanently removed. Its application activity remains." confirmLabel="Delete task" error={mutation.error} onClose={() => setDeleting(null)} onConfirm={async () => { if (await mutation.save(`/tasks/${deleting.id}`, 'DELETE', { version: deleting.version }, deleting.applicationId ?? undefined)) setDeleting(null) }} />}
  </section>
}
