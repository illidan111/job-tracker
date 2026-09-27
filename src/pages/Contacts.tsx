import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Contact } from '../types/application'
import type { PageResult } from '../domain/career'
import { useDebounced, useResource } from '../hooks/useResource'
import { PageHeading } from '../components/PageHeading'
import { RemoteState } from '../components/ui/RemoteState'
import { Pagination } from '../components/ui/Pagination'
import { ContactForm } from '../components/Contacts'
import { Button } from '../components/ui/Button'

export default function Contacts() {
  const [params, setParams] = useSearchParams(), [editing, setEditing] = useState<Contact | null>(null)
  const query = useResource<PageResult<Contact>>('/contacts?' + useDebounced(params.toString()))
  return <><PageHeading title="Contacts" /><p className="page-intro">People from your applications. Unlinking a person keeps their contact details here.</p>
    <label className="career-search">Search contacts<input value={params.get('q') ?? ''} onChange={event => setParams({ q: event.target.value }, { replace: true })} /></label>
    <RemoteState {...query} />{query.data && <><div className="crm-list">{query.data.items.map(item => <article className="panel" key={item.id}><h2>{item.name}</h2><p>{[item.role, item.company].filter(Boolean).join(' · ')}</p>{item.email && <a href={`mailto:${item.email}`}>{item.email}</a>}{item.linkedInUrl && <p><a href={item.linkedInUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a></p>}<p className="detail-notes">{item.notes}</p><Button size="sm" variant="secondary" onClick={() => setEditing(item)}>Edit {item.name}</Button></article>)}</div>{!query.data.total && <p className="muted">No contacts found. Add a contact from an application.</p>}<Pagination result={query.data} onPage={page => setParams({ q: params.get('q') ?? '', page: String(page) })} /></>}
    {editing && <ContactForm contact={editing} onClose={() => setEditing(null)} />}</>
}
