import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import type { SearchResult } from '../domain/career'
import { useDebounced, useResource } from '../hooks/useResource'
import { useUI } from '../state/useUI'
import { Dialog } from './ui/Dialog'
import { RemoteState } from './ui/RemoteState'

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(''), navigate = useNavigate()
  const settled = useDebounced(query)
  const results = useResource<SearchResult[]>(settled.trim().length >= 2 ? `/search?q=${encodeURIComponent(settled.trim())}` : null)
  const commands = [
    { label: 'Add application', run: () => useUI.getState().openEditor() },
    ...[['Open Today', '/today'], ['Open calendar', '/calendar'], ['Open tasks', '/tasks'], ['Open companies', '/companies'], ['Open saved jobs', '/saved'], ['Search applications', '/applications'], ['Open home', '/'], ['Open Journey', '/journey'], ['Open applications', '/applications'], ['Open Kanban board', '/kanban'], ['Open analytics', '/analytics'], ['Open settings and weekly goal', '/settings']].map(([label, path]) => ({ label, run: () => navigate(path) })),
  ].filter(command => command.label.toLowerCase().includes(query.trim().toLowerCase()))
  return <Dialog title="Commands" description="Find commands, applications, companies, contacts, tasks and notes." onClose={onClose} className="command-dialog"><div className="command-search"><Search size={18} /><input autoFocus aria-label="Search commands" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your career workspace…" onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); document.querySelector<HTMLButtonElement>('.command-results button')?.focus() } }} /></div>
    <div className="command-results">{commands.length > 0 && <section><h3>Commands</h3>{commands.map(command => <button key={command.label} onClick={() => { onClose(); command.run() }}>{command.label}<ChevronRight size={16} /></button>)}</section>}
      {settled.trim().length >= 2 && (!results.data ? <RemoteState {...results} /> : <>{['Applications', 'Companies', 'Contacts', 'Tasks', 'Notes', 'Saved jobs'].map(group => {
        const entries = (results.data ?? []).filter(result => result.kind === group)
        return entries.length ? <section key={group}><h3>{group}</h3>{entries.map(item => <button key={item.id} onClick={() => { onClose(); navigate(item.href) }}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={16} /></button>)}</section> : null
      })}{!results.data.length && !commands.length && <p className="muted">No results for this search.</p>}</>)}
    </div><p className="command-hint">Ctrl/⌘ K · N adds an application · / focuses search</p></Dialog>
}
