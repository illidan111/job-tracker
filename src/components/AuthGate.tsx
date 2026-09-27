import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useWorkspace } from '../state/useWorkspace'
import { Button } from './ui/Button'

export function AuthGate() {
  const phase = useWorkspace(state => state.phase), error = useWorkspace(state => state.storageError)
  const bootstrap = useWorkspace(state => state.bootstrap), location = useLocation()
  useEffect(() => { void bootstrap() }, [bootstrap])
  useEffect(() => {
    if (phase !== 'authenticated') return
    const refresh = () => { if (!document.hidden) void useWorkspace.getState().refresh() }
    const interval = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [phase])
  if (phase === 'loading') return <div className="app-loading" role="status"><span className="loading-spinner" />Getting your workspace ready…</div>
  if (phase === 'error') return <main className="connection-screen"><h1>Your workspace is taking a moment</h1><p role="alert">{error}</p><Button onClick={() => void bootstrap()}>Try again</Button></main>
  if (phase === 'anonymous' && !['/login', '/signup'].includes(location.pathname)) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  if (phase === 'authenticated' && ['/login', '/signup'].includes(location.pathname)) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from?.startsWith('/') && !from.startsWith('//') && !['/login', '/signup'].includes(from) ? from : '/today'} replace />
  }
  return <Outlet />
}
