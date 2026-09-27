import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BarChart3, Bell, BriefcaseBusiness, ChevronRight, LayoutDashboard, LogOut, Menu, PanelsTopLeft, Plus, Search, Settings, X } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { useAppearance } from '../hooks/useAppearance'
import { getMetrics } from '../utils/applications'
import { formatDate, formatDateTime } from '../utils/dates'
import { ApplicationForm } from '../components/ApplicationForm'
import { Toasts } from '../components/Toasts'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/kanban', label: 'Kanban board', icon: PanelsTopLeft },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function AppLayout() {
  useAppearance()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [search, setSearch] = useState('')
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const applications = useWorkspace(state => state.applications)
  const profile = useWorkspace(state => state.profile)
  const storageError = useWorkspace(state => state.storageError)
  const editor = useUI(state => state.editor)
  const openEditor = useUI(state => state.openEditor)
  const metrics = getMetrics(applications)
  const reminders = useWorkspace(state => state.notifications)
  const pending = useWorkspace(state => state.pending)
  const unread = reminders.filter(item => !item.readAt).length
  const pageHasAddAction = ['/applications', '/kanban'].includes(location.pathname)
  const currentPage = location.pathname.startsWith('/applications/') ? 'Application details' : [...navigation, { to: '/settings', label: 'Settings' }].find(item => item.to === location.pathname)?.label ?? 'Workspace'
  useEffect(() => {
    document.title = `${currentPage} — Waypoint`
    if (previousPath.current !== location.pathname) {
      main.current?.focus()
      window.scrollTo(0, 0)
      previousPath.current = location.pathname
    }
  }, [currentPage, location.pathname])

  const navContent = <>
    <NavLink to="/" className="brand" onClick={() => setMobileOpen(false)} aria-label="Waypoint home"><span className="brand-mark"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m10 12 5 17 5-11 5 11 5-17" /></svg></span><span>waypoint<span className="brand-dot">.</span></span></NavLink>
    <nav aria-label="Main navigation">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={19} strokeWidth={1.8} /><span>{label}</span>{to === '/applications' && <span className="nav-count">{applications.length}</span>}</NavLink>)}</nav>
    <div className="sidebar-bottom">
      <div className="weekly-goal"><div className="goal-heading"><h3>Weekly goal</h3><span>{metrics.thisWeek} / {profile.weeklyGoal}</span></div><div className="progress-track" role="progressbar" aria-label="Weekly application goal" aria-valuenow={Math.min(metrics.thisWeek, profile.weeklyGoal)} aria-valuemin={0} aria-valuemax={profile.weeklyGoal}><span style={{ width: `${Math.min(100, metrics.thisWeek / profile.weeklyGoal * 100)}%` }} /></div><NavLink to="/settings" onClick={() => setMobileOpen(false)}>Edit goal <ArrowUpRight size={14} /></NavLink></div>
      <NavLink to="/settings" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link settings-link ${isActive ? 'active' : ''}`}><Settings size={19} strokeWidth={1.8} /><span>Settings</span></NavLink>
      <NavLink to="/settings" onClick={() => setMobileOpen(false)} className="profile-link"><span className="avatar">{profile.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span><span><strong>{profile.name}</strong></span><ChevronRight size={15} /></NavLink>
      <button className="nav-link logout-link" disabled={pending} onClick={() => void useWorkspace.getState().logout()}><LogOut size={18} /><span>Sign out</span></button>
    </div>
  </>

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar">{navContent}</aside>
    {mobileOpen && <Dialog title="Navigation" onClose={() => setMobileOpen(false)} className="mobile-nav-dialog"><div className="mobile-nav-content">{navContent}</div></Dialog>}
    <div className="main-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
        <div className="breadcrumb"><strong>{currentPage}</strong></div>
        <div className="topbar-actions">
          {location.pathname !== '/applications' && <form className="global-search" onSubmit={event => { event.preventDefault(); navigate(`/applications${search ? `?q=${encodeURIComponent(search)}` : ''}`); setSearch('') }}><Search size={16} /><input aria-label="Search workspace" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an application…" /><kbd aria-hidden="true">↵</kbd></form>}
          <button className="icon-button notification-button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => setNotifications(true)}><Bell size={19} />{unread > 0 && <span className="notification-dot" />}</button>
          {!pageHasAddAction && <Button variant="secondary" size="sm" aria-label="Add application" onClick={() => openEditor()}><Plus size={17} /><span className="header-add-label">Add application</span></Button>}
        </div>
      </header>
      <main id="main-content" ref={main} tabIndex={-1} className="page-content">
        {storageError && <div className="storage-alert" role="alert"><strong>Something needs your attention</strong><p>{storageError}</p><button className="text-link" onClick={() => { useWorkspace.getState().dismissError(); void useWorkspace.getState().refresh() }}>Refresh workspace</button></div>}
        <Outlet />
        {(pending || storageError) && <footer className="page-footer" role="status"><span><span className="local-dot" />{pending ? 'Saving changes…' : 'Check the message above'}</span></footer>}
      </main>
    </div>
    {editor && <ApplicationForm key={editor.id ?? `new-${editor.status}`} />}
    {notifications && <Dialog title="Your reminders" description="Interviews in the next 48 hours and follow-ups that are due." onClose={() => setNotifications(false)} className="confirm-dialog">
      {storageError && <p className="form-error" role="alert">{storageError}</p>}
      <div className="notification-list">{reminders.length ? reminders.map(item => <div className={item.readAt ? 'notification-row read' : 'notification-row'} key={item.id}><button onClick={() => { void useWorkspace.getState().readNotification(item.id); setNotifications(false); navigate(`/applications/${item.applicationId}`) }}><span><strong>{item.title}</strong><small>{item.message}</small><small>{item.kind === 'followup' ? formatDate(item.dueAt, { month: 'short', day: 'numeric', year: 'numeric' }) : formatDateTime(item.dueAt)}</small></span><ChevronRight size={16} /></button>{!item.readAt && <button className="text-link mark-read" disabled={pending} aria-label={`Mark ${item.title} as read`} onClick={() => void useWorkspace.getState().readNotification(item.id)}>Mark as read</button>}</div>) : <p className="muted">No reminders due.</p>}</div>
      <div className="dialog-actions">{unread > 0 && <Button variant="secondary" disabled={pending} onClick={() => void useWorkspace.getState().readNotification()}>Mark all as read</Button>}<Button variant="secondary" onClick={() => setNotifications(false)}><X size={15} />Close</Button></div>
    </Dialog>}
    <Toasts />
  </div>
}
