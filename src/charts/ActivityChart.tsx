import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Application } from '../types/application'
import { activityData } from '../utils/applications'

export function ActivityChart({ applications, period = 'weekly' }: { applications: Application[]; period?: 'weekly' | 'monthly' }) {
  const data = useMemo(() => activityData(applications, period), [applications, period])
  return <figure className="activity-figure" aria-label={`Applications over time. ${data.map(item => `${item.label}: ${item.applications}`).join('. ')}`}>
    <div className="activity-chart" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 230 }}>
      <AreaChart data={data} accessibilityLayer={false} margin={{ top: 14, right: 12, bottom: 0, left: -24 }}>
        <defs><linearGradient id={`activity-fill-${period}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4c9277" stopOpacity={0.18} /><stop offset="100%" stopColor="#4c9277" stopOpacity={0.015} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickMargin={12} minTickGap={20} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickMargin={7} domain={[0, 'auto']} />
        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} labelStyle={{ color: 'var(--muted)', marginBottom: 5 }} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
        <Area name="Applications" type="monotone" dataKey="applications" stroke="#3b8969" strokeWidth={2.5} fill={`url(#activity-fill-${period})`} activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--surface)' }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer></div>
  </figure>
}
