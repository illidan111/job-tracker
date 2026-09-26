import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import type { Application } from '../types/application'
import { STATUSES, STATUS_META } from '../types/application'

export function StatusChart({ applications }: { applications: Application[] }) {
  const data = STATUSES.map(status => ({ name: STATUS_META[status].label, status, value: applications.filter(app => app.status === status).length, color: STATUS_META[status].color }))
  return <div className="status-chart-content">
    <div className="donut-wrap" role="img" aria-label={`${applications.length} total applications. ${data.map(item => `${item.name}: ${item.value}`).join('. ')}`}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 180, height: 180 }}><PieChart><Pie data={applications.length ? data : [{ name: 'No applications', value: 1, color: 'var(--border)' }]} dataKey="value" cx="50%" cy="50%" innerRadius="73%" outerRadius="94%" paddingAngle={applications.length ? 4 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>{(applications.length ? data : [{ color: 'var(--border)' }]).map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie></PieChart></ResponsiveContainer>
      <div className="donut-label"><strong>{applications.length}</strong><span>applications</span></div>
    </div>
    <div className="status-legend">{data.map(item => <Link to={`/applications?status=${item.status}`} key={item.status}><span className="legend-dot" style={{ backgroundColor: item.color }} /><span>{item.name}</span><strong>{item.value}</strong><small>{applications.length ? Math.round(item.value / applications.length * 100) : 0}%</small></Link>)}</div>
  </div>
}
