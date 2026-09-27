import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState'
export default function NotFound() {
  return <EmptyState title="Page not found" description="This link is no longer available." action={<Link to="/" className="button button-primary">Back to overview</Link>} />
}
