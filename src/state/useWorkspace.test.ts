import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoApplications } from '../data/demo'
import type { Workspace } from '../types/application'
import { api, RequestError } from '../utils/api'
import { useWorkspace } from './useWorkspace'

vi.mock('../utils/api', async importOriginal => ({ ...await importOriginal<typeof import('../utils/api')>(), api: vi.fn() }))
const request = vi.mocked(api)
const application = createDemoApplications()[0]
const workspace: Workspace = {
  user: { id: 'owner', email: 'owner@example.test' },
  profile: { name: 'Owner', email: 'owner@example.test', headline: '', weeklyGoal: 8, appearance: 'system', interviewReminders: true },
  applications: [application], contacts: [], notifications: [],
}

beforeEach(() => {
  request.mockReset()
  useWorkspace.setState({ ...useWorkspace.getInitialState(), ...workspace, phase: 'authenticated' })
})

describe('workspace mutation recovery', () => {
  it('keeps a saved status when reminder refresh fails and makes the failure visible', async () => {
    const saved = { ...application, status: 'OFFER' as const, version: application.version + 1 }
    request.mockResolvedValueOnce(saved).mockRejectedValueOnce(new RequestError(503, 'Refresh unavailable'))
    expect(await useWorkspace.getState().changeStatus(application.id, 'OFFER')).toBe(true)
    expect(useWorkspace.getState()).toMatchObject({ applications: [saved], storageError: 'Refresh unavailable', pending: false })
  })
  it('clears private state if the session expires during post-save refresh', async () => {
    request.mockResolvedValueOnce({ ...application, status: 'OFFER' }).mockRejectedValueOnce(new RequestError(401, 'Session expired'))
    expect(await useWorkspace.getState().changeStatus(application.id, 'OFFER')).toBe(false)
    expect(useWorkspace.getState()).toMatchObject({ phase: 'anonymous', applications: [], user: null, pending: false })
  })
  it('clears private state if conflict recovery discovers a revoked session', async () => {
    request.mockRejectedValueOnce(new RequestError(409, 'Changed elsewhere')).mockRejectedValueOnce(new RequestError(401, 'Session expired'))
    expect(await useWorkspace.getState().changeStatus(application.id, 'OFFER')).toBe(false)
    expect(useWorkspace.getState()).toMatchObject({ phase: 'anonymous', applications: [], user: null, pending: false })
  })
})
