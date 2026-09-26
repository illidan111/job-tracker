import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLink, Mail, Pencil, Plus, Unlink, UserRound } from 'lucide-react'
import type { Application, Contact, ContactInput } from '../types/application'
import { contactInputSchema } from '../validation/application'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { Button } from './ui/Button'
import { ConfirmDialog, Dialog } from './ui/Dialog'
import { Field } from './ui/Field'

function ContactForm({ app, contact, onClose }: { app: Application; contact?: Contact; onClose: () => void }) {
  const contacts = useWorkspace(state => state.contacts), error = useWorkspace(state => state.storageError), pending = useWorkspace(state => state.pending)
  const [existing, setExisting] = useState(''), [discard, setDiscard] = useState(false), [version, setVersion] = useState(contact?.version ?? 1)
  const available = contacts.filter(item => !app.contacts.some(linked => linked.id === item.id))
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<ContactInput>({ resolver: zodResolver(contactInputSchema), defaultValues: contact ?? { name: '', email: '', company: app.company, role: '', linkedInUrl: '', notes: '' } })
  const close = () => { if (!pending) { if (isDirty || existing) setDiscard(true); else onClose() } }
  const saved = (success: boolean) => { if (success) { useUI.getState().toast(contact ? 'Contact updated' : 'Contact added'); onClose() } else setVersion(useWorkspace.getState().contacts.find(item => item.id === contact?.id)?.version ?? version) }
  return <><Dialog title={contact ? 'Edit contact' : 'Add a contact'} description={contact ? 'Updates appear on every application linked to this contact.' : 'Keep the right people close to the opportunity.'} className="application-dialog" onClose={close}>
    <form onSubmit={event => { if (existing) { event.preventDefault(); void useWorkspace.getState().attachContact(app.id, { contactId: existing }).then(saved) } else void handleSubmit(async input => saved(contact ? await useWorkspace.getState().editContact(contact.id, input, version) : await useWorkspace.getState().attachContact(app.id, { contact: input })))(event) }} noValidate>
      <div className="form-body">{!contact && available.length > 0 && <Field label="Use an existing contact">{props => <select {...props} value={existing} onChange={event => setExisting(event.target.value)}><option value="">Create a new contact</option>{available.map(item => <option key={item.id} value={item.id}>{item.name}{item.company ? ` · ${item.company}` : ''}</option>)}</select>}</Field>}
      {!existing && <div className="form-grid contact-form-grid">
        <Field label="Contact name *" error={errors.name?.message}>{props => <input {...props} {...register('name')} autoFocus />}</Field>
        <Field label="Contact email" error={errors.email?.message}>{props => <input {...props} {...register('email')} type="email" />}</Field>
        <Field label="Company" error={errors.company?.message}>{props => <input {...props} {...register('company')} />}</Field>
        <Field label="Role" error={errors.role?.message}>{props => <input {...props} {...register('role')} placeholder="e.g. Talent partner" />}</Field>
        <Field label="LinkedIn URL" error={errors.linkedInUrl?.message} className="full-width">{props => <input {...props} {...register('linkedInUrl')} type="url" placeholder="https://linkedin.com/in/…" />}</Field>
        <Field label="Contact notes" error={errors.notes?.message} className="full-width">{props => <textarea {...props} {...register('notes')} rows={3} placeholder="How you met, or what to remember." />}</Field>
      </div>}{error && <p className="form-error" role="alert">{error}</p>}</div><div className="dialog-actions"><Button type="button" variant="secondary" disabled={pending} onClick={close}>Cancel</Button><Button type="submit" disabled={pending || isSubmitting}>{pending ? 'Saving…' : contact ? 'Save contact' : 'Add contact'}</Button></div>
    </form>
  </Dialog>{discard && <ConfirmDialog title="Discard contact changes?" description="Your unsaved contact details will be lost." confirmLabel="Discard changes" onClose={() => setDiscard(false)} onConfirm={onClose} />}</>
}
export function Contacts({ app }: { app: Application }) {
  const [editing, setEditing] = useState<Contact | 'new' | null>(null), [unlinking, setUnlinking] = useState<Contact | null>(null)
  const error = useWorkspace(state => state.storageError)
  const open = (contact: Contact | 'new') => { useWorkspace.getState().dismissError(); setEditing(contact) }
  return <section className="panel contact-panel"><div className="aside-title"><UserRound size={18} /><h2>Your contacts</h2><button className="icon-button" aria-label="Add contact" onClick={() => open('new')}><Plus size={16} /></button></div>
    {app.contacts.length ? app.contacts.map(item => <article className="contact-row" key={item.id}><div className="contact-name"><strong>{item.name}</strong><button className="icon-button" onClick={() => open(item)} aria-label={`Edit ${item.name}`}><Pencil size={14} /></button><button className="icon-button" onClick={() => { useWorkspace.getState().dismissError(); setUnlinking(item) }} aria-label={`Unlink ${item.name}`}><Unlink size={14} /></button></div>{(item.role || item.company) && <p>{[item.role, item.company].filter(Boolean).join(' · ')}</p>}{item.email && <a className="text-link" href={`mailto:${item.email}`}><Mail size={13} />{item.email}</a>}{item.linkedInUrl && <a className="text-link" href={item.linkedInUrl} target="_blank" rel="noopener noreferrer">LinkedIn <ExternalLink size={12} /></a>}{item.notes && <p className="detail-notes">{item.notes}</p>}</article>) : <p className="muted">Add a recruiter or teammate to make following up easier.</p>}
    {editing && <ContactForm app={app} contact={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {unlinking && <ConfirmDialog title={`Unlink ${unlinking.name}?`} description="This contact will be removed from this application. Their other links and saved details will remain available." confirmLabel="Unlink contact" error={error} onClose={() => setUnlinking(null)} onConfirm={async () => { if (await useWorkspace.getState().detachContact(app.id, unlinking.id)) { useUI.getState().toast('Contact unlinked'); setUnlinking(null) } }} />}
  </section>
}
