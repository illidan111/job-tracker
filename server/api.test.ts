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
import type { Application, SavedJob, Workspace } from '../src/types/application'
import type { CareerBackup, Company, Task, CareerNote, Materials, Preparation } from '../src/domain/career'
import type { ApplicationPage, Overview } from '../src/domain/overview'

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
  it('round trips the complete career backup and rolls back invalid relationships', async () => {
    let app = await alice.create()
    app = await (await alice.request(`/applications/${app.id}/interviews`, 'POST', { version: app.version, scheduledAt: new Date().toISOString(), type: 'Video', interviewer: '', meetingUrl: '', notes: '', outcome: 'Scheduled' })).json() as Application
    await alice.request(`/companies/${app.companyId}`, 'PUT', { version: (await (await alice.request(`/companies/${app.companyId}`)).json() as { company: Company }).company.version, name: app.company, notes: 'Company research preserved' })
    await alice.request('/tasks', 'POST', { title: 'Personal research' })
    await alice.request('/tasks', 'POST', { title: 'Linked research', applicationId: app.id })
    await alice.request(`/applications/${app.id}/notes`, 'POST', { body: 'Conversation preserved' })
    await alice.request(`/applications/${app.id}/materials`, 'PUT', { version: 0, resumeVersion: 'Frontend v4', skills: ['SQL'] })
    await alice.request(`/interviews/${app.interviews[0].id}/preparation`, 'PUT', { version: 0, topics: [{ title: 'SQL joins', done: true }], reflection: 'Positive' })
    const response = await alice.request('/workspace/export')
    expect(response.status).toBe(200)
    const backup = await response.json() as { version: number; applications: Application[]; savedJobs: SavedJob[]; career: CareerBackup }
    expect(backup.version).toBe(4)
    expect(backup.career.notes[0].body).toBe('Conversation preserved')
    const otherBefore = await (await bob.request('/workspace/export')).json() as typeof backup
    const invalid = structuredClone(backup); invalid.career.tasks[0].applicationId = 'missing-app'
    expect((await alice.request('/workspace/import', 'POST', invalid)).status).toBe(422)
    const duplicate = structuredClone(backup); duplicate.applications[0].interviews.push(duplicate.applications[0].interviews[0])
    expect((await alice.request('/workspace/import', 'POST', duplicate)).status).toBe(422)
    expect((await alice.workspace()).applications[0].id).toBe(app.id)
    expect((await alice.request('/workspace/import', 'POST', backup)).status).toBe(200)
    const restored = await (await alice.request('/workspace/export')).json() as typeof backup
    expect(restored.applications[0].id).not.toBe(app.id)
    expect(restored.career.tasks.find(task => task.title === 'Linked research')?.applicationId).toBe(restored.applications[0].id)
    expect(restored.career.tasks.find(task => task.title === 'Personal research')?.applicationId).toBeNull()
    expect(restored.career.companies.find(company => company.id === restored.applications[0].companyId)?.notes).toBe('Company research preserved')
    expect(restored.career.materials[0].resumeVersion).toBe('Frontend v4')
    expect(restored.career.preparations[0]).toMatchObject({ interviewId: restored.applications[0].interviews[0].id, topics: [{ title: 'SQL joins', done: true }], reflection: 'Positive' })
    const otherAfter = await (await bob.request('/workspace/export')).json() as typeof backup
    expect(otherAfter.applications).toEqual(otherBefore.applications)
    expect(otherAfter.career).toEqual(otherBefore.career)
    expect(JSON.stringify(otherAfter)).not.toContain('Conversation preserved')
  })
  it('paginates beyond bootstrap and calculates full owner-scoped analytics', async () => {
    const original = await alice.create()
    const applications = Array.from({ length: 215 }, (_, index) => ({ ...original, id: `bulk-${index}`, company: `Scale ${String(index).padStart(3, '0')}`, status: index === 214 ? 'OFFER' : 'APPLIED', timeline: [], followUpDate: '2020-01-01' }))
    expect((await alice.request('/workspace/import', 'POST', { applications })).status).toBe(200)
    expect((await alice.workspace()).applications.length).toBeLessThanOrEqual(200)
    expect((await alice.workspace()).notifications).toHaveLength(50)
    const first = await (await alice.request('/applications?pageSize=10&sort=company')).json() as ApplicationPage
    const last = await (await alice.request('/applications?page=22&pageSize=10&sort=company')).json() as ApplicationPage
    expect(first.total).toBe(215); expect(first.items).toHaveLength(10); expect(last.items).toHaveLength(5)
    expect(last.items.at(-1)?.company).toBe('Scale 214')
    const search = await (await alice.request('/applications?q=Scale%20214')).json() as ApplicationPage
    expect(search.total).toBe(1)
    const summary = await (await alice.request('/overview')).json() as Overview
    expect(summary.metrics.total).toBe(215); expect(summary.metrics.offers).toBe(1); expect(summary.activity.length).toBeLessThanOrEqual(5)
    const second = await (await bob.request('/applications?q=Scale')).json() as ApplicationPage
    expect(second.total).toBe(0)
    expect(JSON.stringify(await (await bob.request('/overview')).json())).not.toContain('Scale')
    expect((await alice.request('/applications?pageSize=10000')).status).toBe(422)
  })
  it('connects company research, tasks, notes, materials and interview preparation with ownership checks', async () => {
    const first = await alice.create(), second = await alice.create()
    expect(first.companyId).toBeTruthy()
    expect(second.companyId).toBe(first.companyId)
    const company = await (await alice.request(`/companies/${first.companyId}`)).json() as { company: Company; applications: { total: number } }
    expect(company.applications.total).toBe(2)
    expect((await bob.request(`/companies/${first.companyId}`)).status).toBe(404)
    expect((await alice.request(`/companies/${first.companyId}`, 'PUT', { ...company.company, notes: 'Research the platform team' })).status).toBe(200)
    const input = { title: 'Prepare system design', applicationId: first.id, dueDate: '2026-09-27', priority: 'HIGH', status: 'OPEN', description: 'Review tradeoffs' }
    const requestId = crypto.randomUUID()
    const task = await (await alice.request('/tasks', 'POST', { ...input, requestId })).json() as Task
    expect(task.title).toBe(input.title)
    expect((await (await alice.request('/tasks', 'POST', { ...input, requestId })).json() as Task).id).toBe(task.id)
    expect((await bob.request(`/tasks/${task.id}`)).status).toBe(404)
    expect((await bob.request('/tasks', 'POST', input)).status).toBe(404)
    expect((await bob.request(`/tasks/${task.id}`, 'PUT', { ...task, status: 'COMPLETED' })).status).toBe(404)
    const completed = await (await alice.request(`/tasks/${task.id}`, 'PUT', { ...task, status: 'COMPLETED' })).json() as Task
    expect(completed.completedAt).toBeTruthy()
    expect((await alice.request(`/tasks/${task.id}`, 'PUT', task)).status).toBe(409)
    const note = await (await alice.request(`/applications/${first.id}/notes`, 'POST', { body: 'Recruiter explained the team scope' })).json() as CareerNote
    expect(note.body).toContain('Recruiter')
    expect((await bob.request(`/applications/${first.id}/notes`)).status).toBe(404)
    expect((await bob.request(`/applications/${first.id}/notes/${note.id}`, 'DELETE', { version: note.version })).status).toBe(404)
    const materialResponse = await alice.request(`/applications/${first.id}/materials`, 'PUT', { version: 0, jobDescription: 'Build reliable APIs', resumeVersion: 'Backend v3', skills: ['SQL', 'sql'], portfolioUrl: 'https://example.test/portfolio' })
    expect(materialResponse.status).toBe(200)
    const materials = await materialResponse.json() as Materials
    expect(materials.skills).toHaveLength(1)
    expect((await bob.request(`/applications/${first.id}/materials`)).status).toBe(404)
    expect((await alice.request(`/applications/${first.id}/materials`, 'PUT', { ...materials, resumeUrl: 'javascript:alert(1)' })).status).toBe(422)
    const latest = (await alice.workspace()).applications.find(app => app.id === first.id)!
    const withInterview = await (await alice.request(`/applications/${first.id}/interviews`, 'POST', { version: latest.version, type: 'Technical', scheduledAt: '2026-09-28T10:00:00Z', interviewer: '', meetingUrl: '', notes: '', outcome: 'Scheduled' })).json() as Application
    const interviewId = withInterview.interviews[0].id
    const prepResponse = await alice.request(`/interviews/${interviewId}/preparation`, 'PUT', { version: 0, topics: [{ title: 'SQL joins', done: true }], questionsToAsk: 'How is on-call organized?', expectedQuestions: 'Explain indexes', reflection: 'Positive', reflectionNotes: 'Clear discussion' })
    expect(prepResponse.status).toBe(200)
    const preparation = await prepResponse.json() as Preparation
    expect(preparation.topics[0].done).toBe(true)
    expect((await bob.request(`/interviews/${interviewId}/preparation`)).status).toBe(404)
    expect((await bob.request(`/interviews/${interviewId}/preparation`, 'PUT', preparation)).status).toBe(404)
    const current = (await alice.workspace()).applications.find(app => app.id === first.id)!
    expect(current.timeline.map(event => event.type)).toEqual(expect.arrayContaining(['task_created', 'task_completed', 'note_added', 'materials_updated', 'preparation_updated']))
    const search = await (await alice.request('/search?q=tradeoffs')).json()
    expect(search).toMatchObject([{ kind: 'Tasks', id: task.id }])
    expect(await (await bob.request('/search?q=tradeoffs')).json()).toEqual([])
  })
  it('projects real dates into the agenda using the requested timezone and excludes completed tasks', async () => {
    let app = await alice.create()
    app = await (await alice.request(`/applications/${app.id}/interviews`, 'POST', { version: app.version, type: 'Video', scheduledAt: '2026-09-27T23:30:00Z', interviewer: '', meetingUrl: '', notes: '', outcome: 'Scheduled' })).json() as Application
    const task = await (await alice.request('/tasks', 'POST', { title: 'Due yesterday', applicationId: app.id, dueDate: '2026-09-26' })).json() as Task
    const agenda = await (await alice.request('/schedule?from=2026-09-28&to=2026-09-28&timezone=Asia%2FAlmaty&overdue=true')).json() as { items: { kind: string; day: string; id: string }[] }
    expect(agenda.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'interview', day: '2026-09-28' }), expect.objectContaining({ id: task.id })]))
    await alice.request(`/tasks/${task.id}`, 'PUT', { ...task, status: 'COMPLETED' })
    const completed = await (await alice.request('/schedule?from=2026-09-28&to=2026-09-28&overdue=true')).json() as { items: { id: string }[] }
    expect(completed.items.some(item => item.id === task.id)).toBe(false)
  })
  it('saves a job, isolates it by account, and converts its details atomically', async () => {
    await alice.request('/workspace/import', 'POST', { applications: [], savedJobs: [] })
    const input = { company: 'Waypoint Labs', position: 'Staff Engineer', location: 'Remote', jobUrl: 'https://example.test/job', salary: 180000, source: 'Referral', deadline: '2026-12-01', notes: 'Ask about platform scope' }
    const response = await alice.request('/saved-jobs', 'POST', input)
    expect(response.status).toBe(201)
    const job = await response.json() as SavedJob
    expect((await alice.workspace()).savedJobs).toHaveLength(1)
    expect((await bob.workspace()).savedJobs.some(item => item.id === job.id)).toBe(false)
    expect((await bob.request(`/saved-jobs/${job.id}/apply`, 'POST', { version: job.version, dateApplied: '2026-09-27' })).status).toBe(404)
    expect((await alice.request(`/saved-jobs/${job.id}/apply`, 'POST', { version: 99, dateApplied: '2026-09-27' })).status).toBe(409)
    const converted = await alice.request(`/saved-jobs/${job.id}/apply`, 'POST', { version: job.version, dateApplied: '2026-09-27' })
    expect(converted.status).toBe(201)
    const app = await converted.json() as Application
    expect(app).toMatchObject({ company: input.company, position: input.position, source: input.source, deadline: input.deadline, notes: input.notes, dateApplied: '2026-09-27' })
    expect(app.timeline.some(event => event.description === 'Applied to saved job')).toBe(true)
    expect((await alice.workspace()).savedJobs).toHaveLength(0)
  })
  it('keeps bulk changes atomic and hides archived applications from reminders', async () => {
    const first = await alice.create(), second = await alice.create()
    const items = [first, second].map(app => ({ id: app.id, version: app.version }))
    expect((await bob.request('/applications/bulk', 'POST', { items, action: 'archive' })).status).toBe(404)
    expect((await alice.request('/applications/bulk', 'POST', { items: [...items, { id: 'missing', version: 1 }], action: 'archive' })).status).toBe(404)
    expect((await alice.workspace()).applications.filter(app => app.archivedAt)).toHaveLength(0)
    let response = await alice.request('/applications/bulk', 'POST', { items, action: 'addTag', value: 'Priority' })
    expect(response.status).toBe(200)
    let workspace = await response.json() as Workspace
    expect(workspace.applications.every(app => app.tags.includes('Priority'))).toBe(true)
    response = await alice.request('/applications/bulk', 'POST', { items: workspace.applications.map(app => ({ id: app.id, version: app.version })), action: 'archive' })
    expect(response.status).toBe(200)
    workspace = await response.json() as Workspace
    expect(workspace.applications.every(app => app.archivedAt)).toBe(true)
    expect(workspace.notifications).toHaveLength(0)
    response = await alice.request('/applications/bulk', 'POST', { items: workspace.applications.map(app => ({ id: app.id, version: app.version })), action: 'restore' })
    expect(response.status).toBe(200)
    expect(((await response.json()) as Workspace).applications.every(app => !app.archivedAt)).toBe(true)
  })
  it('restores saved jobs alongside applications and validates backups before replacement', async () => {
    await alice.request('/workspace/import', 'POST', { applications: [], savedJobs: [] })
    const response = await alice.request('/saved-jobs', 'POST', { company: 'Northstar', position: 'Engineer', location: '', jobUrl: '', source: '', deadline: '', notes: '' })
    const job = await response.json() as SavedJob
    const app = await alice.create()
    expect((await alice.request('/workspace/import', 'POST', { applications: [app], savedJobs: [job, job] })).status).toBe(422)
    expect((await alice.workspace()).savedJobs).toHaveLength(1)
    const restored = await alice.request('/workspace/import', 'POST', { applications: [app], savedJobs: [job] })
    expect(restored.status).toBe(200)
    const workspace = await restored.json() as Workspace
    expect(workspace.savedJobs).toMatchObject([{ company: 'Northstar', position: 'Engineer' }])
    expect(workspace.applications).toHaveLength(1)
  })
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
  it('enforces the interview limit through application edits without corrupting the workspace', async () => {
    const original = await alice.create()
    const interviews = Array.from({ length: 100 }, (_, index) => ({ id: `interview-${index}`, scheduledAt: original.createdAt, type: 'Video', interviewer: '', meetingUrl: '', notes: '', outcome: 'Completed', createdAt: original.createdAt, updatedAt: original.createdAt }))
    expect((await alice.request('/workspace/import', 'POST', { applications: [{ ...original, interviews }] })).status).toBe(200)
    const before = (await alice.workspace()).applications[0]
    const response = await alice.request(`/applications/${before.id}`, 'PUT', { ...before, position: 'Should roll back', interviewDate: new Date().toISOString() })
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'An application can have up to 100 interviews.' })
    expect((await alice.workspace()).applications[0]).toEqual(before)
  })
  it('does not generate history or revisions when an existing contact is linked again', async () => {
    const app = await alice.create()
    const contact = { name: 'Taylor', email: '', company: '', role: '', linkedInUrl: '', notes: '' }
    const first = await (await alice.request(`/applications/${app.id}/contacts`, 'POST', { version: app.version, contact })).json() as Workspace
    const current = first.applications[0]
    const second = await alice.request(`/applications/${app.id}/contacts`, 'POST', { version: current.version, contactId: current.contacts[0].id })
    expect(second.status).toBe(200)
    expect((await alice.workspace()).applications[0]).toEqual(current)
  })
  it('rejects invalid goals and ignores client supplied owners', async () => {
    const before = await alice.workspace(), other = await bob.workspace()
    for (const weeklyGoal of [0, 101, 1.5, '10']) expect((await alice.request('/profile', 'PATCH', { ...before.profile, weeklyGoal })).status).toBe(422)
    expect((await alice.workspace()).profile).toEqual(before.profile)
    const response = await alice.request('/applications', 'POST', { ...createDemoApplications()[0], userId: other.user.id })
    expect(response.status).toBe(201)
    const app = await response.json() as Application
    expect((await bob.request(`/applications/${app.id}`)).status).toBe(404)
    expect((await bob.workspace()).applications).toEqual(other.applications)
  })
  it('protects every workspace operation without a session and returns safe errors for missing IDs', async () => {
    const anonymous = new Client()
    for (const [path, method, body] of [
      ['/workspace', 'GET', undefined], ['/applications', 'POST', createDemoApplications()[0]],
      ['/profile', 'PATCH', {}], ['/workspace/import', 'POST', { applications: [] }],
      ['/workspace/clear', 'POST', {}], ['/notifications/read-all', 'POST', {}],
    ] as const) expect((await anonymous.request(path, method, body)).status).toBe(401)
    for (const id of ['missing', "' OR 1=1 --"]) {
      const response = await alice.request(`/applications/${encodeURIComponent(id)}`)
      expect(response.status).toBe(404)
      expect(await response.text()).not.toMatch(/SELECT|sqlite|stack|password/)
    }
  })
})
