import { create } from 'zustand'
import type { Application, ApplicationInput, ContactInput, InterviewInput, Profile, Status, Workspace } from '../types/application'
import { api, RequestError } from '../utils/api'
import { useUI } from './useUI'

const blankProfile: Profile = { name: '', email: '', headline: '', weeklyGoal: 8, appearance: 'system', interviewReminders: true }
const empty = { user: null, applications: [], contacts: [], notifications: [], profile: blankProfile }
interface WorkspaceState extends Omit<Workspace, 'user'> {
  user: Workspace['user'] | null
  phase: 'loading' | 'authenticated' | 'anonymous' | 'error'
  storageError: string | null
  authError: string | null
  pending: boolean
  bootstrap: () => Promise<void>
  refresh: () => Promise<void>
  authenticate: (mode: 'login' | 'signup', input: { email: string; password: string; name?: string }) => Promise<boolean>
  logout: () => Promise<boolean>
  dismissError: () => void
  addApplication: (input: ApplicationInput) => Promise<boolean>
  editApplication: (id: string, input: ApplicationInput, version?: number) => Promise<boolean>
  changeStatus: (id: string, status: Status) => Promise<boolean>
  deleteApplication: (id: string) => Promise<boolean>
  replaceApplications: (applications: Application[]) => Promise<boolean>
  resetDemo: () => Promise<boolean>
  clearApplications: () => Promise<boolean>
  updateProfile: (profile: Profile) => Promise<boolean>
  saveInterview: (id: string, input: InterviewInput, interviewId?: string, version?: number) => Promise<boolean>
  deleteInterview: (id: string, interviewId: string) => Promise<boolean>
  saveFollowUp: (id: string, date: string, complete: boolean) => Promise<boolean>
  attachContact: (id: string, value: { contactId: string } | { contact: ContactInput }) => Promise<boolean>
  editContact: (id: string, input: ContactInput, version: number) => Promise<boolean>
  detachContact: (id: string, contactId: string) => Promise<boolean>
  readNotification: (id?: string) => Promise<boolean>
}
let epoch = 0, bootstrapRequest: Promise<void> | null = null, refreshing = false
export const useWorkspace = create<WorkspaceState>((set, get) => {
  const expire = (message: string | null) => { epoch++; useUI.setState({ editor: null, toasts: [] }); set({ ...empty, phase: 'anonymous', pending: false, authError: message, storageError: null }) }
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
    try { await operation(); return current === epoch }
    catch (error) { if (current === epoch) { rollback?.(); await failed(error) } return false }
    finally { if (current === epoch) set({ pending: false }) }
  }
  const full = (path: string, method: string, input: unknown) => mutate(async () => { const current = epoch; const workspace = await api<Workspace>(path, method, input); if (current === epoch) set(workspace) })
  const record = (id: string, path: string, method: string, input: unknown, optimistic?: Status) => {
    const before = get().applications.find(app => app.id === id)
    return mutate(async () => {
      const current = epoch
      if (optimistic) set({ applications: get().applications.map(app => app.id === id ? { ...app, status: optimistic } : app) })
      const saved = await api<Application>(path, method, input)
      if (current === epoch) {
        set({ applications: get().applications.map(app => app.id === id ? saved : app) })
        try { const workspace = await api<Workspace>('/workspace'); if (current === epoch) set(workspace) }
        catch (error) { if (current === epoch) await failed(error) }
      }
    }, () => { if (before) set({ applications: get().applications.map(app => app.id === id ? before : app) }) })
  }
  return {
    ...empty, phase: 'loading', storageError: null, authError: null, pending: false,
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
      try { const workspace = await api<Workspace>('/workspace'); if (current === epoch && !get().pending) set(workspace) }
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
    addApplication: input => mutate(async () => { const current = epoch; const app = await api<Application>('/applications', 'POST', input); if (current === epoch) set({ applications: [app, ...get().applications] }) }),
    editApplication: (id, input, expected) => record(id, `/applications/${id}`, 'PUT', { ...input, version: expected ?? version(id) }),
    changeStatus: (id, status) => record(id, `/applications/${id}/status`, 'PATCH', { status, version: version(id) }, status),
    deleteApplication: id => mutate(async () => { const current = epoch; await api(`/applications/${id}`, 'DELETE', { version: version(id) }); if (current === epoch) set({ applications: get().applications.filter(app => app.id !== id), notifications: get().notifications.filter(item => item.applicationId !== id) }) }),
    replaceApplications: applications => full('/workspace/import', 'POST', { applications }),
    resetDemo: () => full('/workspace/demo', 'POST', {}),
    clearApplications: () => full('/workspace/clear', 'POST', {}),
    updateProfile: profile => full('/profile', 'PATCH', profile),
    saveInterview: (id, input, interviewId, expected) => record(id, `/applications/${id}/interviews${interviewId ? `/${interviewId}` : ''}`, interviewId ? 'PUT' : 'POST', { ...input, version: expected ?? version(id) }),
    deleteInterview: (id, interviewId) => record(id, `/applications/${id}/interviews/${interviewId}`, 'DELETE', { version: version(id) }),
    saveFollowUp: (id, date, complete) => record(id, `/applications/${id}/follow-up`, 'PATCH', { date, complete, version: version(id) }),
    attachContact: (id, value) => full(`/applications/${id}/contacts`, 'POST', { ...value, version: version(id) }),
    editContact: (id, input, version) => full(`/contacts/${id}`, 'PUT', { ...input, version }),
    detachContact: (id, contactId) => full(`/applications/${id}/contacts/${contactId}`, 'DELETE', { version: version(id) }),
    readNotification: id => full(id ? `/notifications/${id}/read` : '/notifications/read-all', 'POST', {}),
  }
})
