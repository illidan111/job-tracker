import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useUI } from '../state/useUI'
import { Button } from '../components/ui/Button'
import { useWorkspace } from '../state/useWorkspace'
import { getMetrics } from '../utils/applications'
import { PageHeading } from '../components/PageHeading'
import { ActivityChart } from '../charts/ActivityChart'
import { StatusChart } from '../charts/StatusChart'
import { EmptyState } from '../components/ui/EmptyState'
import type { Application } from '../types/application'

function Breakdown({ applications, field }: { applications: Application[]; field: 'location' | 'employmentType' | 'source' }) {
  const counts = applications.reduce<Record<string, number>>((result, app) => { const key = app[field] || 'Not specified'; result[key] = (result[key] ?? 0) + 1; return result }, {})
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return <div className="breakdown-list">{entries.length ? entries.map(([label, count]) => <div className="breakdown-row" key={label}><div><span>{label}</span><strong>{count}<small>{Math.round(count / applications.length * 100)}%</small></strong></div><div className="breakdown-track"><span style={{ width: `${count / applications.length * 100}%` }} /></div></div>) : <p className="muted">No applications yet.</p>}</div>
}

export default function Analytics() {
  const applications = useWorkspace(state => state.applications)
  const savedJobs = useWorkspace(state => state.savedJobs)
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const metrics = getMetrics(applications)
  const openEditor = useUI(state => state.openEditor)
  const rate = (value: number) => metrics.total ? <>{value}<small>%</small></> : <span aria-label="Not enough data">—</span>
  const responseDays = applications.flatMap(app => {
    const first = app.timeline.filter(event => event.type === 'status' && event.status && event.status !== 'APPLIED' && Date.parse(event.at) >= Date.parse(`${app.dateApplied}T00:00:00`)).sort((a, b) => a.at.localeCompare(b.at))[0]
    return first ? [(Date.parse(first.at) - Date.parse(`${app.dateApplied}T00:00:00`)) / 86400000] : []
  })
  const averageResponse = responseDays.length ? `${Math.round(responseDays.reduce((sum, days) => sum + days, 0) / responseDays.length * 10) / 10} days` : 'Not enough data yet'
  return <>
    <PageHeading title="Analytics" action={<span className="all-time-pill"><BarChart3 size={16} />All time</span>} />
    <section className="stats-grid analytics-stats" aria-label="Conversion statistics">
      <div className="stat-card"><div className="stat-top"><span>Applications sent</span></div><strong className="stat-value">{metrics.total}</strong><p>{metrics.thisWeek} this week · {metrics.thisMonth} this month</p></div>
      <div className="stat-card"><div className="stat-top"><span>Interview conversion</span></div><strong className="stat-value">{rate(metrics.interviewRate)}</strong><p>{metrics.interviews} of {metrics.total} reached an interview</p></div>
      <div className="stat-card"><div className="stat-top"><span>Offer conversion</span></div><strong className="stat-value">{rate(metrics.offerRate)}</strong><p>{metrics.offers} of {metrics.total} reached an offer</p></div>
      <div className="stat-card"><div className="stat-top"><span>Rejection rate</span></div><strong className="stat-value">{rate(metrics.rejectionRate)}</strong><p>{metrics.rejections} of {metrics.total} currently closed</p></div>
    </section>
    <div className="analytics-explainer"><p>Conversion includes applications that later moved to another stage.</p></div>
    <section className="panel search-funnel"><div className="panel-heading"><div><h2>Job search funnel</h2></div></div><div className="funnel-steps"><div><span>Saved now</span><strong>{savedJobs.length}</strong></div><div><span>Applied</span><strong>{metrics.total}</strong></div><div><span>Reached interview</span><strong>{metrics.interviews}</strong></div><div><span>Reached offer</span><strong>{metrics.offers}</strong></div></div><p className="muted">Saved is the current wishlist, separate from the historical application conversion rates.</p></section>
    <section className="panel response-insight"><h2>First recorded response</h2><strong>{averageResponse}</strong><p className="muted">From application date to the first recorded status change, across {responseDays.length} applications. Entries without a recorded response are excluded.</p></section>
    {!applications.length && <EmptyState title="No activity yet" description="Add a few applications to see your job-search trends." action={<Button onClick={() => openEditor()}>Add application</Button>} />}
    <div className="dashboard-chart-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Application activity</h2></div><div className="segmented-control" aria-label="Activity period"><button aria-pressed={period === 'weekly'} onClick={() => setPeriod('weekly')}>Weekly</button><button aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>Monthly</button></div></div><ActivityChart applications={applications} period={period} /><div className="chart-footnote"><span className="legend-dot" />Applications sent<span>{period === 'weekly' ? 'Last 8 weeks' : 'Last 6 months'}</span></div></section><section className="panel pipeline-panel"><div className="panel-heading"><div><h2>Current pipeline</h2></div></div><StatusChart applications={applications} /></section></div>
    <div className="analytics-breakdown-grid"><section className="panel"><div className="panel-heading"><div><h2>By location</h2></div></div><Breakdown applications={applications} field="location" /></section><section className="panel"><div className="panel-heading"><div><h2>By employment type</h2></div></div><Breakdown applications={applications} field="employmentType" /></section></div>
    <section className="panel source-breakdown"><div className="panel-heading"><div><h2>By source</h2></div></div><Breakdown applications={applications} field="source" /></section>
  </>
}
