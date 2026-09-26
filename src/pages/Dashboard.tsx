import { RecentActivity } from '../components/RecentActivity'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronRight, MessageSquare, Plus, Sparkles, Target, Trophy } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { getMetrics, upcomingInterviews, upcomingFollowUps } from '../utils/applications'
import { dateKey, formatDate, formatDateTime } from '../utils/dates'
import { PageHeading } from '../components/PageHeading'
import { ActivityChart } from '../charts/ActivityChart'
import { StatusChart } from '../charts/StatusChart'
import { ApplicationTable } from '../components/ApplicationTable'
import { CompanyMark } from '../components/CompanyMark'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'

export default function Dashboard() {
  const applications = useWorkspace(state => state.applications)
  const profile = useWorkspace(state => state.profile)
  const openEditor = useUI(state => state.openEditor)
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [recentTab, setRecentTab] = useState<'applications' | 'activity'>('applications')
  const [upcomingTab, setUpcomingTab] = useState<'interviews' | 'followups'>('interviews')
  const followups = upcomingFollowUps(applications)
  const metrics = getMetrics(applications)
  const upcoming = upcomingInterviews(applications)
  const recent = [...applications].sort((a, b) => b.dateApplied.localeCompare(a.dateApplied)).slice(0, 5)
  const stats = [
    { label: 'Active applications', value: metrics.active, icon: BriefcaseBusiness, className: 'neutral', sub: `${metrics.thisWeek} applications this week`, to: '/applications' },
    { label: 'Reached interview', value: metrics.interviews, icon: MessageSquare, className: 'purple', sub: `${metrics.interviewRate}% interview conversion`, to: '/analytics' },
    { label: 'Offers received', value: metrics.offers, icon: Trophy, className: 'green', sub: `${metrics.offerRate}% offer conversion`, to: '/analytics' },
    { label: 'Applied this month', value: metrics.thisMonth, icon: CalendarDays, className: 'amber', sub: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), to: `/applications?from=${dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}&to=${dateKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))}` },
  ]
  return <>
    <PageHeading eyebrow="YOUR JOB SEARCH, IN MOTION" title={`Welcome back, ${profile.name.split(' ')[0]}.`} description="A little clarity for your next big move. Here’s where you stand." action={<div className="today-pill"><CalendarDays size={16} />{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>} />
    <section className="momentum-banner"><span className="momentum-icon"><Sparkles size={22} strokeWidth={1.6} /></span><div><h2>{upcoming.length ? 'Good things are moving forward.' : 'Your next chapter is taking shape.'}</h2><p>{upcoming.length ? `You have ${upcoming.length} upcoming interview${upcoming.length === 1 ? '' : 's'}. A little preparation goes a long way.` : 'Keep showing up. Every application is a new possibility.'}</p></div><Link to={upcoming[0] ? `/applications/${upcoming[0].id}` : '/applications'}>{upcoming.length ? 'Get interview-ready' : 'Explore your applications'}<ArrowRight size={16} /></Link><div className="banner-art" aria-hidden="true"><div /><div /><div /><span><ArrowUpRight size={28} /></span></div></section>
    <section className="stats-grid" aria-label="Job search statistics">{stats.map(({ label, value, icon: Icon, className, sub, to }) => <Link to={to} className={`stat-card ${className}`} key={label}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={18} strokeWidth={1.7} /></span></div><strong className="stat-value">{value.toString().padStart(2, '0')}</strong><p><span className="stat-sub-dot" />{sub}</p></Link>)}</section>
    <div className="dashboard-chart-grid">
      <section className="panel activity-panel"><div className="panel-heading"><div><h2>Application activity</h2><p>Small steps. Steady momentum.</p></div><div className="segmented-control" aria-label="Chart period"><button onClick={() => setPeriod('weekly')} aria-pressed={period === 'weekly'}>Weekly</button><button onClick={() => setPeriod('monthly')} aria-pressed={period === 'monthly'}>Monthly</button></div></div><ActivityChart applications={applications} period={period} /><div className="chart-footnote"><span className="legend-dot" />Applications sent<span>{period === 'weekly' ? 'Last 8 weeks' : 'Last 6 months'}</span></div></section>
      <section className="panel pipeline-panel"><div className="panel-heading"><div><h2>Your pipeline</h2><p>Every opportunity, at a glance.</p></div><Link className="icon-button" to="/kanban" aria-label="Open Kanban board"><ArrowUpRight size={19} /></Link></div><StatusChart applications={applications} /></section>
    </div>
    <div className="dashboard-bottom-grid">
      <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent progress <span className="count-badge">{applications.length}</span></h2><p>The latest steps in your journey.</p></div><Link className="text-link" to="/applications">View all <ArrowRight size={15} /></Link></div><div className="compact-section-tabs" aria-label="Recent progress view"><button aria-pressed={recentTab === 'applications'} onClick={() => setRecentTab('applications')}>Applications</button><button aria-pressed={recentTab === 'activity'} onClick={() => setRecentTab('activity')}>Activity</button></div>{recentTab === 'activity' ? <RecentActivity applications={applications} /> : recent.length ? <ApplicationTable applications={recent} compact /> : <EmptyState title="Your journey starts here" description="Add your first application and give your next move a home." action={<Button onClick={() => openEditor()}><Plus size={16} />Add application</Button>} />}</section>
      <section className="panel interviews-panel"><div className="panel-heading"><div><h2>Coming up <span className="count-badge">{upcoming.length + followups.length}</span></h2><p>Make your next conversation count.</p></div><CalendarDays size={18} className="muted" /></div><div className="compact-section-tabs" aria-label="Upcoming view"><button aria-pressed={upcomingTab === 'interviews'} onClick={() => setUpcomingTab('interviews')}>Interviews · {upcoming.length}</button><button aria-pressed={upcomingTab === 'followups'} onClick={() => setUpcomingTab('followups')}>Follow-ups · {followups.length}</button></div>{upcomingTab === 'followups' ? <div className="followup-list">{followups.length ? followups.slice(0, 4).map(app => <Link className="followup-item" key={app.id} to={`/applications/${app.id}`}><strong>{app.company}</strong><p>{app.position}</p><span>{app.followUpDate < dateKey() ? 'Overdue · ' : app.followUpDate === dateKey() ? 'Today · ' : ''}{formatDate(app.followUpDate)}</span></Link>) : <div className="small-empty"><p>No follow-ups waiting. Set a date on an application when you’d like to check in.</p></div>}</div> : upcoming.length ? <div className="upcoming-list">{upcoming.slice(0, 3).map(app => <Link key={app.interviewId} to={`/applications/${app.id}`} className="upcoming-item"><div className="upcoming-top"><CompanyMark company={app.company} small /><div><strong>{app.company}</strong><p>{app.position}</p></div><ChevronRight size={16} /></div><div className="interview-time"><CalendarDays size={13} /><span>{formatDateTime(app.interviewDate)}</span><span className="interview-type">{app.interviewType}</span></div></Link>)}</div> : <div className="small-empty"><CalendarDays size={28} strokeWidth={1.4} /><h3>Room for what’s next</h3><p>Add an interview date to any application and it will appear here.</p></div>}<div className="interview-tip"><span><Target size={17} /></span><p>A good question opens a great conversation. Prepare a few of your own.</p></div></section>
    </div>
    <div className="dashboard-note"><ArrowDownRight size={15} /><span>{metrics.rejections} closed opportunities. Each one is part of the process.</span><span>Last application: {recent[0] ? formatDate(recent[0].dateApplied) : 'Your next step'}</span></div>
  </>
}
