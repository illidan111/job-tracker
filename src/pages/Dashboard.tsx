import { RecentActivity } from '../components/RecentActivity'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { useResource } from '../hooks/useResource'
import type { Overview } from '../domain/overview'
import { RemoteState } from '../components/ui/RemoteState'
import { WidgetBoundary } from '../components/WidgetBoundary'
import { useUI } from '../state/useUI'
import { dateKey, formatDate, formatDateTime } from '../utils/dates'
import { PageHeading } from '../components/PageHeading'
import { ActivityChart } from '../charts/ActivityChart'
import { StatusChart } from '../charts/StatusChart'
import { CompanyMark } from '../components/CompanyMark'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'

export default function Dashboard() {
  const query = useResource<Overview>('/overview')
  const openEditor = useUI(state => state.openEditor)
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [recentTab, setRecentTab] = useState<'applications' | 'activity'>('applications')
  const [upcomingTab, setUpcomingTab] = useState<'interviews' | 'followups'>('interviews')
  if (!query.data) return <><PageHeading title="Overview" /><RemoteState {...query} /></>
  const { followups, metrics, upcoming, recent, dueToday, deadlines, savedCount } = query.data
  const supportingStats = [
    { label: 'Interviewed', value: metrics.interviews, detail: metrics.total ? `${metrics.interviewRate}% conversion` : 'No applications yet', to: '/analytics' },
    { label: 'Offers', value: metrics.offers, detail: metrics.total ? `${metrics.offerRate}% conversion` : 'No applications yet', to: '/analytics' },
    { label: 'Applied this month', value: metrics.thisMonth, detail: '', to: `/applications?from=${dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}&to=${dateKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))}` },
  ]
  return <>
    <PageHeading title="Overview" />
    {(dueToday > 0 || deadlines > 0 || savedCount > 0) && <section className="today-strip" aria-label="Needs attention"><strong>Today</strong>{dueToday > 0 && <Link to="/applications">{dueToday} follow-up{dueToday === 1 ? '' : 's'} due or overdue</Link>}{deadlines > 0 && <Link to="/saved">{deadlines} saved job deadline{deadlines === 1 ? '' : 's'} reached</Link>}<Link to="/saved">{savedCount} saved job{savedCount === 1 ? '' : 's'} to review <ArrowRight size={14} /></Link></section>}
    <section className="overview-metrics" aria-label="Job search statistics">
      <Link to="/applications" className="overview-primary-metric"><span className="metric-label">Active applications</span><strong>{metrics.active}</strong><span className="metric-detail">{metrics.thisWeek} sent this week <ArrowUpRight size={15} /></span></Link>
      <div className="overview-support-metrics">{supportingStats.map(({ label, value, detail, to }) => <Link to={to} className="overview-support-metric" key={label}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</Link>)}</div>
    </section>
    <div className="dashboard-bottom-grid">
      <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent</h2></div><Link className="text-link" to="/applications">View all <ArrowRight size={15} /></Link></div><div className="compact-section-tabs" aria-label="Recent progress view"><button aria-pressed={recentTab === 'applications'} onClick={() => setRecentTab('applications')}>Applications</button><button aria-pressed={recentTab === 'activity'} onClick={() => setRecentTab('activity')}>Activity</button></div>{recentTab === 'activity' ? <RecentActivity items={query.data.activity} /> : recent.length ? <div className="recent-list">{recent.map(app => <Link className="recent-row" key={app.id} to={`/applications/${app.id}`} aria-label={app.company}><CompanyMark company={app.company} /><span className="recent-row-main"><strong>{app.company}</strong><small>{app.position}</small></span><span className="recent-row-date">{formatDate(app.dateApplied)}</span><StatusBadge status={app.status} /><ChevronRight className="recent-row-arrow" size={17} /></Link>)}</div> : <EmptyState title="No applications yet" action={<Button onClick={() => openEditor()}><Plus size={16} />Add application</Button>} />}</section>
      <section className="panel interviews-panel"><div className="panel-heading"><div><h2>Coming up</h2></div></div><div className="compact-section-tabs" aria-label="Upcoming view"><button aria-pressed={upcomingTab === 'interviews'} onClick={() => setUpcomingTab('interviews')}>Interviews · {upcoming.length}</button><button aria-pressed={upcomingTab === 'followups'} onClick={() => setUpcomingTab('followups')}>Follow-ups · {followups.length}</button></div>{upcomingTab === 'followups' ? <div className="followup-list">{followups.length ? followups.slice(0, 4).map(app => <Link className="followup-item" key={app.id} to={`/applications/${app.id}`}><strong>{app.company}</strong><p>{app.position}</p><span>{app.followUpDate < dateKey() ? 'Overdue · ' : app.followUpDate === dateKey() ? 'Today · ' : ''}{formatDate(app.followUpDate)}</span></Link>) : <div className="small-empty"><p>No follow-ups due.</p></div>}</div> : upcoming.length ? <div className="upcoming-list">{upcoming.slice(0, 3).map(app => <Link key={app.interviewId} to={`/applications/${app.id}`} className="upcoming-item"><div className="upcoming-top"><CompanyMark company={app.company} small /><div><strong>{app.company}</strong><p>{app.position}</p></div><ChevronRight size={16} /></div><div className="interview-time"><CalendarDays size={13} /><span>{formatDateTime(app.interviewDate)}</span><span className="interview-type">{app.interviewType}</span></div></Link>)}</div> : <div className="small-empty"><CalendarDays size={28} strokeWidth={1.4} /><h3>No upcoming interviews</h3><p>Schedule one from an application.</p></div>}</section>
    </div>
    <div className="dashboard-chart-grid">
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>Application activity</h2></div><div className="segmented-control" aria-label="Chart period"><button onClick={() => setPeriod('weekly')} aria-pressed={period === 'weekly'}>Weekly</button><button onClick={() => setPeriod('monthly')} aria-pressed={period === 'monthly'}>Monthly</button></div></div><WidgetBoundary><ActivityChart series={query.data[period]} period={period} /></WidgetBoundary><div className="chart-footnote"><span className="legend-dot" />Applications sent<span>{period === 'weekly' ? 'Last 8 weeks' : 'Last 6 months'}</span></div></section>
      <section className="panel pipeline-panel"><div className="panel-heading"><div><h2>Pipeline</h2></div><Link className="icon-button" to="/kanban" aria-label="Open Kanban board"><ArrowUpRight size={19} /></Link></div><WidgetBoundary><StatusChart counts={query.data.currentStatuses} /></WidgetBoundary></section>
    </div>
  </>
}
