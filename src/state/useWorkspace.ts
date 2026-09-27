import { create } from 'zustand'
import type { Application, ApplicationInput, ContactInput, InterviewInput, Profile, SavedJob, SavedJobInput, Status, Workspace } from '../types/application'
import { api, RequestError } from '../utils/api'
import { useUI } from './useUI'
import { useQueryRevision } from './queryRevision'
import type { CareerBackup } from '../domain/career'

const blankProfile: Profile = { name: '', email: '', headline: '', weeklyGoal: 8, appearance: 'system', interviewReminders: true }
const empty = { user: null, applications: [], savedJobs: [], contacts: [], notifications: [], profile: blankProfile }
interface WorkspaceState extends Omit<Workspace, 'user'> {
  user: Workspace['user'] | null
  phase: 'loading' | 'authenticated' | 'anonymous' | 'error'
  storageError: string | null
  authError: string | null
  pending: boolean
  moving: { id: string; status: Status } | null
  bootstrap: () => Promise<void>
  refresh: () => Promise<void>
  loadApplication: (id: string) => Promise<boolean>
  authenticate: (mode: 'login' | 'signup', input: { email: string; password: string; name?: string }) => Promise<boolean>
  logout: () => Promise<boolean>
  dismissError: () => void
  sessionExpired: (message: string) => void
  addApplication: (input: ApplicationInput) => Promise<boolean>
  editApplication: (id: string, input: ApplicationInput, version?: number) => Promise<boolean>
  changeStatus: (id: string, status: Status) => Promise<boolean>
  deleteApplication: (id: string) => Promise<boolean>
  createSavedJob: (input: SavedJobInput) => Promise<boolean>
  updateSavedJob: (id: string, input: SavedJobInput, version: number) => Promise<boolean>
  deleteSavedJob: (id: string, version: number) => Promise<boolean>
  applySavedJob: (id: string, version: number, dateApplied: string) => Promise<boolean>
  bulkApplications: (ids: string[], action: 'status' | 'addTag' | 'removeTag' | 'archive' | 'restore' | 'delete', value?: string) => Promise<boolean>
  replaceApplications: (applications: Application[], savedJobs?: SavedJob[], career?: CareerBackup) => Promise<boolean>
  resetDemo: () => Promise<boolean>
  clearApplications: () => Promise<boolean>
  updateProfile: (profile: Profile) => Promise<boolean>
  saveInterview: (id: string, input: InterviewInput, interviewId?: string, version?: number) => Promise<boolean>
  deleteInterview: (id: string, interviewId: string) => Promise<boolean>
  saveFollowUp: (id: string, date: string, complete: boolean, reason?: string, note?: string) => Promise<boolean>
  attachContact: (id: string, value: { contactId: string } | { contact: ContactInput }) => Promise<boolean>
  editContact: (id: string, input: ContactInput, version: number, applicationId?: string) => Promise<boolean>
  detachContact: (id: string, contactId: string) => Promise<boolean>
  readNotification: (id?: string) => Promise<boolean>
}
let epoch = 0, bootstrapRequest: Promise<void> | null = null, refreshing = false
export const useWorkspace = create<WorkspaceState>((set, get) => {
  const expire = (message: string | null) => { epoch++; useUI.setState({ editor: null, toasts: [], recent: [] }); set({ ...empty, phase: 'anonymous', pending: false, moving: null, authError: message, storageError: null }) }
  const failed = async (error: unknown) => {
    if (error instanceof RequestError && error.status === 401) { expire(error.message); return }
    const message = error instanceof Error ? error.message : 'Please try again.'
    set({ storageError: message })
    if (error instanceof RequestError && [404, 409].includes(error.status)) {
      const current = epoch
      try { const workspace = await api<Workspace>('/workspace'); if (current === epoch) set(workspace) }
      catch (refreshError) { if (current === epoch && refreshError instanceof RequestError && refreshError.status === 401) expire(refreshError.message) }
    }
  }
  const version = (id: string) => get().applications.find(app => app.id === id)?.version ?? 1
  const mutate = async (operation: () => Promise<void>, rollback?: () => void) => {
    if (get().pending) { set({ storageError: 'A change is still saving. Please try again in a moment.' }); return false }
    const current = ++epoch
    set({ pending: true, storageError: null })
    try { await operation(); useQueryRevision.getState().invalidate(); return current === epoch }
    catch (error) { if (current === epoch) { rollback?.(); await failed(error) } return false }
    finally { if (current === epoch) set({ pending: false, moving: null }) }
  }
  const full = (path: string, method: string, input: unknown, applicationId?: string) => mutate(async () => {
    const current = epoch
    const workspace = await api<Workspace>(path, method, input)
    if (applicationId && !workspace.applications.some(app => app.id === applicationId)) {
      const app = await api<Application>(`/applications/${applicationId}`)
      workspace.applications = [app, ...workspace.applications]
    }
    if (current === epoch) set(workspace)
  })
  const record = (id: string, path: string, method: string, input: unknown, optimistic?: Status) => {
    const before = get().applications.find(app => app.id === id)
    return mutate(async () => {
      const current = epoch
      if (optimistic) set({ moving: { id, status: optimistic }, applications: get().applications.map(app => app.id === id ? { ...app, status: optimistic } : app) })
      const saved = await api<Application>(path, method, input)
      if (current === epoch) {
        set({ applications: get().applications.map(app => app.id === id ? saved : app) })
        try { const reminders = await api<{ items: Workspace['notifications'] }>('/notifications'); if (current === epoch) set({ notifications: reminders.items }) }
        catch (error) { if (current === epoch) await failed(error) }
      }
    }, () => { if (before) set({ applications: get().applications.map(app => app.id === id ? before : app) }) })
  }
  return {
    ...empty, moving: null, phase: 'loading', storageError: null, authError: null, pending: false,
    bootstrap: () => {
      if (bootstrapRequest) return bootstrapRequest
      const current = epoch
      set({ phase: 'loading', storageError: null })
      bootstrapRequest = (async () => {
        try { const workspace = await api<Workspace | null>('/auth/session'); if (current === epoch) set(workspace ? { ...workspace, phase: 'authenticated' } : { ...empty, phase: 'anonymous' }) }
        catch (error) { if (current === epoch) set({ phase: 'error', storageError: error instanceof Error ? error.message : 'Unable to load your workspace.' }) }
        finally { bootstrapRequest = null }
      })()
      return bootstrapRequest
    },
    refresh: async () => {
      if (refreshing || get().pending || get().phase !== 'authenticated') return
      refreshing = true
      const current = epoch
      try {
        const workspace = await api<Workspace>('/workspace')
        if (current === epoch && !get().pending) {
          const ids = new Set(workspace.applications.map(app => app.id))
          set({ ...workspace, applications: [...workspace.applications, ...get().applications.filter(app => !ids.has(app.id))].slice(0, 200) })
          useQueryRevision.getState().invalidate()
        }
      }
      catch (error) { if (current === epoch) await failed(error) }
      finally { refreshing = false }
    },
    authenticate: async (mode, input) => {
      if (get().pending) return false
      const current = ++epoch
      set({ pending: true, authError: null })
      try { const workspace = await api<Workspace>(`/auth/${mode}`, 'POST', input); if (current !== epoch) return false; set({ ...workspace, phase: 'authenticated', storageError: null }); return true }
      catch (error) { set({ authError: error instanceof Error ? error.message : 'Unable to sign in.' }); return false }
      finally { if (current === epoch) set({ pending: false }) }
    },
    logout: () => mutate(async () => { await api('/auth/logout', 'POST', {}); expire(null) }).then(() => get().phase === 'anonymous'),
    dismissError: () => set({ storageError: null }),
    sessionExpired: message => { if (get().phase === 'authenticated') expire(message) },
    loadApplication: async id => {
      const owner = get().user?.id
      try {
        const app = await api<Application>(`/applications/${id}`)
        if (owner !== get().user?.id) return false
        if ((get().applications.find(item => item.id === id)?.version ?? 0) > app.version) return true
        set({ applications: [app, ...get().applications.filter(item => item.id !== id)].slice(0, 200) })
        return true
      } catch (error) { if (owner === get().user?.id) await failed(error); return false }
    },
    addApplication: input => mutate(async () => { const current = epoch; const app = await api<Application>('/applications', 'POST', input); if (current === epoch) set({ applications: [app, ...get().applications] }) }),
    editApplication: (id, input, expected) => record(id, `/applications/${id}`, 'PUT', { ...input, version: expected ?? version(id) }),
    changeStatus: (id, status) => record(id, `/applications/${id}/status`, 'PATCH', { status, version: version(id) }, status),
    deleteApplication: id => mutate(async () => { const current = epoch; await api(`/applications/${id}`, 'DELETE', { version: version(id) }); if (current === epoch) set({ applications: get().applications.filter(app => app.id !== id), notifications: get().notifications.filter(item => item.applicationId !== id) }) }),
    createSavedJob: input => mutate(async () => { const current = epoch; const job = await api<SavedJob>('/saved-jobs', 'POST', input); if (current === epoch) set({ savedJobs: [job, ...get().savedJobs] }) }),
    updateSavedJob: (id, input, version) => mutate(async () => { const current = epoch; const job = await api<SavedJob>(`/saved-jobs/${id}`, 'PUT', { ...input, version }); if (current === epoch) set({ savedJobs: get().savedJobs.map(item => item.id === id ? job : item) }) }),
    deleteSavedJob: (id, version) => mutate(async () => { const current = epoch; await api(`/saved-jobs/${id}`, 'DELETE', { version }); if (current === epoch) set({ savedJobs: get().savedJobs.filter(job => job.id !== id) }) }),
    applySavedJob: (id, version, dateApplied) => mutate(async () => { const current = epoch; const app = await api<Application>(`/saved-jobs/${id}/apply`, 'POST', { version, dateApplied }); if (current === epoch) set({ savedJobs: get().savedJobs.filter(job => job.id !== id), applications: [app, ...get().applications] }) }),
    bulkApplications: (ids, action, value) => full('/applications/bulk', 'POST', { items: ids.map(id => ({ id, version: version(id) })), action, value }, ids.length === 1 && action !== 'delete' ? ids[0] : undefined),
    replaceApplications: (applications, savedJobs, career) => full('/workspace/import', 'POST', { applications, ...(savedJobs && { savedJobs }), ...(career && { career }) }),
    resetDemo: () => full('/workspace/demo', 'POST', {}),
    clearApplications: () => full('/workspace/clear', 'POST', {}),
    updateProfile: profile => full('/profile', 'PATCH', profile),
    saveInterview: (id, input, interviewId, expected) => record(id, `/applications/${id}/interviews${interviewId ? `/${interviewId}` : ''}`, interviewId ? 'PUT' : 'POST', { ...input, version: expected ?? version(id) }),
    deleteInterview: (id, interviewId) => record(id, `/applications/${id}/interviews/${interviewId}`, 'DELETE', { version: version(id) }),
    saveFollowUp: (id, date, complete, reason = '', note = '') => record(id, `/applications/${id}/follow-up`, 'PATCH', { date, complete, reason, note, version: version(id) }),
    attachContact: (id, value) => full(`/applications/${id}/contacts`, 'POST', { ...value, version: version(id) }, id),
    editContact: (id, input, version, applicationId) => full(`/contacts/${id}`, 'PUT', { ...input, version }, applicationId),
    detachContact: (id, contactId) => full(`/applications/${id}/contacts/${contactId}`, 'DELETE', { version: version(id) }, id),
    readNotification: id => full(id ? `/notifications/${id}/read` : '/notifications/read-all', 'POST', {}),
  }
})
