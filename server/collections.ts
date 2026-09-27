import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { Router } from 'express'
import { z } from 'zod/v4'
import { Repository } from './repository'
import { applicationSchema, contactSchema, savedJobSchema, optionalDate } from '../src/validation/application'
import { STATUSES } from '../src/types/application'
import { activityData, getMetrics } from '../src/utils/applications'
import { dateKey } from '../src/utils/dates'
import type { Overview } from '../src/domain/overview'

const querySchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), q: z.string().max(100).default('') })
export function collections(db: DatabaseSync) {
  const router = Router(), repo = new Repository(db)
  router.get('/applications', (req, res) => {
    const query = querySchema.parse(req.query), userId = res.locals.userId
    const filters = z.object(Object.fromEntries(['status', 'location', 'type', 'work', 'source', 'tag', 'min', 'max', 'from', 'to', 'view', 'sort'].map(key => [key, z.string().max(120).optional()]))).parse(req.query)
    z.object({ min: z.string().refine(value => !value || (Number.isFinite(Number(value)) && Number(value) >= 0)).optional(), max: z.string().refine(value => !value || (Number.isFinite(Number(value)) && Number(value) >= 0)).optional(), from: optionalDate.optional(), to: optionalDate.optional() }).parse(filters)
    const clauses = ["a.userId=?", filters.view === 'archived' ? "a.archivedAt<>''" : "a.archivedAt=''"], args: SQLInputValue[] = [userId]
    for (const [key, column] of [['status', 'status'], ['location', 'location'], ['type', 'employmentType'], ['work', 'workMode'], ['source', 'source']]) if (filters[key]) { clauses.push(`a.${column}=?`); args.push(filters[key]!) }
    for (const [key, column, op] of [['min', 'salary', '>='], ['max', 'salary', '<='], ['from', 'dateApplied', '>='], ['to', 'dateApplied', '<=']]) if (filters[key]) { clauses.push(`a.${column}${op}?`); args.push(['min', 'max'].includes(key) ? Number(filters[key]) : filters[key]!) }
    if (filters.tag) { clauses.push('EXISTS (SELECT 1 FROM application_tags at JOIN tags t ON t.id=at.tagId AND t.userId=at.userId WHERE at.applicationId=a.id AND at.userId=a.userId AND lower(t.name)=lower(?))'); args.push(filters.tag) }
    if (query.q.trim()) { clauses.push("instr(lower(a.company||' '||a.position||' '||a.location||' '||a.notes||' '||coalesce((SELECT group_concat(c.name,' ') FROM contacts c JOIN application_contacts ac ON ac.contactId=c.id AND ac.userId=c.userId WHERE ac.applicationId=a.id AND ac.userId=a.userId),'')||' '||coalesce((SELECT group_concat(t.name,' ') FROM tags t JOIN application_tags at ON at.tagId=t.id AND at.userId=t.userId WHERE at.applicationId=a.id AND at.userId=a.userId),'')),lower(?))>0"); args.push(query.q.trim()) }
    const where = clauses.join(' AND '), order = ({ oldest: 'a.dateApplied ASC', company: 'a.company COLLATE NOCASE', salary: 'a.salary DESC' } as Record<string, string>)[filters.sort ?? ''] ?? 'a.dateApplied DESC'
    const total = Number(db.prepare(`SELECT count(*) n FROM applications a WHERE ${where}`).get(...args)!.n), page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)))
    const ids = db.prepare(`SELECT a.id FROM applications a WHERE ${where} ORDER BY ${order},a.createdAt DESC,a.id LIMIT ? OFFSET ?`).all(...args, query.pageSize, (page - 1) * query.pageSize).map(row => String(row.id))
    const apps = new Map(repo.applications(userId, ids, 1).map(app => [app.id, app]))
    const counts = db.prepare('SELECT status,archivedAt<>\'\' archived,count(*) n FROM applications WHERE userId=? GROUP BY status,archived').all(userId)
    res.json({ items: ids.map(id => apps.get(id)), total, page, pageSize: query.pageSize,
      current: counts.filter(row => !row.archived).reduce((n, row) => n + Number(row.n), 0), archived: counts.filter(row => row.archived).reduce((n, row) => n + Number(row.n), 0),
      statuses: Object.fromEntries(STATUSES.map(status => [status, counts.filter(row => row.status === status && Boolean(row.archived) === (filters.view === 'archived')).reduce((n, row) => n + Number(row.n), 0)])),
      locations: db.prepare("SELECT DISTINCT location FROM applications WHERE userId=? AND location<>'' ORDER BY location LIMIT 200").all(userId).map(row => row.location),
      tags: db.prepare('SELECT name FROM tags WHERE userId=? ORDER BY name LIMIT 200').all(userId).map(row => row.name) })
  })
  for (const [path, table, parse, fields] of [
    ['/saved-jobs/page', 'saved_jobs', (row: unknown) => savedJobSchema.parse(row), ['company', 'position', 'notes']],
    ['/contacts', 'contacts', (row: unknown) => contactSchema.parse(row), ['name', 'company', 'email', 'notes']],
  ] as const) router.get(path, (req, res) => {
    const query = querySchema.parse(req.query), args = [res.locals.userId, query.q.trim()]
    const where = `userId=? AND instr(lower(${fields.join("||' '||")}),lower(?))>0`
    const total = Number(db.prepare(`SELECT count(*) n FROM ${table} WHERE ${where}`).get(...args)!.n), page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)))
    res.json({ items: db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY createdAt DESC,id LIMIT ? OFFSET ?`).all(...args, query.pageSize, (page - 1) * query.pageSize).map(row => parse({ ...row, salary: row.salary ?? undefined })), total, page, pageSize: query.pageSize })
  })
  router.get('/overview', (_req, res) => res.json(overview(db, res.locals.userId)))
  router.get('/applications/:id/activity', (req, res) => {
    const userId = res.locals.userId, id = String(req.params.id), query = querySchema.parse(req.query)
    repo.application(userId, id)
    const total = Number(db.prepare('SELECT count(*) n FROM timeline_events WHERE userId=? AND applicationId=?').get(userId, id)!.n), page = Math.min(query.page, Math.max(1, Math.ceil(total / 20)))
    const schema = applicationSchema.shape.timeline.unwrap().element
    res.json({ items: db.prepare('SELECT * FROM timeline_events WHERE userId=? AND applicationId=? ORDER BY at DESC,id DESC LIMIT 20 OFFSET ?').all(userId, id, (page - 1) * 20).map(row => schema.parse({ ...row, status: row.status ?? undefined })), total, page, pageSize: 20 })
  })
  return router
}

// Only compact facts cross this boundary; histories and personal notes are not hydrated for analytics.
export function overview(db: DatabaseSync, userId: string): Overview {
  const facts = db.prepare(`SELECT a.id,a.status,a.dateApplied,a.archivedAt,a.location,a.employmentType,a.source,a.company,a.position,a.createdAt,a.updatedAt,
    EXISTS(SELECT 1 FROM interviews i WHERE i.userId=a.userId AND i.applicationId=a.id AND i.outcome<>'Cancelled') interviewed,
    EXISTS(SELECT 1 FROM timeline_events e WHERE e.userId=a.userId AND e.applicationId=a.id AND (e.status IN ('INTERVIEW','OFFER') OR e.type='interview_completed')) reachedInterview,
    EXISTS(SELECT 1 FROM timeline_events e WHERE e.userId=a.userId AND e.applicationId=a.id AND e.status='OFFER') reachedOffer,
    (SELECT min(e.at) FROM timeline_events e WHERE e.userId=a.userId AND e.applicationId=a.id AND e.type='status' AND e.status<>'APPLIED' AND e.at>=a.dateApplied||'T00:00:00') firstResponse
    FROM applications a WHERE a.userId=?`).all(userId)
  const apps = facts.map(row => applicationSchema.parse({ ...row, timeline: [row.interviewed || row.reachedInterview ? 'INTERVIEW' : null, row.reachedOffer ? 'OFFER' : null].filter(Boolean).map(status => ({ id: String(status), type: 'status', at: row.createdAt, status })) }))
  const current = apps.filter(app => !app.archivedAt), total = apps.length
  const counts = (items: typeof apps) => Object.fromEntries(STATUSES.map(status => [status, items.filter(app => app.status === status).length])) as Overview['statuses']
  const breakdown = (field: 'location' | 'employmentType' | 'source') => {
    const values = new Map<string, number>(); for (const app of apps) { const key = app[field] || 'Not specified'; values.set(key, (values.get(key) ?? 0) + 1) }
    const entries = [...values.entries()].sort((a, b) => b[1] - a[1]); const shown = entries.slice(0, 30), rest = entries.slice(30).reduce((n, item) => n + item[1], 0)
    return [...shown, ...(rest ? [['Other locations', rest] as [string, number]] : [])].map(([label, count]) => ({ label, count, percent: total ? Math.round(count / total * 100) : 0 }))
  }
  const responseDays = facts.flatMap(row => row.firstResponse ? [(Date.parse(String(row.firstResponse)) - Date.parse(`${row.dateApplied}T00:00:00`)) / 86400000] : [])
  const basic = 'id,company,position,dateApplied,status'
  return { metrics: getMetrics(apps), statuses: counts(apps), currentStatuses: counts(current), current: current.length,
    weekly: activityData(apps, 'weekly'), monthly: activityData(apps, 'monthly'), breakdown: { location: breakdown('location'), employmentType: breakdown('employmentType'), source: breakdown('source') },
    responseCount: responseDays.length, responseAverage: responseDays.length ? Math.round(responseDays.reduce((sum, days) => sum + days, 0) / responseDays.length * 10) / 10 : null,
    savedCount: Number(db.prepare('SELECT count(*) n FROM saved_jobs WHERE userId=?').get(userId)!.n),
    deadlines: Number(db.prepare("SELECT count(*) n FROM saved_jobs WHERE userId=? AND deadline<>'' AND deadline<=?").get(userId, dateKey())!.n),
    dueToday: Number(db.prepare("SELECT count(*) n FROM applications WHERE userId=? AND archivedAt='' AND followUpCompletedAt='' AND followUpDate<>'' AND followUpDate<=?").get(userId, dateKey())!.n),
    recent: db.prepare(`SELECT ${basic} FROM applications WHERE userId=? AND archivedAt='' ORDER BY dateApplied DESC,createdAt DESC LIMIT 5`).all(userId) as Overview['recent'],
    followups: db.prepare(`SELECT ${basic},followUpDate FROM applications WHERE userId=? AND archivedAt='' AND followUpCompletedAt='' AND followUpDate<>'' ORDER BY followUpDate LIMIT 4`).all(userId) as Overview['followups'],
    upcoming: db.prepare("SELECT a.id,a.company,a.position,i.id interviewId,i.scheduledAt interviewDate,i.type interviewType FROM interviews i JOIN applications a ON a.id=i.applicationId AND a.userId=i.userId WHERE i.userId=? AND a.archivedAt='' AND i.outcome='Scheduled' AND i.scheduledAt>=? ORDER BY i.scheduledAt LIMIT 3").all(userId, new Date().toISOString()) as Overview['upcoming'],
    activity: db.prepare('SELECT a.id applicationId,a.company,e.id,e.type,e.at,e.status,e.description FROM timeline_events e JOIN applications a ON a.id=e.applicationId AND a.userId=e.userId WHERE e.userId=? ORDER BY e.at DESC LIMIT 5').all(userId).map(row => ({ app: { id: String(row.applicationId), company: String(row.company) }, event: { id: String(row.id), type: row.type, at: String(row.at), status: row.status ?? undefined, description: row.description } })) as Overview['activity'],
  }
}
