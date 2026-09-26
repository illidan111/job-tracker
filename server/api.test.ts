import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Server } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { createApp } from './app'
import { openDatabase } from './database'
import { hashToken } from './auth'
import { createDemoApplications } from '../src/data/demo'
import type { Application, Workspace } from '../src/types/application'

const origin = 'http://127.0.0.1:5173'
let base = '', server: Server, db: DatabaseSync, directory = ''
const password = 'A deliberate test passphrase!'
class Client {
  cookie = ''
  async request(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
    const response = await fetch(`${base}/api${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: this.cookie, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const cookie of response.headers.getSetCookie()) this.cookie = cookie.split(';')[0]
    return response
  }
  async workspace() { const response = await this.request('/workspace'); expect(response.status).toBe(200); return await response.json() as Workspace }
  async create() { const response = await this.request('/applications', 'POST', { ...createDemoApplications()[0], recruiter: '', recruiterEmail: '', interviewDate: '' }); expect(response.status).toBe(201); return await response.json() as Application }
}
const alice = new Client(), bob = new Client()
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'waypoint-api-'))
  db = openDatabase(join(directory, 'test.sqlite'))
  server = createApp(db, { origin, sessionDays: 7, secureCookie: false, rateLimit: 500 }).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port')
  base = `http://127.0.0.1:${address.port}`
  for (const [client, name] of [[alice, 'Alice'], [bob, 'Bob']] as const) expect((await client.request('/auth/signup', 'POST', { name, email: `${name.toLowerCase()}@example.test`, password })).status).toBe(201)
})
beforeEach(async () => { expect((await alice.request('/workspace/clear', 'POST', {})).status).toBe(200) })
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); rmSync(directory, { recursive: true, force: true }) })

describe('authenticated database API', () => {
  it('uses durable, HttpOnly sessions and never returns credentials', async () => {
    const client = new Client()
    const response = await client.request('/auth/login', 'POST', { email: 'ALICE@example.test', password })
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict')
    expect(await response.text()).not.toMatch(/passwordHash|scrypt|tokenHash/)
    expect((await client.request('/auth/session')).status).toBe(200)
    expect((await client.workspace()).applications).toEqual([])
    const raw = client.cookie.split('=')[1]
    expect(db.prepare('SELECT tokenHash FROM sessions WHERE tokenHash=?').get(hashToken(raw))).toBeTruthy()
    expect(db.prepare('SELECT tokenHash FROM sessions WHERE tokenHash=?').get(raw)).toBeUndefined()
    const cookie = client.cookie
    expect((await client.request('/auth/logout', 'POST', {})).status).toBe(204)
    client.cookie = cookie
    expect((await client.request('/workspace')).status).toBe(401)
  })
  it('handles duplicate accounts, invalid credentials, and expired sessions', async () => {
    const client = new Client()
    expect((await client.request('/auth/signup', 'POST', { name: 'Alice', email: 'alice@example.test', password })).status).toBe(409)
    expect((await client.request('/auth/login', 'POST', { email: 'alice@example.test', password: 'wrong' })).status).toBe(401)
    expect((await client.request('/auth/login', 'POST', { email: 'unknown@example.test', password })).status).toBe(401)
    expect((await client.request('/auth/signup', 'POST', { name: 'Weak', email: 'weak@example.test', password: 'short' })).status).toBe(422)
    await client.request('/auth/login', 'POST', { email: 'bob@example.test', password })
    db.prepare('UPDATE sessions SET expiresAt=0 WHERE tokenHash=?').run(hashToken(client.cookie.split('=')[1]))
    expect(await (await client.request('/auth/session')).json()).toBeNull()
    expect((await client.request('/workspace')).status).toBe(401)
  })
  it('creates, edits, persists, versions, and deletes an application', async () => {
    const created = await alice.create()
    expect(created.version).toBe(1)
    const response = await alice.request(`/applications/${created.id}`, 'PUT', { ...created, position: 'Staff engineer', notes: '<script>alert(1)</script>', tags: ['React', 'react'] })
    expect(response.status).toBe(200)
    const edited = await response.json() as Application
    expect(edited.version).toBe(2)
    expect(edited.tags).toHaveLength(1)
    expect((await alice.workspace()).applications[0].position).toBe('Staff engineer')
    expect((await alice.request(`/applications/${created.id}/status`, 'PATCH', { version: 1, status: 'OFFER' })).status).toBe(409)
    const moved = await (await alice.request(`/applications/${created.id}/status`, 'PATCH', { version: 2, status: 'OFFER' })).json() as Application
    expect(moved.timeline.some(event => event.type === 'status' && event.status === 'OFFER')).toBe(true)
    expect((await alice.request(`/applications/${created.id}`, 'DELETE', { version: moved.version })).status).toBe(204)
    expect((await alice.workspace()).applications).toHaveLength(0)
    expect(db.prepare('SELECT * FROM timeline_events WHERE applicationId=?').all(created.id)).toHaveLength(0)
  })
  it('rejects cross-user reads, writes, deletes, relation changes and notifications', async () => {
    const app = await alice.create()
    const interview = { scheduledAt: new Date(Date.now() + 3600000).toISOString(), type: 'Video', interviewer: 'Nora', meetingUrl: '', notes: '', outcome: 'Scheduled' }
    const contact = { name: 'Nora', email: 'nora@example.test', company: 'Linear', role: 'Recruiter', linkedInUrl: '', notes: '' }
    let response = await alice.request(`/applications/${app.id}/interviews`, 'POST', { ...interview, version: app.version })
    let current = await response.json() as Application
    response = await alice.request(`/applications/${app.id}/contacts`, 'POST', { contact, version: current.version })
    const workspace = await response.json() as Workspace
    current = workspace.applications[0]
    const paths: [string, string, unknown][] = [
      [`/applications/${app.id}`, 'GET', undefined], [`/applications/${app.id}`, 'PUT', current], [`/applications/${app.id}`, 'DELETE', { version: current.version }],
      [`/applications/${app.id}/status`, 'PATCH', { status: 'OFFER', version: current.version }],
      [`/applications/${app.id}/follow-up`, 'PATCH', { date: '2026-01-01', complete: false, version: current.version }],
      [`/applications/${app.id}/interviews/${current.interviews[0].id}`, 'PUT', { ...interview, version: current.version }],
      [`/applications/${app.id}/contacts`, 'POST', { contact, version: current.version }],
      [`/contacts/${current.contacts[0].id}`, 'PUT', { ...contact, version: 1 }],
      [`/notifications/${workspace.notifications[0].id}/read`, 'POST', {}],
    ]
    for (const [path, method, body] of paths) expect((await bob.request(path, method, body)).status, path).toBe(404)
    const bobApp = await bob.create()
    expect((await bob.request(`/applications/${bobApp.id}/contacts`, 'POST', { contactId: current.contacts[0].id, version: bobApp.version })).status).toBe(404)
    const bobId = (await bob.workspace()).user.id
    expect(() => db.prepare('INSERT INTO application_contacts (applicationId,userId,contactId,linkedAt) VALUES (?,?,?,?)').run(bobApp.id, bobId, current.contacts[0].id, new Date().toISOString())).toThrow()
    expect((await alice.workspace()).applications[0]).toEqual(current)
  })
  it('blocks CSRF, unsafe URLs and invalid application input', async () => {
    const input = createDemoApplications()[0]
    expect((await alice.request('/applications', 'POST', input, { Origin: 'https://attacker.test' })).status).toBe(403)
    expect((await alice.request('/applications', 'POST', input, { Origin: '' })).status).toBe(403)
    expect((await alice.request('/applications', 'POST', input, { 'Content-Type': 'text/plain' })).status).toBe(415)
    for (const invalid of [{ company: '' }, { jobUrl: 'javascript:alert(1)' }, { dateApplied: '2026-02-30' }, { status: 'HACKED' }, { salary: -10 }]) expect((await alice.request('/applications', 'POST', { ...input, ...invalid })).status).toBe(422)
    expect((await alice.workspace()).applications).toHaveLength(0)
  })
  it('stores multiple interview outcomes and updates reminders', async () => {
    let app = await alice.create()
    const input = { scheduledAt: new Date(Date.now() + 7200000).toISOString(), type: 'Technical', interviewer: 'Mina', meetingUrl: 'https://meet.example.test/room', notes: 'Prepare system design', outcome: 'Scheduled' }
    for (let index = 0; index < 2; index++) app = await (await alice.request(`/applications/${app.id}/interviews`, 'POST', { ...input, version: app.version })).json() as Application
    expect(app.interviews).toHaveLength(2)
    let workspace = await alice.workspace()
    expect(workspace.notifications).toHaveLength(2)
    await alice.request(`/notifications/${workspace.notifications[0].id}/read`, 'POST', {})
    expect((await alice.workspace()).notifications.filter(item => item.readAt)).toHaveLength(1)
    app = await (await alice.request(`/applications/${app.id}/interviews/${app.interviews[0].id}`, 'PUT', { ...input, outcome: 'Next round', version: app.version })).json() as Application
    expect(app.timeline.at(-1)?.type).toBe('interview_completed')
    app = await (await alice.request(`/applications/${app.id}/interviews/${app.interviews[1].id}`, 'DELETE', { version: app.version })).json() as Application
    expect(app.interviews).toHaveLength(1)
    workspace = await alice.workspace()
    expect(workspace.notifications).toHaveLength(0)
  })
  it('shares contacts without duplicating them and preserves links in backups', async () => {
    const first = await alice.create(), second = await alice.create()
    const contact = { name: 'Mina', email: 'mina@example.test', company: 'Stripe', role: 'Talent partner', linkedInUrl: 'https://linkedin.com/in/mina', notes: 'Met at a meetup' }
    let workspace = await (await alice.request(`/applications/${first.id}/contacts`, 'POST', { contact, version: first.version })).json() as Workspace
    const contactId = workspace.contacts[0].id
    expect((await alice.request(`/applications/${second.id}/contacts`, 'POST', { contactId, version: second.version })).status).toBe(200)
    workspace = await (await alice.request(`/contacts/${contactId}`, 'PUT', { ...contact, name: 'Mina Chen', version: 1 })).json() as Workspace
    expect(workspace.contacts).toHaveLength(1)
    expect(workspace.applications.every(app => app.contacts[0].name === 'Mina Chen')).toBe(true)
    const imported = await alice.request('/workspace/import', 'POST', { applications: workspace.applications })
    expect(imported.status).toBe(200)
    workspace = await imported.json() as Workspace
    expect(workspace.contacts).toHaveLength(1)
    expect(workspace.contacts[0].id).not.toBe(contactId)
    expect(new Set(workspace.applications.map(app => app.contacts[0].id)).size).toBe(1)
  })
  it('schedules and resolves follow-ups with persistent read state', async () => {
    let app = await alice.create()
    app = await (await alice.request(`/applications/${app.id}/follow-up`, 'PATCH', { version: app.version, date: '2020-01-01', complete: false })).json() as Application
    let workspace = await alice.workspace()
    expect(workspace.notifications[0].kind).toBe('followup')
    await alice.request('/notifications/read-all', 'POST', {})
    expect((await alice.workspace()).notifications[0].readAt).toBeTruthy()
    app = await (await alice.request(`/applications/${app.id}/follow-up`, 'PATCH', { version: app.version, date: app.followUpDate, complete: true })).json() as Application
    expect(app.followUpCompletedAt).toBeTruthy()
    workspace = await alice.workspace()
    expect(workspace.notifications).toHaveLength(0)
    expect(app.timeline.at(-1)?.type).toBe('followup_completed')
  })
  it('keeps existing data on malformed imports and transactional conflicts', async () => {
    const original = await alice.create()
    expect((await alice.request('/workspace/import', 'POST', { applications: [{ ...original, status: 'INVALID' }] })).status).toBe(422)
    expect((await alice.workspace()).applications[0].id).toBe(original.id)
    const contact = { id: 'shared', name: 'Nora', email: '', company: '', role: '', linkedInUrl: '', notes: '', version: 1, createdAt: original.createdAt, updatedAt: original.updatedAt }
    const input = [{ ...original, contacts: [contact] }, { ...original, id: 'second', contacts: [{ ...contact, name: 'Conflicting name' }] }]
    expect((await alice.request('/workspace/import', 'POST', { applications: input })).status).toBe(422)
    expect((await alice.workspace()).applications[0].id).toBe(original.id)
    const bobBefore = await bob.workspace()
    expect((await alice.request('/workspace/demo', 'POST', {})).status).toBe(200)
    expect((await alice.workspace()).applications).toHaveLength(24)
    expect((await bob.workspace()).applications).toEqual(bobBefore.applications)
  })
  it('persists profile fields while protecting the account email', async () => {
    const workspace = await alice.workspace()
    const updated = await (await alice.request('/profile', 'PATCH', { ...workspace.profile, name: 'Alice Nguyen', weeklyGoal: 12, appearance: 'dark', email: 'bob@example.test' })).json() as Workspace
    expect(updated.profile).toMatchObject({ name: 'Alice Nguyen', weeklyGoal: 12, appearance: 'dark', email: 'alice@example.test' })
  })
  it('persists data when the database connection is reopened', async () => {
    const app = await alice.create()
    const another = openDatabase(join(directory, 'test.sqlite'))
    expect(another.prepare('SELECT company FROM applications WHERE id=?').get(app.id)?.company).toBe(app.company)
    another.close()
  })
  it('rate limits repeated authentication attempts', async () => {
    const client = new Client()
    db.prepare('INSERT INTO rate_limits (key,attempts,expiresAt) VALUES (?,12,?)').run(`email:${hashToken('limited@example.test')}`, Date.now() + 60000)
    expect((await client.request('/auth/login', 'POST', { email: 'limited@example.test', password })).status).toBe(429)
  })
})
