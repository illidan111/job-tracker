import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/EmptyState'
export default function NotFound() {
  return <EmptyState title="A little off the beaten path" description="This page doesn’t exist. Let’s get you back to your next chapter." action={<Link to="/" className="button button-primary">Back to overview</Link>} />
}
