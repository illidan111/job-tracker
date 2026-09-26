import { useState } from 'react'
import { ArrowUpRight, CircleX, BarChart3, MessageSquare, Target, Trophy } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { getMetrics } from '../utils/applications'
import { PageHeading } from '../components/PageHeading'
import { ActivityChart } from '../charts/ActivityChart'
import { StatusChart } from '../charts/StatusChart'
import { EmptyState } from '../components/ui/EmptyState'
import type { Application } from '../types/application'

function Breakdown({ applications, field }: { applications: Application[]; field: 'location' | 'employmentType' }) {
  const counts = applications.reduce<Record<string, number>>((result, app) => { const key = app[field] || 'Not specified'; result[key] = (result[key] ?? 0) + 1; return result }, {})
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return <div className="breakdown-list">{entries.length ? entries.map(([label, count]) => <div className="breakdown-row" key={label}><div><span>{label}</span><strong>{count}<small>{Math.round(count / applications.length * 100)}%</small></strong></div><div className="breakdown-track"><span style={{ width: `${count / applications.length * 100}%` }} /></div></div>) : <p className="muted">Your breakdown will appear when you add applications.</p>}</div>
}

export default function Analytics() {
  const applications = useWorkspace(state => state.applications)
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const metrics = getMetrics(applications)
  return <>
    <PageHeading eyebrow="PROGRESS, WITH PERSPECTIVE" title="A clearer view of your search" description="See what’s working, find your rhythm, and make your next move with confidence." action={<span className="all-time-pill"><BarChart3 size={16} />All-time insights</span>} />
    <section className="stats-grid analytics-stats" aria-label="Conversion statistics">
      <div className="stat-card neutral"><div className="stat-top"><span>Applications sent</span><span className="stat-icon"><Target size={18} /></span></div><strong className="stat-value">{metrics.total}</strong><p>{metrics.thisWeek} this week · {metrics.thisMonth} this month</p></div>
      <div className="stat-card purple"><div className="stat-top"><span>Interview conversion</span><span className="stat-icon"><MessageSquare size={18} /></span></div><strong className="stat-value">{metrics.interviewRate}<small>%</small></strong><p>{metrics.interviews} of {metrics.total} reached an interview</p></div>
      <div className="stat-card green"><div className="stat-top"><span>Offer conversion</span><span className="stat-icon"><Trophy size={18} /></span></div><strong className="stat-value">{metrics.offerRate}<small>%</small></strong><p>{metrics.offers} of {metrics.total} reached an offer</p></div>
      <div className="stat-card neutral"><div className="stat-top"><span>Rejection rate</span><span className="stat-icon"><CircleX size={18} /></span></div><strong className="stat-value">{metrics.rejectionRate}<small>%</small></strong><p>{metrics.rejections} of {metrics.total} currently closed</p></div>
    </section>
    <div className="analytics-explainer"><ArrowUpRight size={18} /><p>Conversion tracks opportunities that reached each stage, including those that moved on. Your pipeline shows current statuses.</p></div>
    {!applications.length && <EmptyState title="Your story is still being written" description="Add applications to start seeing your activity, conversion rates, and search patterns." />}
    <div className="dashboard-chart-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Find your rhythm</h2><p>Applications over time.</p></div><div className="segmented-control" aria-label="Activity period"><button aria-pressed={period === 'weekly'} onClick={() => setPeriod('weekly')}>Weekly</button><button aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>Monthly</button></div></div><ActivityChart applications={applications} period={period} /><div className="chart-footnote"><span className="legend-dot" />Applications sent<span>{period === 'weekly' ? 'Last 8 weeks' : 'Last 6 months'}</span></div></section><section className="panel pipeline-panel"><div className="panel-heading"><div><h2>Applications by status</h2><p>Where your opportunities stand today.</p></div></div><StatusChart applications={applications} /></section></div>
    <div className="analytics-breakdown-grid"><section className="panel"><div className="panel-heading"><div><h2>Where you’re looking</h2><p>Applications by location.</p></div></div><Breakdown applications={applications} field="location" /></section><section className="panel"><div className="panel-heading"><div><h2>How you want to work</h2><p>Applications by employment type.</p></div></div><Breakdown applications={applications} field="employmentType" /><div className="analytics-insight"><Target size={21} strokeWidth={1.5} /><div><h3>Your search, your pace.</h3><p>Consistency matters more than volume. Choose opportunities that move you toward the work you want to do.</p></div></div></section></div>
  </>
}
