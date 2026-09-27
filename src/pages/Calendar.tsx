import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SchedulePage } from '../domain/career'
import { useResource } from '../hooks/useResource'
import { dateKey, formatDate, parseDate } from '../utils/dates'
import { monthDays } from '../utils/schedule'
import { PageHeading } from '../components/PageHeading'
import { Agenda } from '../components/Agenda'
import { Pagination } from '../components/ui/Pagination'
import { RemoteState } from '../components/ui/RemoteState'
import { Button } from '../components/ui/Button'
import { validDate } from '../validation/application'

export default function Calendar() {
  const [params, setParams] = useSearchParams(), today = dateKey()
  const month = validDate(`${params.get('month')}-01`) ? params.get('month')! : today.slice(0, 7)
  const days = monthDays(month), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const selected = validDate(params.get('day') ?? '') && params.get('day')!.startsWith(month) ? params.get('day')! : today.startsWith(month) ? today : `${month}-01`
  const resource = useResource<SchedulePage>(`/schedule?${new URLSearchParams({ from: days[0], to: days.at(-1)!, timezone })}`)
  const dayEvents = useResource<SchedulePage>(`/schedule?${new URLSearchParams({ from: selected, to: selected, timezone, page: String(Math.max(1, Number(params.get('page')) || 1)) })}`)
  const move = (offset: number) => { const next = parseDate(`${month}-01`); next.setMonth(next.getMonth() + offset); setParams({ month: dateKey(next).slice(0, 7) }) }
  return <><PageHeading title="Calendar" /><p className="page-intro">Interviews, follow-ups, task due dates and application deadlines. Times use your timezone.</p>
    <section className="panel calendar-panel"><div className="calendar-heading"><button className="icon-button" aria-label="Previous month" onClick={() => move(-1)}><ChevronLeft size={18} /></button><h2>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h2><button className="icon-button" aria-label="Next month" onClick={() => move(1)}><ChevronRight size={18} /></button><Button variant="secondary" size="sm" onClick={() => setParams({})}>Today</Button></div>
    {!resource.data ? <RemoteState {...resource} /> : <><div className="calendar-weekdays" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid" aria-label="Choose a day">{days.map(day => <button key={day} className={`${day.startsWith(month) ? '' : 'outside-month'} ${day === today ? 'calendar-today' : ''}`} aria-pressed={day === selected} aria-label={`${formatDate(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${resource.data!.days[day] ?? 0} events`} onClick={() => setParams({ month: day.slice(0, 7), day })}><strong>{Number(day.slice(-2))}</strong>{resource.data!.days[day] ? <span>{resource.data!.days[day]}<span className="calendar-event-word"> events</span></span> : null}</button>)}</div></>}
    </section><section className="selected-day"><h2>{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>{!dayEvents.data ? <RemoteState {...dayEvents} /> : <><Agenda items={dayEvents.data.items} group={false} /><Pagination result={dayEvents.data} onPage={page => setParams({ month, day: selected, page: String(page) })} /></>}</section>
  </>
}
