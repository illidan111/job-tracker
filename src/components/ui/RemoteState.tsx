import { Button } from './Button'

export function RemoteState({ error, retry, loading = true }: { error?: string; retry: () => void; loading?: boolean }) {
  if (!error && !loading) return null
  return error ? <div className="remote-state"><p role="alert">{error}</p><Button variant="secondary" size="sm" onClick={retry}>Try again</Button></div> : <p className="remote-state muted" role="status">Loading…</p>
}
