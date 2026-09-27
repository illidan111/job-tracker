import { useSearchParams } from 'react-router-dom'
import type { Task } from '../domain/career'
import { useResource } from '../hooks/useResource'
import { Tasks as TaskList, TaskForm } from '../components/Tasks'
import { PageHeading } from '../components/PageHeading'
import { RemoteState } from '../components/ui/RemoteState'

export default function TasksPage() {
  const [params, setParams] = useSearchParams()
  const id = params.get('task')
  const selected = useResource<Task>(id ? `/tasks/${encodeURIComponent(id)}` : null)
  return <><PageHeading title="Tasks" /><p className="page-intro">Plan your next steps, with or without an application.</p><TaskList />{id && (selected.data ? <TaskForm key={id} task={selected.data} onClose={() => setParams({})} /> : <RemoteState {...selected} />)}</>
}
