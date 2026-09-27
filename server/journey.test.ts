import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase, transaction } from './database'
import { Repository } from './repository'
import { CareerRepository } from './careerRepository'
import { activityStreak, journey } from './journey'
import { levelFor } from '../src/domain/journey'
import { applicationInputSchema, interviewInputSchema } from '../src/validation/application'
import { preparationInputSchema, taskInputSchema } from '../src/domain/career'
import { createDemoApplications } from '../src/data/demo'
import { createApp } from './app'

let db: DatabaseSync, repo: Repository, career: CareerRepository
const input = (company = 'Northstar') => applicationInputSchema.parse({ company, position: 'Engineer', status: 'APPLIED', dateApplied: '2026-09-27', employmentType: 'Full-time' })
const submit = (company?: string, user = 'alice') => repo.create(user, input(company))
beforeEach(() => {
  db = openDatabase(':memory:'); repo = new Repository(db); career = new CareerRepository(db)
  for (const user of ['alice', 'bob']) db.prepare('INSERT INTO users(id,email,passwordHash,name,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(user, user + '@example.test', 'unused', user, new Date().toISOString(), new Date().toISOString())
})
afterEach(() => db.close())

describe('authoritative journey ledger', () => {
  it('credits submission and unlock once; reads, edits and status toggles are inert', () => {
    let app = submit()
    expect(journey(db, 'alice')).toMatchObject({ xp: 30, progress: { level: 1 }, achievements: [{ id: 'first-step' }] })
    app = repo.update('alice', app.id, app.version, { ...input(), notes: 'Updated notes' })
    app = repo.status('alice', app.id, app.version, 'INTERVIEW')
    repo.status('alice', app.id, app.version, 'APPLIED')
    expect(journey(db, 'alice').xp).toBe(30)
    expect(journey(db, 'alice').xp).toBe(30)
    expect(journey(db, 'bob').xp).toBe(0)
  })
  it('keeps tombstones after deletion and caps creation farming without blocking work', () => {
    const app = submit(); repo.remove('alice', app.id, app.version)
    submit('  NORTHSTAR  ')
    expect(journey(db, 'alice').xp).toBe(30)
    for (let i = 0; i < 100; i++) { const row = submit('Company ' + i); repo.remove('alice', row.id, row.version) }
    expect(journey(db, 'alice').xp).toBe(150)
    expect(db.prepare('SELECT count(*) n FROM reward_events WHERE userId=?').get('alice')!.n).toBe(101)
  })
  it('rolls domain changes, XP and achievements back together', () => {
    expect(() => transaction(db, () => {
      db.prepare("INSERT INTO applications(id,userId,company,position,employmentType,status,dateApplied,createdAt,updatedAt) VALUES('rollback','alice','Rollback','Engineer','Full-time','APPLIED','2026-09-27','2026-09-27T00:00:00Z','2026-09-27T00:00:00Z')").run()
      throw new Error('Simulated save failure')
    })).toThrow('Simulated save failure')
    expect(journey(db, 'alice').xp).toBe(0)
    expect(journey(db, 'alice').achievements).toEqual([])
  })
  it('rewards task completion once across reopen and retry; updates contextual steps', () => {
    const task = career.saveTask('alice', undefined, taskInputSchema.parse({ title: 'Prepare portfolio' }))
    expect(journey(db, 'alice').quests[0].title).toBe('Prepare portfolio')
    const completed = career.saveTask('alice', task.id, { ...task, status: 'COMPLETED' }, task.version)
    expect(journey(db, 'alice').xp).toBe(15)
    expect(journey(db, 'alice').quests.some(item => item.completed)).toBe(true)
    const reopened = career.saveTask('alice', task.id, { ...task, status: 'OPEN' }, completed.version)
    career.saveTask('alice', task.id, { ...task, status: 'COMPLETED' }, reopened.version)
    expect(journey(db, 'alice').xp).toBe(15)
    expect(() => career.saveTask('bob', task.id, { ...task, status: 'COMPLETED' }, 1)).toThrow()
    expect(journey(db, 'bob').quests).toEqual([])
  })
  it('requires real preparation and gives scheduling/completion separate idempotent rewards', () => {
    let app = submit()
    const interview = interviewInputSchema.parse({ scheduledAt: new Date(Date.now() + 86400000).toISOString(), type: 'Video', outcome: 'Scheduled', interviewer: '', meetingUrl: '', notes: '' })
    app = repo.interview('alice', app.id, app.version, interview)
    const id = app.interviews[0].id
    expect(journey(db, 'alice').quests[0].kind).toBe('Preparation')
    let prep = career.savePreparation('alice', id, preparationInputSchema.parse({ topics: [{ title: 'Portfolio', done: false }], questionsToAsk: 'Team priorities?' }), 0)
    expect(journey(db, 'alice').xp).toBe(55)
    prep = career.savePreparation('alice', id, { ...prep, topics: [{ title: 'Portfolio', done: true }] }, prep.version)
    expect(journey(db, 'alice').xp).toBe(95)
    expect(journey(db, 'alice').quests.some(item => !item.completed && item.kind === 'Preparation')).toBe(false)
    career.savePreparation('alice', id, prep, prep.version)
    app = repo.application('alice', app.id)
    app = repo.interview('alice', app.id, app.version, { ...interview, outcome: 'Completed' }, id)
    repo.interview('alice', app.id, app.version, { ...interview, outcome: 'Completed' }, id)
    expect(journey(db, 'alice')).toMatchObject({ xp: 155, progress: { level: 2 }, streak: { current: 1, activeDays: 1 } })
    expect(journey(db, 'alice').achievements.map(item => item.id)).toContain('showed-up')
  })
  it('completes a follow-up once even if its date changes', () => {
    let app = submit()
    app = repo.followUp('alice', app.id, app.version, '2026-09-27', true, 'Check in', '')
    app = repo.followUp('alice', app.id, app.version, '2026-09-28', false, 'Check in again', '')
    repo.followUp('alice', app.id, app.version, '2026-09-28', true, 'Check in again', '')
    expect(journey(db, 'alice').xp).toBe(55)
  })
  it('does not grant XP for demo/import/reset and does not erase existing ledger', () => {
    submit(); const before = journey(db, 'alice').xp
    repo.replace('alice', createDemoApplications()); repo.replace('alice', createDemoApplications()); repo.replace('alice', [])
    expect(journey(db, 'alice').xp).toBe(before)
    expect(journey(db, 'alice').counts.APPLICATION_SUBMITTED).toBe(1)
    expect(db.prepare('SELECT suppress FROM user_progress WHERE userId=?').get('alice')!.suppress).toBe(0)
  })
  it('scopes preferences and rejects client XP/owner/achievement claims through authenticated API', async () => {
    const origin = 'http://127.0.0.1:5173'
    const server = createApp(db, { origin, sessionDays: 1, secureCookie: false, rateLimit: 100 }).listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Port unavailable')
    const base = `http://127.0.0.1:${address.port}/api`
    const call = (path: string, method = 'GET', body?: unknown, cookie = '') => fetch(base + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined })
    try {
      const signup = await call('/auth/signup', 'POST', { name: 'Cora', email: 'cora@example.test', password: 'A thoughtful test passphrase' })
      const cookie = signup.headers.getSetCookie().filter(item => item.startsWith('waypoint_session=')).at(-1)!.split(';')[0]
      expect((await call('/journey')).status).toBe(401)
      expect((await call('/journey/preferences', 'PATCH', { userId: 'alice', xp: 99999, companion: 'cat', achievements: ['first-step'] }, cookie)).status).toBe(422)
      expect((await call('/journey/preferences', 'PATCH', { companion: 'cat', enabled: false }, cookie)).status).toBe(200)
      const progress = await (await call('/journey?userId=alice', 'GET', undefined, cookie)).json()
      expect(progress).toMatchObject({ xp: 0, companion: 'cat', enabled: false, achievements: [] })
      expect(journey(db, 'alice').companion).toBe('fox')
      const results = await Promise.all([call('/applications', 'POST', input('Concurrent'), cookie), call('/applications', 'POST', input('Concurrent'), cookie)])
      expect(results.map(item => item.status)).toEqual([201, 201])
      expect(await (await call('/journey', 'GET', undefined, cookie)).json()).toMatchObject({ xp: 30 })
    } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
  })
})

it('uses a growing level curve and stable companion evolution thresholds', () => {
  expect(levelFor(0)).toMatchObject({ level: 1, current: 0, required: 100, stage: 1 })
  expect(levelFor(100)).toMatchObject({ level: 2, current: 0, required: 150 })
  expect(levelFor(700)).toMatchObject({ level: 5, stage: 2 })
  expect(levelFor(2700)).toMatchObject({ level: 10, stage: 3 })
  expect(levelFor(10450)).toMatchObject({ level: 20, stage: 4 })
})
it('counts meaningful UTC activity days and allows yesterday as the current streak', () => {
  expect(activityStreak(['2026-09-24', '2026-09-25', '2026-09-25', '2026-09-26'], '2026-09-27')).toEqual({ current: 3, activeDays: 3 })
  expect(activityStreak(['2026-09-23'], '2026-09-27')).toEqual({ current: 0, activeDays: 1 })
  expect(activityStreak([], '2026-09-27')).toEqual({ current: 0, activeDays: 0 })
})
