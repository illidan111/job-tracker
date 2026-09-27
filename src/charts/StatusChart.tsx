import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import type { Application, Status } from '../types/application'
import { STATUSES, STATUS_META } from '../types/application'

export function StatusChart({ applications = [], counts }: { applications?: Application[]; counts?: Record<Status, number> }) {
  const data = STATUSES.map(status => ({ name: STATUS_META[status].label, status, value: counts?.[status] ?? applications.filter(app => app.status === status).length, color: STATUS_META[status].color }))
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return <div className="status-chart-content">
    <div className="donut-wrap" role="img" aria-label={`${total} total applications. ${data.map(item => `${item.name}: ${item.value}`).join('. ')}`}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 180, height: 180 }}><PieChart><Pie data={total ? data : [{ name: 'No applications', value: 1, color: 'var(--border)' }]} dataKey="value" cx="50%" cy="50%" innerRadius="73%" outerRadius="94%" paddingAngle={total ? 4 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>{(total ? data : [{ color: 'var(--border)' }]).map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie></PieChart></ResponsiveContainer>
      <div className="donut-label"><strong>{total}</strong><span>applications</span></div>
    </div>
    <div className="status-legend">{data.map(item => <Link to={`/applications?status=${item.status}`} key={item.status}><span className="legend-dot" style={{ backgroundColor: item.color }} /><span>{item.name}</span><strong>{item.value}</strong><small>{total ? `${Math.round(item.value / total * 100)}%` : '—'}</small></Link>)}</div>
  </div>
}
