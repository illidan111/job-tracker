import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ListFilter, Plus, Search, X } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { APPLICATION_SOURCES, EMPLOYMENT_TYPES, STATUSES, STATUS_META, WORK_MODES } from '../types/application'
import type { ApplicationSource, EmploymentType, Status, WorkMode } from '../types/application'
import { emptyFilters, filterApplications } from '../utils/applications'
import type { Filters, SortKey } from '../utils/applications'
import { PageHeading } from '../components/PageHeading'
import { ApplicationTable } from '../components/ApplicationTable'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'

const PAGE_SIZE = 10

export default function Applications() {
  const applications = useWorkspace(state => state.applications)
  const pending = useWorkspace(state => state.pending), serverError = useWorkspace(state => state.storageError)
  const toast = useUI(state => state.toast)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState(''), [bulkValue, setBulkValue] = useState(''), [confirmDelete, setConfirmDelete] = useState(false)
  const openEditor = useUI(state => state.openEditor)
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(() => ['work', 'tag', 'location', 'type', 'min', 'max', 'from', 'to', 'source'].some(key => params.has(key)))
  const archived = params.get('view') === 'archived'
  const visible = applications.filter(app => Boolean(app.archivedAt) === archived)
  const filters: Filters = {
    ...emptyFilters,
    search: params.get('q') ?? '', status: STATUSES.includes(params.get('status') as Status) ? params.get('status') as Status : '',
    location: params.get('location') ?? '', employmentType: EMPLOYMENT_TYPES.includes(params.get('type') as EmploymentType) ? params.get('type') as EmploymentType : '',
    minSalary: params.get('min') ?? '', maxSalary: params.get('max') ?? '', from: params.get('from') ?? '', to: params.get('to') ?? '',
    tag: params.get('tag') ?? '', workMode: WORK_MODES.includes(params.get('work') as WorkMode) ? params.get('work') as WorkMode : '',
    source: APPLICATION_SOURCES.some(source => source === params.get('source')) ? params.get('source') as ApplicationSource : '',
  }
  const sort = (['newest', 'oldest', 'company', 'salary'].includes(params.get('sort') ?? '') ? params.get('sort') : 'newest') as SortKey
  const filtered = filterApplications(visible, filters, sort)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const requestedPage = Number(params.get('page'))
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1)
  const locations = [...new Set(visible.map(app => app.location).filter(Boolean))].sort()
  const tags = [...new Set(visible.flatMap(app => app.tags))].sort()
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== 'search' && key !== 'status' && value).length
  const hasFilters = Object.values(filters).some(Boolean)
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key !== 'page') { next.delete('page'); setSelected([]) }
    setParams(next, { replace: true })
  }
  const invalidRange = (filters.from && filters.to && filters.from > filters.to) || (filters.minSalary && filters.maxSalary && Number(filters.minSalary) > Number(filters.maxSalary))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const runBulk = async (action = bulkAction) => {
    if (!selected.length || !action) return
    if (action === 'delete' && !confirmDelete) { setConfirmDelete(true); return }
    const value = ['status', 'addTag', 'removeTag'].includes(action) ? bulkValue.trim() : undefined
    if (value === '' || (action === 'status' && !STATUSES.includes(value as Status))) return
    if (await useWorkspace.getState().bulkApplications(selected, action as 'status' | 'addTag' | 'removeTag' | 'archive' | 'restore' | 'delete', value)) {
      toast(`${selected.length} ${selected.length === 1 ? 'application' : 'applications'} updated`)
      setSelected([]); setBulkAction(''); setBulkValue(''); setConfirmDelete(false)
    }
  }

  return <>
    <PageHeading title={archived ? 'Archived applications' : 'Applications'} action={<Button onClick={() => openEditor()}><Plus size={17} />Add application</Button>} />
    <div className="archive-switch"><button aria-pressed={!archived} onClick={() => { update('view', ''); setSelected([]) }}>Current <span>{applications.filter(app => !app.archivedAt).length}</span></button><button aria-pressed={archived} onClick={() => { update('view', 'archived'); setSelected([]) }}>Archive <span>{applications.filter(app => app.archivedAt).length}</span></button></div>
    <section className="applications-panel">
      {(visible.length > 0 || hasFilters) && <>
      <div className="application-toolbar"><div className="search-input"><Search size={17} /><input aria-label="Search applications" value={filters.search} placeholder="Search applications…" onChange={event => update('q', event.target.value)} />{filters.search && <button className="icon-button" aria-label="Clear search" onClick={() => update('q', '')}><X size={15} /></button>}</div><div className="toolbar-options"><Button variant="secondary" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="application-filters"><ListFilter size={16} />Filters{activeCount > 0 && <span className="count-badge">{activeCount}</span>}</Button><select aria-label="Sort applications" value={sort} onChange={event => update('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="company">Company A–Z</option><option value="salary">Highest salary</option></select></div></div>
      <div className="status-tabs" aria-label="Filter by status"><button aria-pressed={!filters.status} onClick={() => update('status', '')}>All <span>{visible.length}</span></button>{STATUSES.map(status => <button key={status} aria-pressed={filters.status === status} onClick={() => update('status', status)}><span className={`status-tab-dot ${STATUS_META[status].className}`} />{STATUS_META[status].label}<span>{visible.filter(app => app.status === status).length}</span></button>)}</div>
      {showFilters && <div className="filter-panel" id="application-filters">
        <label>Work arrangement<select aria-label="Work arrangement" value={filters.workMode} onChange={event => update('work', event.target.value)}><option value="">Any</option>{WORK_MODES.map(mode => <option key={mode}>{mode}</option>)}</select></label>
        <label>Source<select aria-label="Application source" value={filters.source} onChange={event => update('source', event.target.value)}><option value="">Any</option>{APPLICATION_SOURCES.map(source => <option key={source}>{source}</option>)}</select></label>
        <label>Tag<select aria-label="Tag" value={filters.tag} onChange={event => update('tag', event.target.value)}><option value="">Any</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select></label>
        <label>Location<select aria-label="Location" value={filters.location} onChange={event => update('location', event.target.value)}><option value="">Any</option>{locations.map(location => <option key={location}>{location}</option>)}</select></label>
        <label>Employment type<select aria-label="Employment type" value={filters.employmentType} onChange={event => update('type', event.target.value)}><option value="">Any</option>{EMPLOYMENT_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Min salary (USD)<input type="number" min="0" value={filters.minSalary} onChange={event => update('min', event.target.value)} placeholder="No minimum" /></label>
        <label>Max salary (USD)<input type="number" min="0" value={filters.maxSalary} onChange={event => update('max', event.target.value)} placeholder="No maximum" /></label>
        <label>Applied from<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label>
        <label>Applied through<input type="date" value={filters.to} onChange={event => update('to', event.target.value)} /></label>
        {invalidRange && <p className="field-error full-width" role="alert">The start of a date or salary range must be before its end.</p>}
      </div>}
      {hasFilters && <div className="filter-summary"><span role="status">{filtered.length} {filtered.length === 1 ? 'match' : 'matches'}</span><button onClick={() => setParams(archived ? { view: 'archived' } : {})}><X size={13} />Clear all filters</button></div>}
      </>}
      {selected.length > 0 && <div className="bulk-bar" role="group" aria-label="Bulk application actions"><strong>{selected.length} selected</strong><select aria-label="Bulk action" value={bulkAction} onChange={event => { setBulkAction(event.target.value); setBulkValue('') }}><option value="">Choose action</option><option value="status">Change status</option><option value="addTag">Add tag</option><option value="removeTag">Remove tag</option><option value={archived ? 'restore' : 'archive'}>{archived ? 'Restore' : 'Archive'}</option><option value="delete">Delete</option></select>{bulkAction === 'status' && <select aria-label="New status" value={bulkValue} onChange={event => setBulkValue(event.target.value)}><option value="">Choose status</option>{STATUSES.map(status => <option value={status} key={status}>{STATUS_META[status].label}</option>)}</select>}{['addTag', 'removeTag'].includes(bulkAction) && <input aria-label="Tag for bulk action" list="bulk-tags" value={bulkValue} maxLength={60} onChange={event => setBulkValue(event.target.value)} placeholder="Tag name" />}{bulkAction === 'removeTag' && <datalist id="bulk-tags">{tags.map(tag => <option value={tag} key={tag} />)}</datalist>}<Button size="sm" disabled={pending || !bulkAction || (['status', 'addTag', 'removeTag'].includes(bulkAction) && !bulkValue.trim())} onClick={() => { void runBulk() }}>Apply</Button><button className="text-link" onClick={() => setSelected([])}>Clear selection</button></div>}
      {serverError && <p className="form-error" role="alert">{serverError}</p>}
      {filtered.length ? <ApplicationTable applications={pageItems} selected={selected} onSelect={(id, checked) => setSelected(current => checked ? [...current, id] : current.filter(item => item !== id))} onSelectAll={checked => setSelected(current => checked ? [...new Set([...current, ...pageItems.map(app => app.id)])] : current.filter(id => !pageItems.some(app => app.id === id)))} /> : <EmptyState title={visible.length ? 'No applications found' : archived ? 'Archive is empty' : 'No applications yet'} description={visible.length ? 'Try another search or clear your filters.' : undefined} action={!archived && <Button variant={visible.length ? 'secondary' : 'primary'} onClick={() => visible.length ? setParams({}) : openEditor()}>{visible.length ? 'Clear filters' : 'Add application'}</Button>} />}
      {filtered.length > 0 && <div className="pagination"><span>Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> applications</span><div><button className="icon-button" aria-label="Previous page" disabled={page === 1} onClick={() => update('page', String(page - 1))}><ChevronLeft size={17} /></button><span>Page {page} of {pageCount}</span><button className="icon-button" aria-label="Next page" disabled={page === pageCount} onClick={() => update('page', String(page + 1))}><ChevronRight size={17} /></button></div></div>}
    </section>
    {confirmDelete && <ConfirmDialog title={`Delete ${selected.length} applications?`} description="The selected applications and their history will be permanently removed." confirmLabel="Delete applications" danger error={serverError} onClose={() => setConfirmDelete(false)} onConfirm={() => { void runBulk('delete') }} />}
  </>
}
