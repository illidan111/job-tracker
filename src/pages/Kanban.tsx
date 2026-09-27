import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { CalendarDays, GripVertical, MapPin, Plus, Search, X } from 'lucide-react'
import { STATUSES, STATUS_META } from '../types/application'
import type { Application, Status } from '../types/application'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { emptyFilters, filterApplications, formatSalary } from '../utils/applications'
import { formatDate } from '../utils/dates'
import { PageHeading } from '../components/PageHeading'
import { CompanyMark } from '../components/CompanyMark'
import { Button } from '../components/ui/Button'

function KanbanCard({ application }: { application: Application }) {
  const pending = useWorkspace(state => state.pending)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: application.id, disabled: pending })
  const changeStatus = useWorkspace(state => state.changeStatus)
  const toast = useUI(state => state.toast)
  return <article ref={setNodeRef} className={`kanban-card ${isDragging ? 'is-dragging' : ''}`} data-testid={`card-${application.id}`}>
    <div className="kanban-card-top"><CompanyMark company={application.company} small /><span>{application.company}</span><button className="drag-handle" {...attributes} {...listeners} aria-label={`Drag ${application.company} application; use the status menu to move with a keyboard`} title="Drag to another column"><GripVertical size={17} /></button></div>
    <Link className="kanban-card-title" to={`/applications/${application.id}`}>{application.position}</Link>
    <p className="kanban-location"><MapPin size={13} />{application.location || 'Location not specified'}</p>
    {application.salary !== undefined && <p className="kanban-salary">{formatSalary(application.salary)}<span> / year</span></p>}
    {application.tags.length > 0 && <div className="tags kanban-tags">{application.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}{application.tags.length > 2 && <span>+{application.tags.length - 2}</span>}</div>}
    <div className="kanban-card-footer"><span><CalendarDays size={12} />{formatDate(application.dateApplied)}</span><select value={application.status} disabled={pending} aria-label={`Move ${application.company} to status`} onChange={async event => { const status = event.target.value as Status; if (await changeStatus(application.id, status)) toast(`${application.company} moved to ${STATUS_META[status].label}`) }}>{STATUSES.map(status => <option key={status} value={status}>{STATUS_META[status].label}</option>)}</select></div>
  </article>
}

function KanbanColumn({ status, applications }: { status: Status; applications: Application[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const openEditor = useUI(state => state.openEditor)
  return <section ref={setNodeRef} className={`kanban-column ${isOver ? 'is-over' : ''}`} aria-label={`${STATUS_META[status].label} column`} data-testid={`column-${status}`}>
    <div className="kanban-column-heading"><span className={`status-tab-dot ${STATUS_META[status].className}`} /><h2>{STATUS_META[status].label}</h2><span className="count-badge">{applications.length}</span><button className="icon-button" onClick={() => openEditor(undefined, status)} aria-label={`Add application to ${STATUS_META[status].label}`}><Plus size={16} /></button></div>
    <div className="kanban-card-list">{applications.map(application => <KanbanCard key={application.id} application={application} />)}{!applications.length && <div className="column-empty">No applications<span>Drop a card here.</span></div>}</div>
  </section>
}

export default function Kanban() {
  const applications = useWorkspace(state => state.applications)
  const changeStatus = useWorkspace(state => state.changeStatus)
  const toast = useUI(state => state.toast)
  const openEditor = useUI(state => state.openEditor)
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const filtered = filterApplications(applications.filter(app => !app.archivedAt), { ...emptyFilters, search })
  const activeApplication = applications.find(app => app.id === activeId)
  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && STATUSES.includes(over.id as Status)) {
      const app = applications.find(item => item.id === active.id)
      if (app && app.status !== over.id) {
        if (await changeStatus(app.id, over.id as Status)) toast(`${app.company} moved to ${STATUS_META[over.id as Status].label}`)
      }
    }
  }
  return <>
    <PageHeading title="Kanban board" action={<Button onClick={() => openEditor()}><Plus size={17} />Add application</Button>} />
    <div className="board-toolbar"><div className="search-input"><Search size={16} /><input aria-label="Search board" placeholder="Search applications…" value={search} onChange={event => setSearch(event.target.value)} />{search && <button className="icon-button" onClick={() => setSearch('')} aria-label="Clear board search"><X size={15} /></button>}</div><p>{filtered.length} applications</p></div>
    {search && filtered.length === 0 && <p className="board-no-results" role="status">No applications match “{search}”. <button className="text-link" onClick={() => setSearch('')}>Clear search</button></p>}
    <p className="board-scroll-hint">Scroll to see all stages →</p>
    <DndContext sensors={sensors} onDragStart={event => setActiveId(String(event.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd} accessibility={{ screenReaderInstructions: { draggable: 'Use the status menu on each card to move an application with a keyboard. You can also drag this handle with a pointer.' } }}>
      <div className="kanban-board" aria-label="Application pipeline" tabIndex={0}>{STATUSES.map(status => <KanbanColumn key={status} status={status} applications={filtered.filter(app => app.status === status)} />)}</div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>{activeApplication ? <div className="kanban-card drag-overlay" aria-hidden="true"><div className="kanban-card-top"><CompanyMark company={activeApplication.company} small /><span>{activeApplication.company}</span></div><span className="kanban-card-title">{activeApplication.position}</span><p className="kanban-location">{activeApplication.location}</p><p className="kanban-salary">{formatSalary(activeApplication.salary)}</p></div> : null}</DragOverlay>
    </DndContext>
  </>
}
