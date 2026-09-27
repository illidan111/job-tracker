import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
import type { SchedulePage } from '../domain/career'
import { useResource } from '../hooks/useResource'
import { dateKey } from '../utils/dates'
import { shiftDay } from '../utils/schedule'
import { PageHeading } from '../components/PageHeading'
import { TaskForm } from '../components/Tasks'
import { Agenda } from '../components/Agenda'
import { Button } from '../components/ui/Button'
import { Pagination } from '../components/ui/Pagination'
import { RemoteState } from '../components/ui/RemoteState'
import { useUI } from '../state/useUI'
import { RecentActivity } from '../components/RecentActivity'
import { useOverview } from '../hooks/useOverview'

export default function Today() {
  const recent = useUI(state => state.recent)
  const overview = useOverview()
  const [params, setParams] = useSearchParams(), [creating, setCreating] = useState(false)
  const upcoming = params.get('view') === 'upcoming', today = dateKey()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const resource = useResource<SchedulePage>(`/schedule?${new URLSearchParams({ from: today, to: shiftDay(today, upcoming ? 90 : 7), timezone, overdue: 'true', page: String(Math.max(1, Number(params.get('page')) || 1)) })}`)
  const suggestions = useResource<{ id: string; title: string; detail: string; href: string }[]>(`/suggestions?today=${today}`)
  return <><PageHeading title="Today" action={<Button onClick={() => setCreating(true)}><Plus size={16} />Create task</Button>} /><p className="page-intro">Your next steps, conversations and deadlines in one place.</p>
    <div className="crm-toolbar"><div className="segmented-control" aria-label="Agenda range"><button aria-pressed={!upcoming} onClick={() => setParams({})}>Today & this week</button><button aria-pressed={upcoming} onClick={() => setParams({ view: 'upcoming' })}>Upcoming</button></div><Link className="text-link" to="/calendar"><CalendarDays size={16} />Open calendar</Link></div>
    {!resource.data ? <RemoteState {...resource} /> : <><Agenda items={resource.data.items} /><Pagination result={resource.data} onPage={page => setParams({ ...(upcoming ? { view: 'upcoming' } : {}), page: String(page) })} /></>}
    {suggestions.data && suggestions.data.length > 0 && <section className="panel suggestion-panel"><div className="panel-heading"><div><h2>Worth a check</h2></div></div><ul className="crm-list">{suggestions.data.map(item => <li key={item.id}><Link className="text-link" to={item.href}>{item.title}</Link><p className="muted">{item.detail}</p></li>)}</ul></section>}
    {creating && <TaskForm onClose={() => setCreating(false)} />}
    <div className="career-columns today-context"><section className="panel"><div className="panel-heading"><div><h2>Recent activity</h2></div></div>{overview.data ? <RecentActivity items={overview.data.activity} /> : <RemoteState {...overview} />}</section>{recent.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Recently opened</h2></div></div><ul className="crm-list">{recent.map(item => <li key={item.href}><Link to={item.href}>{item.label}</Link></li>)}</ul></section>}</div>
  </>
}
