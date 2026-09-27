import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoApplications } from '../data/demo'
import { applicationFormSchema, applicationsSchema } from '../validation/application'
import { activityData, emptyFilters, filterApplications, getMetrics } from './applications'
import { exportApplications, exportWorkspaceBackup, parseImport, parseWorkspaceBackup, readLegacyApplications, STORAGE_KEY } from './storage'
import { dateKey, formatDate } from './dates'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) }, clear: () => data.clear() }
}

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('application data and validation', () => {
  it('provides valid, realistic seed data with chronological history', () => {
    const apps = applicationsSchema.parse(createDemoApplications())
    expect(apps).toHaveLength(24)
    for (const app of apps) {
      expect(app.updatedAt >= app.createdAt).toBe(true)
      expect(app.timeline.every(event => event.at <= app.updatedAt)).toBe(true)
    }
  })
  it('rejects invalid required fields, salaries, emails, URLs, dates and tags', () => {
    const app = createDemoApplications()[0]
    const valid = { ...app, salary: '150000', tags: 'React, TypeScript' }
    expect(applicationFormSchema.safeParse(valid).success).toBe(true)
    for (const invalid of [{ company: ' ' }, { position: '' }, { salary: '-1' }, { salary: 'NaN' }, { salary: '1e6' }, { recruiterEmail: 'not-email' }, { jobUrl: 'javascript:alert(1)' }, { dateApplied: '2026-02-30' }, { interviewDate: '2026-02-30T15:00' }, { tags: 'x'.repeat(101) }]) {
      expect(applicationFormSchema.safeParse({ ...valid, ...invalid }).success).toBe(false)
    }
  })
  it('keeps calendar-only dates stable in the local timezone', () => {
    expect(dateKey(new Date(2026, 8, 26, 0))).toBe('2026-09-26')
    expect(formatDate('2026-09-26')).toBe('Sep 26')
  })
})

describe('search, filters and statistics', () => {
  const apps = createDemoApplications()
  it('searches tags, recruiter, company, role and location without mutation', () => {
    for (const search of ['Linear', 'Jamie Chen', 'Astana', 'TypeScript', 'Design Engineer']) {
      expect(filterApplications(apps, { ...emptyFilters, search }).length).toBeGreaterThan(0)
    }
    const original = apps.map(app => app.id)
    filterApplications(apps, emptyFilters, 'company')
    expect(apps.map(app => app.id)).toEqual(original)
  })
  it('composes status, location, employment, salary and date filters', () => {
    const selected = apps.find(app => app.company === 'Kaspi.kz')!
    const result = filterApplications(apps, { ...emptyFilters, status: 'INTERVIEW', location: 'Astana', employmentType: 'Full-time', minSalary: '60000', maxSalary: '70000', from: selected.dateApplied, to: selected.dateApplied })
    expect(result.map(app => app.company)).toEqual(['Kaspi.kz'])
    expect(filterApplications(apps, { ...emptyFilters, search: 'not a company' })).toHaveLength(0)
  })
  it('sorts salary and dates correctly with missing salary last', () => {
    const withMissing = [...apps, { ...apps[0], id: 'no-salary', salary: undefined }]
    expect(filterApplications(withMissing, emptyFilters, 'salary').at(-1)?.id).toBe('no-salary')
    const sorted = filterApplications(apps, emptyFilters, 'oldest')
    expect(sorted[0].dateApplied < sorted.at(-1)!.dateApplied).toBe(true)
  })
  it('calculates historical conversions after rejection and handles empty data', () => {
    const app = { ...apps[0], status: 'REJECTED' as const }
    expect(getMetrics([app]).interviewRate).toBe(100)
    expect(getMetrics([app]).offerRate).toBe(0)
    expect(getMetrics([])).toMatchObject({ total: 0, interviewRate: 0, offerRate: 0 })
    expect(activityData([], 'weekly').every(row => row.applications === 0)).toBe(true)
  })
  it('preserves completed interview conversion when its interview record is removed', () => {
    const app = { ...apps[0], status: 'REJECTED' as const, interviews: [], timeline: [{ id: 'completed', type: 'interview_completed' as const, at: apps[0].createdAt }] }
    expect(getMetrics([app])).toMatchObject({ interviews: 1, interviewRate: 100 })
    expect(getMetrics([{ ...app, timeline: [{ ...app.timeline[0], type: 'interview_cancelled' }] }]).interviews).toBe(0)
  })
  it('uses local Monday and month boundaries and excludes future dates from progress', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 7, 0, 5))
    const dated = ['2026-08-31', '2026-09-01', '2026-09-06', '2026-09-07', '2026-09-08'].map(dateApplied => ({ ...apps[0], dateApplied }))
    expect(getMetrics(dated)).toMatchObject({ thisWeek: 1, thisMonth: 3 })
    vi.setSystemTime(new Date(2026, 8, 6, 23, 59))
    expect(getMetrics(dated)).toMatchObject({ thisWeek: 3, thisMonth: 2 })
  })
  it('aggregates all recent seed applications into the monthly chart', () => {
    expect(activityData(apps, 'monthly').reduce((sum, row) => sum + row.applications, 0)).toBe(apps.length)
  })
  it('counts recorded interviews before a status change and combines tag/work/notes filters', () => {
    const app = { ...apps[0], status: 'APPLIED' as const, timeline: [], notes: 'Ask about distributed systems' }
    expect(getMetrics([app]).interviewRate).toBe(100)
    const result = filterApplications([app], { ...emptyFilters, search: 'distributed systems', tag: 'React', workMode: 'Remote', status: 'APPLIED' })
    expect(result).toHaveLength(1)
    expect(filterApplications([app], { ...emptyFilters, tag: 'React', workMode: 'Onsite' })).toHaveLength(0)
    expect(getMetrics([{ ...app, interviews: app.interviews.map(item => ({ ...item, outcome: 'Cancelled' as const })) }]).interviewRate).toBe(0)
  })
})

describe('persistence and backups', () => {
  it('roundtrips exports and handles missing optional fields', () => {
    const apps = createDemoApplications()
    expect(parseImport(exportApplications(apps))).toEqual(apps)
    const minimal: Record<string, unknown> = { ...apps[0] }
    for (const field of ['notes', 'jobUrl', 'recruiter', 'tags']) delete minimal[field]
    expect(parseImport(JSON.stringify([minimal]))[0]).toMatchObject({ notes: '', jobUrl: '', recruiter: '', tags: [] })
  })
  it('roundtrips saved jobs in v3 backups and rejects duplicate saved IDs', () => {
    const apps = createDemoApplications().slice(0, 1)
    const job = { id: 'saved-1', company: 'Northstar', position: 'Engineer', location: '', jobUrl: '', source: 'Referral' as const, deadline: '', notes: '', version: 1, createdAt: apps[0].createdAt, updatedAt: apps[0].updatedAt }
    expect(parseWorkspaceBackup(exportWorkspaceBackup(apps, [job]))).toEqual({ applications: apps, savedJobs: [job] })
    expect(() => parseWorkspaceBackup(exportWorkspaceBackup(apps, [job, job]))).toThrow()
    expect(parseWorkspaceBackup(exportApplications(apps)).savedJobs).toEqual([])
  })
  it('rejects malformed, duplicate, unknown-version and unsafe imports', () => {
    const apps = createDemoApplications()
    for (const raw of ['{broken', '{}', JSON.stringify([apps[0], apps[0]]), JSON.stringify([{ ...apps[0], jobUrl: 'javascript:alert(1)' }]), JSON.stringify({ version: 99, applications: apps })]) {
      expect(() => parseImport(raw)).toThrow()
    }
  })
  it('never automatically migrates or replaces legacy browser data', () => {
    expect(readLegacyApplications()).toBeNull()
    localStorage.setItem(STORAGE_KEY, '{broken')
    expect(() => readLegacyApplications()).toThrow()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken')
    const apps = createDemoApplications()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, applications: apps }))
    expect(readLegacyApplications()).toEqual(apps)
  })
})
