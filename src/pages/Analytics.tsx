import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useUI } from '../state/useUI'
import { Button } from '../components/ui/Button'
import { useResource } from '../hooks/useResource'
import type { Overview } from '../domain/overview'
import { RemoteState } from '../components/ui/RemoteState'
import { WidgetBoundary } from '../components/WidgetBoundary'
import { PageHeading } from '../components/PageHeading'
import { ActivityChart } from '../charts/ActivityChart'
import { StatusChart } from '../charts/StatusChart'
import { EmptyState } from '../components/ui/EmptyState'

function Breakdown({ entries }: { entries: Overview['breakdown']['location'] }) {
  return <div className="breakdown-list">{entries.length ? entries.map(({ label, count, percent }) => <div className="breakdown-row" key={label}><div><span>{label}</span><strong>{count}<small>{percent}%</small></strong></div><div className="breakdown-track"><span style={{ width: percent + '%' }} /></div></div>) : <p className="muted">No applications yet.</p>}</div>
}

export default function Analytics() {
  const query = useResource<Overview>('/overview')
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const openEditor = useUI(state => state.openEditor)
  if (!query.data) return <><PageHeading title="Analytics" /><RemoteState {...query} /></>
  const { metrics, responseCount, responseAverage, savedCount } = query.data
  const rate = (value: number) => metrics.total ? <>{value}<small>%</small></> : <span aria-label="Not enough data">—</span>
  const averageResponse = responseAverage === null ? 'Not enough data yet' : `${responseAverage} days`
  return <>
    <PageHeading title="Analytics" action={<span className="all-time-pill"><BarChart3 size={16} />All time</span>} />
    <section className="stats-grid analytics-stats" aria-label="Conversion statistics">
      <div className="stat-card"><div className="stat-top"><span>Applications sent</span></div><strong className="stat-value">{metrics.total}</strong><p>{metrics.thisWeek} this week · {metrics.thisMonth} this month</p></div>
      <div className="stat-card"><div className="stat-top"><span>Interview conversion</span></div><strong className="stat-value">{rate(metrics.interviewRate)}</strong><p>{metrics.interviews} of {metrics.total} reached an interview</p></div>
      <div className="stat-card"><div className="stat-top"><span>Offer conversion</span></div><strong className="stat-value">{rate(metrics.offerRate)}</strong><p>{metrics.offers} of {metrics.total} reached an offer</p></div>
      <div className="stat-card"><div className="stat-top"><span>Rejection rate</span></div><strong className="stat-value">{rate(metrics.rejectionRate)}</strong><p>{metrics.rejections} of {metrics.total} currently closed</p></div>
    </section>
    <div className="analytics-explainer"><p>Conversion includes applications that later moved to another stage.</p></div>
    <section className="panel search-funnel"><div className="panel-heading"><div><h2>Job search funnel</h2></div></div><div className="funnel-steps"><div><span>Saved now</span><strong>{savedCount}</strong></div><div><span>Applied</span><strong>{metrics.total}</strong></div><div><span>Reached interview</span><strong>{metrics.interviews}</strong></div><div><span>Reached offer</span><strong>{metrics.offers}</strong></div></div><p className="muted">Saved is the current wishlist, separate from the historical application conversion rates.</p></section>
    <section className="panel response-insight"><h2>First recorded response</h2><strong>{averageResponse}</strong><p className="muted">From application date to the first recorded status change, across {responseCount} applications. Entries without a recorded response are excluded.</p></section>
    {!metrics.total && <EmptyState title="No activity yet" description="Add a few applications to see your job-search trends." action={<Button onClick={() => openEditor()}>Add application</Button>} />}
    <div className="dashboard-chart-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Application activity</h2></div><div className="segmented-control" aria-label="Activity period"><button aria-pressed={period === 'weekly'} onClick={() => setPeriod('weekly')}>Weekly</button><button aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>Monthly</button></div></div><WidgetBoundary><ActivityChart series={query.data[period]} period={period} /></WidgetBoundary><div className="chart-footnote"><span className="legend-dot" />Applications sent<span>{period === 'weekly' ? 'Last 8 weeks' : 'Last 6 months'}</span></div></section><section className="panel pipeline-panel"><div className="panel-heading"><div><h2>Current pipeline</h2></div></div><WidgetBoundary><StatusChart counts={query.data.statuses} /></WidgetBoundary></section></div>
    <div className="analytics-breakdown-grid"><section className="panel"><div className="panel-heading"><div><h2>By location</h2></div></div><Breakdown entries={query.data.breakdown.location} /></section><section className="panel"><div className="panel-heading"><div><h2>By employment type</h2></div></div><Breakdown entries={query.data.breakdown.employmentType} /></section></div>
    <section className="panel source-breakdown"><div className="panel-heading"><div><h2>By source</h2></div></div><Breakdown entries={query.data.breakdown.source} /></section>
  </>
}
