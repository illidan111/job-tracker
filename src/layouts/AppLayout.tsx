import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Compass, Users, ArrowUpRight, BarChart3, Bell, Bookmark, BriefcaseBusiness, Building2, CalendarDays, CheckSquare, ChevronRight, Command, LayoutDashboard, LogOut, Menu, PanelsTopLeft, Plus, Search, Settings, Sun, X } from 'lucide-react'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { useAppearance } from '../hooks/useAppearance'
import { useResource } from '../hooks/useResource'
import type { Overview } from '../domain/overview'
import { formatDate, formatDateTime } from '../utils/dates'
import { ApplicationForm } from '../components/ApplicationForm'
import { Toasts } from '../components/Toasts'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { Pagination } from '../components/ui/Pagination'
import { RemoteState } from '../components/ui/RemoteState'
import type { PageResult } from '../domain/career'
import type { Notification } from '../types/application'
import { OverviewContext } from '../hooks/useOverview'
import { JourneyContext } from '../hooks/useJourney'
import { ACHIEVEMENTS } from '../domain/journey'
import type { Journey } from '../domain/journey'
import { CommandPalette } from '../components/CommandPalette'

const navigation = [
  { to: '/today', label: 'Today', icon: Sun },
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/saved', label: 'Saved jobs', icon: Bookmark },
  { to: '/kanban', label: 'Kanban board', icon: PanelsTopLeft },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/journey', label: 'Journey', icon: Compass },
]

export function AppLayout() {
  useAppearance()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [search, setSearch] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const globalSearch = useRef<HTMLInputElement>(null)
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  const overview = useResource<Overview>('/overview')
  const journey = useResource<Journey>('/journey')
  const owner = useWorkspace(state => state.user?.id)
  const lastProgress = useRef<{ owner?: string; data: Journey } | null>(null)
  useEffect(() => {
    const data = journey.data, previous = lastProgress.current
    if (!data) return
    if (previous && previous.owner === owner && data.enabled && data.xp > previous.data.xp) {
      const earned = data.achievements.find(item => !previous.data.achievements.some(old => old.id === item.id))
      const message = data.progress.level > previous.data.progress.level ? 'A new waypoint. Level ' + data.progress.level + ' \u00b7 ' + data.progress.title : earned ? 'Achievement earned: ' + (ACHIEVEMENTS.find(item => item.id === earned.id)?.title ?? 'A new step') : '+' + (data.xp - previous.data.xp) + ' XP. Another step forward.'
      useUI.getState().toast(message)
    }
    lastProgress.current = { owner, data }
  }, [journey.data, owner])
  const profile = useWorkspace(state => state.profile)
  const storageError = useWorkspace(state => state.storageError)
  const editor = useUI(state => state.editor)
  const openEditor = useUI(state => state.openEditor)
  const thisWeek = overview.data?.metrics.thisWeek ?? 0
  const cachedReminders = useWorkspace(state => state.notifications)
  const [reminderPage, setReminderPage] = useState(1)
  const reminderQuery = useResource<PageResult<Notification>>(notifications ? '/notifications?page=' + reminderPage : null)
  const reminders = notifications ? reminderQuery.data?.items ?? cachedReminders : cachedReminders
  const pending = useWorkspace(state => state.pending)
  const unread = reminders.filter(item => !item.readAt).length
  const pageHasAddAction = ['/', '/applications', '/kanban', '/saved'].includes(location.pathname)
  const currentPage = location.pathname.startsWith('/applications/') ? 'Application details' : [...navigation, { to: '/settings', label: 'Settings' }].find(item => item.to === location.pathname)?.label ?? 'Workspace'
  useEffect(() => {
    document.title = `${currentPage} — Waypoint`
    if (previousPath.current !== location.pathname) {
      main.current?.focus()
      window.scrollTo(0, 0)
      previousPath.current = location.pathname
    }
  }, [currentPage, location.pathname])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(open => !open); return }
      const target = event.target as HTMLElement
      if (event.ctrlKey || event.metaKey || event.altKey || target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); openEditor(); return }
      if (event.key === '/') { event.preventDefault(); if (location.pathname === '/applications') document.querySelector<HTMLInputElement>('input[aria-label="Search applications"]')?.focus(); else globalSearch.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location.pathname, openEditor])

  const navContent = <>
    <NavLink to="/" className="brand" onClick={() => setMobileOpen(false)} aria-label="Waypoint home"><span className="brand-mark"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m10 12 5 17 5-11 5 11 5-17" /></svg></span><span>waypoint<span className="brand-dot">.</span></span></NavLink>
    <nav aria-label="Main navigation">{[{ label: 'Your day', paths: ['/', '/today'] }, { label: 'Work', paths: ['/applications', '/saved', '/kanban', '/tasks', '/calendar'] }, { label: 'Network', paths: ['/companies', '/contacts'] }, { label: 'Perspective', paths: ['/journey', '/analytics'] }].map(group => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.paths.map(path => navigation.find(item => item.to === path)!).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} strokeWidth={1.7} /><span>{label}</span>{to === '/applications' && <span className="nav-count">{overview.data?.current ?? 0}</span>}</NavLink>)}</div>)}</nav>
    <div className="sidebar-bottom">
      <div className="weekly-goal"><div className="goal-heading"><h3>Weekly goal</h3><span>{thisWeek} / {profile.weeklyGoal}</span></div><div className="progress-track" role="progressbar" aria-label="Weekly application goal" aria-valuenow={Math.min(thisWeek, profile.weeklyGoal)} aria-valuemin={0} aria-valuemax={profile.weeklyGoal}><span style={{ width: `${Math.min(100, thisWeek / profile.weeklyGoal * 100)}%` }} /></div><NavLink to="/settings" onClick={() => setMobileOpen(false)}>Edit goal <ArrowUpRight size={14} /></NavLink></div>
      <NavLink to="/settings" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link settings-link ${isActive ? 'active' : ''}`}><Settings size={19} strokeWidth={1.8} /><span>Settings</span></NavLink>
      <NavLink to="/settings" onClick={() => setMobileOpen(false)} className="profile-link"><span className="avatar">{profile.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span><span><strong>{profile.name}</strong></span><ChevronRight size={15} /></NavLink>
      <button className="nav-link logout-link" disabled={pending} onClick={() => void useWorkspace.getState().logout()}><LogOut size={18} /><span>Sign out</span></button>
    </div>
  </>

  return <OverviewContext.Provider value={overview}><JourneyContext.Provider value={journey}><div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar">{navContent}</aside>
    {mobileOpen && <Dialog title="Navigation" onClose={() => setMobileOpen(false)} className="mobile-nav-dialog"><div className="mobile-nav-content">{navContent}</div></Dialog>}
    <div className="main-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
        <div className="breadcrumb"><strong>{currentPage}</strong></div>
        <div className="topbar-actions">
          {location.pathname !== '/applications' && <form className="global-search" onSubmit={event => { event.preventDefault(); navigate(`/applications${search ? `?q=${encodeURIComponent(search)}` : ''}`); setSearch('') }}><Search size={16} /><input ref={globalSearch} aria-label="Search workspace" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an application…" /><kbd aria-hidden="true">↵</kbd></form>}
          <button className="icon-button palette-button" aria-label="Open command palette" aria-keyshortcuts="Control+K Meta+K" title="Commands (Ctrl/⌘ K)" onClick={() => setPaletteOpen(true)}><Command size={18} /></button>
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
      <RemoteState {...reminderQuery} />{reminderQuery.data && <Pagination result={reminderQuery.data} onPage={setReminderPage} />}
      <div className="notification-list">{reminders.length ? reminders.map(item => <div className={item.readAt ? 'notification-row read' : 'notification-row'} key={item.id}><button onClick={() => { void useWorkspace.getState().readNotification(item.id); setNotifications(false); navigate(`/applications/${item.applicationId}`) }}><span><strong>{item.title}</strong><small>{item.message}</small><small>{item.kind === 'followup' ? formatDate(item.dueAt, { month: 'short', day: 'numeric', year: 'numeric' }) : formatDateTime(item.dueAt)}</small></span><ChevronRight size={16} /></button>{!item.readAt && <button className="text-link mark-read" disabled={pending} aria-label={`Mark ${item.title} as read`} onClick={() => void useWorkspace.getState().readNotification(item.id)}>Mark as read</button>}</div>) : <p className="muted">No reminders due.</p>}</div>
      <div className="dialog-actions">{unread > 0 && <Button variant="secondary" disabled={pending} onClick={() => void useWorkspace.getState().readNotification()}>Mark all as read</Button>}<Button variant="secondary" onClick={() => setNotifications(false)}><X size={15} />Close</Button></div>
    </Dialog>}
    {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    <nav className="bottom-navigation" aria-label="Quick navigation"><NavLink to="/" end><LayoutDashboard size={20} /><span>Home</span></NavLink><NavLink to="/applications"><BriefcaseBusiness size={20} /><span>Work</span></NavLink><NavLink to="/journey"><Compass size={20} /><span>Journey</span></NavLink><button aria-label="More navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /><span>More</span></button></nav>
    <Toasts />
  </div></JourneyContext.Provider></OverviewContext.Provider>
}
