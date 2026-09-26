import { useRef, useState } from 'react'
import { Bell, Check, Download, HardDrive, Laptop, Moon, RotateCcw, ShieldCheck, Sun, Trash2, Upload, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Application, Profile } from '../types/application'
import { profileSchema } from '../validation/application'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { exportApplications, parseImport, readLegacyApplications, STORAGE_KEY } from '../utils/storage'
import { dateKey } from '../utils/dates'
import { PageHeading } from '../components/PageHeading'
import { Field } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/Dialog'

function ProfileForm() {
  const profile = useWorkspace(state => state.profile)
  const updateProfile = useWorkspace(state => state.updateProfile)
  const toast = useUI(state => state.toast)
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<Profile>({ resolver: zodResolver(profileSchema), defaultValues: profile })
  return <form onSubmit={handleSubmit(async values => { const merged = { ...useWorkspace.getState().profile, name: values.name, email: values.email, headline: values.headline, weeklyGoal: values.weeklyGoal }; if (await updateProfile(merged)) { reset(merged); toast('Profile saved') } })} noValidate>
    <div className="settings-section-heading"><span className="settings-section-icon"><UserRound size={19} /></span><div><h2>Your profile</h2><p>A workspace that feels like you.</p></div></div>
    <div className="profile-settings-body"><div className="profile-avatar-large">{profile.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</div><div className="form-grid"><Field label="Full name" error={errors.name?.message}>{props => <input {...props} {...register('name')} autoComplete="name" />}</Field><Field label="Email" error={errors.email?.message} hint="Your sign-in email.">{props => <input {...props} {...register('email')} type="email" readOnly autoComplete="email" placeholder="you@example.com" />}</Field><Field label="Career focus" error={errors.headline?.message}>{props => <input {...props} {...register('headline')} placeholder="What’s your next chapter?" />}</Field><Field label="Weekly application goal" error={errors.weeklyGoal?.message}>{props => <input {...props} {...register('weeklyGoal', { valueAsNumber: true })} type="number" min="1" max="100" />}</Field></div></div>
    <div className="settings-form-actions"><span>{isDirty ? 'You have unsaved profile changes.' : 'Your profile is saved to your account.'}</span><Button type="submit" disabled={!isDirty || isSubmitting} size="sm">Save profile</Button></div>
  </form>
}

export default function Settings() {
  const applications = useWorkspace(state => state.applications)
  const profile = useWorkspace(state => state.profile)
  const updateProfile = useWorkspace(state => state.updateProfile)
  const replaceApplications = useWorkspace(state => state.replaceApplications)
  const toast = useUI(state => state.toast)
  const [confirmation, setConfirmation] = useState<'clear' | 'reset' | 'import' | null>(null)
  const [pendingImport, setPendingImport] = useState<Application[] | null>(null)
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const pending = useWorkspace(state => state.pending)
  const serverError = useWorkspace(state => state.storageError)
  const [hasLegacy] = useState(() => { try { return Boolean(localStorage.getItem(STORAGE_KEY)) } catch { return false } })
  const fileRef = useRef<HTMLInputElement>(null)
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportApplications(applications)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `waypoint-applications-${dateKey()}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast(`Exported ${applications.length} applications`)
  }
  const importFile = async (file?: File) => {
    setImportError('')
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setImportError('Choose a JSON file smaller than 5 MB. Your existing data is unchanged.'); return }
    setImporting(true)
    try {
      const data = parseImport(await file.text())
      setPendingImport(data)
      setConfirmation('import')
    } catch {
      setImportError('We couldn’t read this backup. Choose a valid Waypoint JSON export with unique application IDs, valid dates, and valid statuses. Your existing data is unchanged.')
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const confirm = async () => {
    if (confirmation === 'clear') { if (!await useWorkspace.getState().clearApplications()) return; toast('All applications cleared') }
    if (confirmation === 'reset') { if (!await useWorkspace.getState().resetDemo()) return; toast('Demo workspace restored') }
    if (confirmation === 'import' && pendingImport) { if (!await replaceApplications(pendingImport)) return; toast(`Imported ${pendingImport.length} applications`); setPendingImport(null) }
    setConfirmation(null)
  }
  return <>
    <PageHeading eyebrow="MAKE YOURSELF AT HOME" title="Your workspace, your way" description="A few thoughtful settings to support your next chapter." />
    <div className="settings-layout"><div className="settings-main">
      <section className="panel settings-panel"><ProfileForm /></section>
      <section className="panel settings-panel"><div className="settings-section-heading"><span className="settings-section-icon"><Sun size={19} /></span><div><h2>Appearance</h2><p>Find a look that works for you.</p></div></div><div className="appearance-options">{([{ value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }, { value: 'system', label: 'System', icon: Laptop }] as const).map(({ value, label, icon: Icon }) => <button key={value} className={`appearance-option ${profile.appearance === value ? 'selected' : ''}`} aria-pressed={profile.appearance === value} disabled={pending} onClick={() => updateProfile({ ...profile, appearance: value })}><div className={`theme-preview preview-${value}`} aria-hidden="true"><span /><div><i /><i /><i /><b /></div></div><span><Icon size={15} />{label}{profile.appearance === value && <Check size={15} />}</span></button>)}</div></section>
      <section className="panel settings-panel"><div className="settings-section-heading"><span className="settings-section-icon"><Bell size={19} /></span><div><h2>Notifications</h2><p>A gentle nudge for what’s coming next.</p></div></div><div className="notification-setting"><div><h3 id="reminder-label">Interview reminders</h3><p id="reminder-description">Show interviews in the next 48 hours. Follow-ups that are due always appear in your reminders while you use the app.</p></div><button className={`switch ${profile.interviewReminders ? 'on' : ''}`} role="switch" disabled={pending} aria-checked={profile.interviewReminders} aria-labelledby="reminder-label" aria-describedby="reminder-description" onClick={() => updateProfile({ ...profile, interviewReminders: !profile.interviewReminders })}><span /></button></div></section>
      <section className="panel settings-panel"><div className="settings-section-heading"><span className="settings-section-icon"><HardDrive size={19} /></span><div><h2>Your data</h2><p>Your applications belong to you. Keep a backup handy.</p></div></div>
        <div className="data-action"><div><h3>Export applications</h3><p>Download all {applications.length} applications and their history as JSON.</p></div><Button variant="secondary" size="sm" onClick={download}><Download size={15} />Export JSON</Button></div>
        <div className="data-action"><div><h3>Import a backup</h3><p>Restore a Waypoint JSON export. Replaces your current applications.</p></div><input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Import applications file" onChange={event => { void importFile(event.target.files?.[0]) }} /><Button variant="secondary" size="sm" disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={15} />{importing ? 'Checking file…' : 'Import JSON'}</Button></div>
        {hasLegacy && <div className="data-action"><div><h3>Bring your browser workspace</h3><p>Review and import applications saved by an earlier version on this device.</p></div><Button variant="secondary" size="sm" onClick={() => { try { const apps = readLegacyApplications(); if (apps) { setPendingImport(apps); setConfirmation('import') } } catch { setImportError('The browser backup could not be read. It has been left untouched.') } }}>Import browser data</Button></div>}
        {importError && <p className="import-error" role="alert">{importError}</p>}
        <div className="data-action"><div><h3>Reset demo data</h3><p>Replace your applications with a fresh set of sample opportunities.</p></div><Button variant="secondary" size="sm" onClick={() => setConfirmation('reset')}><RotateCcw size={15} />Reset demo</Button></div>
        <div className="data-action danger-zone"><div><h3>Clear all applications</h3><p>Permanently remove your applications. Your profile stays as it is.</p></div><Button variant="danger" size="sm" onClick={() => setConfirmation('clear')} disabled={!applications.length}><Trash2 size={15} />Clear data</Button></div>
      </section>
    </div><aside className="settings-aside"><div className="privacy-note"><ShieldCheck size={28} strokeWidth={1.4} /><h2>A little space that’s yours.</h2><p>Your workspace is saved in the Waypoint database and linked to your account. Your applications are only available when you sign in.</p><p>Keep a JSON backup of your applications, interviews, contacts, and timeline. This local installation uses the database on the computer running Waypoint.</p><span className="privacy-badge"><span />Your account · Your data</span></div><p className="settings-version">Waypoint · Made for your next chapter<br />Version 2.0</p></aside></div>
    {confirmation && <ConfirmDialog title={confirmation === 'clear' ? 'Clear all applications?' : confirmation === 'reset' ? 'Start fresh with demo data?' : 'Replace your applications?'} description={confirmation === 'import' ? `Your ${applications.length} current applications will be replaced with ${pendingImport?.length ?? 0} applications from this backup. Export your current data first if you want to keep it.` : confirmation === 'clear' ? `All ${applications.length} applications and their timelines will be permanently deleted. Export a backup first if you want to keep them.` : 'Your current applications will be replaced with realistic sample data. Export a backup first to keep your current applications.'} confirmLabel={confirmation === 'clear' ? 'Clear all applications' : confirmation === 'reset' ? 'Reset demo data' : 'Replace & import'} onClose={() => { setConfirmation(null); setPendingImport(null) }} error={serverError} onConfirm={confirm} danger={confirmation !== 'import'} />}
  </>
}
