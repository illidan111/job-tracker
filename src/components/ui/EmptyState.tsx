import { FolderSearch } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><FolderSearch size={26} strokeWidth={1.5} /></span><h3>{title}</h3><p>{description}</p>{action}</div>
}
