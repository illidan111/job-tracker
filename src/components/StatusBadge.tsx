import { STATUS_META } from '../types/application'
import type { Status } from '../types/application'

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge ${STATUS_META[status].className}`}><span />{STATUS_META[status].label}</span>
}
