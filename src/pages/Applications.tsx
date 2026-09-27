import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ListFilter, Plus, Search, X } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { EMPLOYMENT_TYPES, STATUSES, STATUS_META, WORK_MODES } from '../types/application'
import type { EmploymentType, Status, WorkMode } from '../types/application'
import { emptyFilters, filterApplications } from '../utils/applications'
import type { Filters, SortKey } from '../utils/applications'
import { PageHeading } from '../components/PageHeading'
import { ApplicationTable } from '../components/ApplicationTable'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'

const PAGE_SIZE = 10

export default function Applications() {
  const applications = useWorkspace(state => state.applications)
  const openEditor = useUI(state => state.openEditor)
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(() => ['work', 'tag', 'location', 'type', 'min', 'max', 'from', 'to'].some(key => params.has(key)))
  const filters: Filters = {
    ...emptyFilters,
    search: params.get('q') ?? '', status: STATUSES.includes(params.get('status') as Status) ? params.get('status') as Status : '',
    location: params.get('location') ?? '', employmentType: EMPLOYMENT_TYPES.includes(params.get('type') as EmploymentType) ? params.get('type') as EmploymentType : '',
    minSalary: params.get('min') ?? '', maxSalary: params.get('max') ?? '', from: params.get('from') ?? '', to: params.get('to') ?? '',
    tag: params.get('tag') ?? '', workMode: WORK_MODES.includes(params.get('work') as WorkMode) ? params.get('work') as WorkMode : '',
  }
  const sort = (['newest', 'oldest', 'company', 'salary'].includes(params.get('sort') ?? '') ? params.get('sort') : 'newest') as SortKey
  const filtered = filterApplications(applications, filters, sort)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const requestedPage = Number(params.get('page'))
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1)
  const locations = useMemo(() => [...new Set(applications.map(app => app.location).filter(Boolean))].sort(), [applications])
  const tags = useMemo(() => [...new Set(applications.flatMap(app => app.tags))].sort(), [applications])
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== 'search' && key !== 'status' && value).length
  const hasFilters = Object.values(filters).some(Boolean)
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const invalidRange = (filters.from && filters.to && filters.from > filters.to) || (filters.minSalary && filters.maxSalary && Number(filters.minSalary) > Number(filters.maxSalary))

  return <>
    <PageHeading title="Applications" action={applications.length > 0 && <Button onClick={() => openEditor()}><Plus size={17} />Add application</Button>} />
    <section className="applications-panel">
      {(applications.length > 0 || hasFilters) && <>
      <div className="application-toolbar"><div className="search-input"><Search size={17} /><input aria-label="Search applications" value={filters.search} placeholder="Search applications…" onChange={event => update('q', event.target.value)} />{filters.search && <button className="icon-button" aria-label="Clear search" onClick={() => update('q', '')}><X size={15} /></button>}</div><div className="toolbar-options"><Button variant="secondary" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="application-filters"><ListFilter size={16} />Filters{activeCount > 0 && <span className="count-badge">{activeCount}</span>}</Button><select aria-label="Sort applications" value={sort} onChange={event => update('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="company">Company A–Z</option><option value="salary">Highest salary</option></select></div></div>
      <div className="status-tabs" aria-label="Filter by status"><button aria-pressed={!filters.status} onClick={() => update('status', '')}>All <span>{applications.length}</span></button>{STATUSES.map(status => <button key={status} aria-pressed={filters.status === status} onClick={() => update('status', status)}><span className={`status-tab-dot ${STATUS_META[status].className}`} />{STATUS_META[status].label}<span>{applications.filter(app => app.status === status).length}</span></button>)}</div>
      {showFilters && <div className="filter-panel" id="application-filters">
        <label>Work arrangement<select aria-label="Work arrangement" value={filters.workMode} onChange={event => update('work', event.target.value)}><option value="">Any</option>{WORK_MODES.map(mode => <option key={mode}>{mode}</option>)}</select></label>
        <label>Tag<select aria-label="Tag" value={filters.tag} onChange={event => update('tag', event.target.value)}><option value="">Any</option>{tags.map(tag => <option key={tag}>{tag}</option>)}</select></label>
        <label>Location<select aria-label="Location" value={filters.location} onChange={event => update('location', event.target.value)}><option value="">Any</option>{locations.map(location => <option key={location}>{location}</option>)}</select></label>
        <label>Employment type<select aria-label="Employment type" value={filters.employmentType} onChange={event => update('type', event.target.value)}><option value="">Any</option>{EMPLOYMENT_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Min salary (USD)<input type="number" min="0" value={filters.minSalary} onChange={event => update('min', event.target.value)} placeholder="No minimum" /></label>
        <label>Max salary (USD)<input type="number" min="0" value={filters.maxSalary} onChange={event => update('max', event.target.value)} placeholder="No maximum" /></label>
        <label>Applied from<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label>
        <label>Applied through<input type="date" value={filters.to} onChange={event => update('to', event.target.value)} /></label>
        {invalidRange && <p className="field-error full-width" role="alert">The start of a date or salary range must be before its end.</p>}
      </div>}
      {hasFilters && <div className="filter-summary"><span role="status">{filtered.length} {filtered.length === 1 ? 'match' : 'matches'}</span><button onClick={() => setParams({})}><X size={13} />Clear all filters</button></div>}
      </>}
      {filtered.length ? <ApplicationTable applications={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} /> : <EmptyState title={applications.length ? 'No applications found' : 'No applications yet'} description={applications.length ? 'Try another search or clear your filters.' : undefined} action={<Button variant={applications.length ? 'secondary' : 'primary'} onClick={() => applications.length ? setParams({}) : openEditor()}>{applications.length ? 'Clear filters' : 'Add application'}</Button>} />}
      {filtered.length > 0 && <div className="pagination"><span>Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> applications</span><div><button className="icon-button" aria-label="Previous page" disabled={page === 1} onClick={() => update('page', String(page - 1))}><ChevronLeft size={17} /></button><span>Page {page} of {pageCount}</span><button className="icon-button" aria-label="Next page" disabled={page === pageCount} onClick={() => update('page', String(page + 1))}><ChevronRight size={17} /></button></div></div>}
    </section>
  </>
}
