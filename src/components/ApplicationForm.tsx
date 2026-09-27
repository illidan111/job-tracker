import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BriefcaseBusiness, ChevronDown, Plus, Save } from 'lucide-react'
import { applicationFormSchema } from '../validation/application'
import type { ApplicationFormValues } from '../validation/application'
import { EMPLOYMENT_TYPES, STATUSES, STATUS_META, WORK_MODES } from '../types/application'
import { useWorkspace } from '../state/useWorkspace'
import { useUI } from '../state/useUI'
import { dateKey, localDateTime } from '../utils/dates'
import { Dialog, ConfirmDialog } from './ui/Dialog'
import { Field } from './ui/Field'
import { Button } from './ui/Button'

export function ApplicationForm() {
  const editor = useUI(state => state.editor)
  const closeEditor = useUI(state => state.closeEditor)
  const toast = useUI(state => state.toast)
  const application = useWorkspace(state => state.applications.find(app => app.id === editor?.id))
  const add = useWorkspace(state => state.addApplication)
  const edit = useWorkspace(state => state.editApplication)
  const [discard, setDiscard] = useState(false)
  const [version, setVersion] = useState(application?.version)
  const serverError = useWorkspace(state => state.storageError)
  const extraFields = useRef<HTMLDetailsElement>(null)
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: application ? { ...application, salary: application.salary === undefined ? '' : String(application.salary), tags: application.tags.join(', '), interviewDate: localDateTime(application.interviewDate) } : {
      company: '', position: '', location: '', salary: '', employmentType: 'Full-time',
      status: editor?.status ?? 'APPLIED', dateApplied: dateKey(), jobUrl: '', recruiter: '',
      recruiterEmail: '', interviewDate: '', notes: '', tags: '', workMode: 'Not specified', followUpDate: '',
    },
  })
  const requestClose = () => { if (!isSubmitting) { if (isDirty) setDiscard(true); else closeEditor() } }
  const onSubmit = async (values: ApplicationFormValues) => {
    const input = {
      ...values,
      salary: values.salary === '' ? undefined : Number(values.salary),
      tags: [...new Set(values.tags.split(',').map(tag => tag.trim()).filter(Boolean))],
      interviewDate: values.interviewDate ? new Date(values.interviewDate).toISOString() : '',
    }
    if (editor?.id && !application) return
    const saved = application ? await edit(application.id, input, version) : await add(input)
    if (!saved) { setVersion(useWorkspace.getState().applications.find(app => app.id === application?.id)?.version); return }
    toast(application ? 'Application updated' : `${input.company} added`)
    closeEditor()
  }
  return <>
    <Dialog title={application ? 'Edit application' : 'Add application'} onClose={requestClose} className="application-dialog">
      <form onSubmit={event => { void handleSubmit(onSubmit, errors => {
        if (['recruiter', 'recruiterEmail', 'interviewDate', 'notes', 'tags', 'followUpDate'].some(key => key in errors) && extraFields.current) extraFields.current.open = true
      })(event) }} noValidate>
        <div className="form-body">
          {serverError && <p className="form-error" role="alert">{serverError}</p>}
          {editor?.id && !application && <p className="form-error" role="alert">This application was deleted. Close this form to return to your workspace.</p>}
          <div className="form-section-title"><BriefcaseBusiness size={17} /><h3>Application</h3><span>* Required</span></div>
          <div className="form-grid">
            <Field label="Company *" error={errors.company?.message}>{props => <input {...props} {...register('company')} autoFocus placeholder="e.g. Linear" autoComplete="organization" />}</Field>
            <Field label="Position *" error={errors.position?.message}>{props => <input {...props} {...register('position')} placeholder="e.g. Frontend Engineer" />}</Field>
            <Field label="Status" error={errors.status?.message}>{props => <select {...props} {...register('status')}>{STATUSES.map(status => <option key={status} value={status}>{STATUS_META[status].label}</option>)}</select>}</Field>
            <Field label="Date applied *" error={errors.dateApplied?.message}>{props => <input {...props} {...register('dateApplied')} type="date" />}</Field>
          </div>
          <h3 className="form-subheading">Role details</h3>
          <div className="form-grid">
            <Field label="Location" error={errors.location?.message}>{props => <input {...props} {...register('location')} placeholder="City or Remote" />}</Field>
            <Field label="Work arrangement" error={errors.workMode?.message}>{props => <select {...props} {...register('workMode')}>{WORK_MODES.map(mode => <option key={mode}>{mode}</option>)}</select>}</Field>
            <Field label="Annual salary (USD)" error={errors.salary?.message}>{props => <input {...props} {...register('salary')} inputMode="decimal" placeholder="e.g. 120000" />}</Field>
            <Field label="Employment type" error={errors.employmentType?.message}>{props => <select {...props} {...register('employmentType')}>{EMPLOYMENT_TYPES.map(type => <option key={type}>{type}</option>)}</select>}</Field>
            <Field label="Job URL" error={errors.jobUrl?.message} className="full-width">{props => <input {...props} {...register('jobUrl')} type="url" placeholder="https://company.com/careers/…" />}</Field>
          </div>
          <details ref={extraFields} className="form-details" open={Boolean(application)}>
            <summary>People, interviews & notes <ChevronDown size={16} /></summary>
            <div className="form-grid">
              <Field label="Recruiter" error={errors.recruiter?.message}>{props => <input {...props} {...register('recruiter')} placeholder="Full name" />}</Field>
              <Field label="Recruiter email" error={errors.recruiterEmail?.message}>{props => <input {...props} {...register('recruiterEmail')} type="email" placeholder="recruiter@company.com" />}</Field>
              <Field label="Interview date & time" error={errors.interviewDate?.message} hint="In your current timezone.">{props => <input {...props} {...register('interviewDate')} type="datetime-local" />}</Field>
              <Field label="Tags" error={errors.tags?.message} hint="Separate tags with commas. Up to 10.">{props => <input {...props} {...register('tags')} placeholder="React, Remote, Dream role" />}</Field>
              <Field label="Follow up on" error={errors.followUpDate?.message}>{props => <input {...props} {...register('followUpDate')} type="date" />}</Field>
              <Field label="Notes" error={errors.notes?.message} className="full-width">{props => <textarea {...props} {...register('notes')} rows={4} placeholder="Notes, links, and questions…" />}</Field>
            </div>
          </details>
          {Object.keys(errors).length > 0 && <p className="field-error" role="alert">Please check the highlighted fields. Additional fields are under “People, interviews & notes”.</p>}
        </div>
        <div className="dialog-actions"><Button type="button" variant="secondary" onClick={requestClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{application ? <Save size={16} /> : <Plus size={17} />}{application ? 'Save changes' : 'Add application'}</Button></div>
      </form>
    </Dialog>
    {discard && <ConfirmDialog title="Discard your changes?" description="Your unsaved changes will be lost." confirmLabel="Discard changes" onConfirm={closeEditor} onClose={() => setDiscard(false)} />}
  </>
}
