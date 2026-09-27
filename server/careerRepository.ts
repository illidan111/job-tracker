import { randomUUID } from 'node:crypto'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { companySchema, materialsInputSchema, materialsSchema, noteSchema, preparationInputSchema, preparationSchema, taskSchema } from '../src/domain/career'
import type { CompanyInput, MaterialsInput, PageResult, PreparationInput, ScheduleItem, SchedulePage, SearchResult, TaskInput } from '../src/domain/career'
import type { TimelineEvent } from '../src/types/application'
import { ApiError } from './errors'
import { transaction } from './database'
import { recordActivity } from './activity'

const now = () => new Date().toISOString()
const escaped = (query: string) => `%${query.replace(/[\\%_]/g, character => `\\${character}`)}%`
const companyKeys = ['name', 'website', 'industry', 'location', 'notes'] as const
const taskKeys = ['title', 'description', 'applicationId', 'dueDate', 'priority', 'status'] as const
const materialKeys = ['jobDescription', 'resumeVersion', 'resumeUrl', 'coverLetter', 'portfolioUrl', 'assignmentUrl'] as const

export class CareerRepository {
  constructor(private db: DatabaseSync) {}
  private capacity(table: 'tasks' | 'application_notes' | 'companies', userId: string) {
    if (Number(this.db.prepare(`SELECT count(*) n FROM ${table} WHERE userId=?`).get(userId)!.n) >= 10000) throw new ApiError(422, 'This collection has reached its 10,000 record limit.')
  }

  private page<T>(sql: string, args: SQLInputValue[], page: number, pageSize: number, parse: (row: Record<string, unknown>) => T): PageResult<T> {
    const total = Number(this.db.prepare(`SELECT COUNT(*) AS total FROM (${sql})`).get(...args)?.total)
    const current = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
    const rows = this.db.prepare(`${sql} LIMIT ? OFFSET ?`).all(...args, pageSize, (current - 1) * pageSize)
    return { items: rows.map(parse), total, page: current, pageSize }
  }

  application(userId: string, id: string) {
    const row = this.db.prepare('SELECT id,company,position,archivedAt FROM applications WHERE userId=? AND id=?').get(userId, id)
    if (!row) throw new ApiError(404, 'This application is no longer available.')
    return row
  }

  private check(table: 'companies' | 'tasks' | 'application_notes', userId: string, id: string, version?: number) {
    const row = this.db.prepare(`SELECT * FROM ${table} WHERE userId=? AND id=?`).get(userId, id)
    if (!row) throw new ApiError(404, 'This record is no longer available.')
    if (version !== undefined && row.version !== version) throw new ApiError(409, 'This record changed in another window. Close and reopen it to review the latest version. Your draft is still here.')
    return row
  }

  private event(userId: string, applicationId: string | null, type: TimelineEvent['type'], description: string) {
    if (!applicationId) return
    recordActivity(this.db, userId, applicationId, type, description)
    this.db.prepare('UPDATE applications SET version=version+1,updatedAt=? WHERE userId=? AND id=?').run(now(), userId, applicationId)
  }

  companies(userId: string, q: string, page: number, pageSize: number) {
    return this.page('SELECT * FROM companies WHERE userId=? AND name LIKE ? ESCAPE \'\\\' ORDER BY name,id', [userId, escaped(q)], page, pageSize, row => companySchema.parse(row))
  }

  company(userId: string, id: string, page = 1) {
    const company = companySchema.parse(this.check('companies', userId, id))
    const applications = this.page('SELECT a.id,a.company,a.position,a.status,a.archivedAt,a.dateApplied FROM applications a JOIN application_companies ac ON ac.applicationId=a.id AND ac.userId=a.userId WHERE ac.userId=? AND ac.companyId=? ORDER BY a.dateApplied DESC,a.id', [userId, id], page, 20, row => row as { id: string; company: string; position: string; status: string; archivedAt: string; dateApplied: string })
    const contacts = this.db.prepare('SELECT DISTINCT c.id,c.name,c.role,c.email,c.linkedInUrl FROM contacts c LEFT JOIN application_contacts ac ON ac.contactId=c.id AND ac.userId=c.userId LEFT JOIN application_companies co ON co.applicationId=ac.applicationId AND co.userId=ac.userId WHERE c.userId=? AND (co.companyId=? OR c.company=? COLLATE NOCASE) ORDER BY c.name LIMIT 50').all(userId, id, company.name)
    const interviews = this.db.prepare('SELECT i.id,i.type,i.round,i.scheduledAt,i.outcome,i.applicationId FROM interviews i JOIN application_companies ac ON ac.applicationId=i.applicationId AND ac.userId=i.userId WHERE ac.userId=? AND ac.companyId=? ORDER BY i.scheduledAt DESC LIMIT 20').all(userId, id)
    return { company, applications, contacts, interviews }
  }

  saveCompany(userId: string, id: string | undefined, input: CompanyInput, version?: number) {
    const target = id ?? randomUUID()
    transaction(this.db, () => {
      if (id) this.check('companies', userId, id, version)
      const duplicate = this.db.prepare('SELECT id FROM companies WHERE userId=? AND name=? COLLATE NOCASE AND id<>?').get(userId, input.name, target)
      if (duplicate) throw new ApiError(409, 'A company with this name already exists. Open that company to edit its research.')
      if (id) {
        this.db.prepare(`UPDATE companies SET ${companyKeys.map(key => `${key}=?`).join(',')},version=version+1,updatedAt=? WHERE userId=? AND id=?`).run(...companyKeys.map(key => input[key]), now(), userId, id)
        this.db.prepare('UPDATE applications SET company=?,version=version+1,updatedAt=? WHERE userId=? AND id IN (SELECT applicationId FROM application_companies WHERE userId=? AND companyId=?)').run(input.name, now(), userId, userId, id)
      } else {
        this.capacity('companies', userId)
        this.db.prepare('INSERT INTO companies (id,userId,name,website,industry,location,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(target, userId, ...companyKeys.map(key => input[key]), now(), now())
      }
    })
    return companySchema.parse(this.check('companies', userId, target))
  }

  tasks(userId: string, query: { applicationId?: string; status?: string; q: string; page: number; pageSize: number }) {
    if (query.applicationId) this.application(userId, query.applicationId)
    const conditions = ['t.userId=?', "t.title LIKE ? ESCAPE '\\'"], args: SQLInputValue[] = [userId, escaped(query.q)]
    if (query.applicationId) { conditions.push('t.applicationId=?'); args.push(query.applicationId) }
    if (query.status) { conditions.push('t.status=?'); args.push(query.status) }
    return this.page(`SELECT t.*,CASE WHEN a.id IS NOT NULL THEN a.company || ' · ' || a.position ELSE '' END AS applicationLabel FROM tasks t LEFT JOIN applications a ON a.id=t.applicationId AND a.userId=t.userId WHERE ${conditions.join(' AND ')} ORDER BY t.status='COMPLETED',t.dueDate='',t.dueDate,CASE t.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,t.createdAt DESC,t.id`, args, query.page, query.pageSize, row => taskSchema.parse(row))
  }

  task(userId: string, id: string) { return taskSchema.parse(this.check('tasks', userId, id)) }

  saveTask(userId: string, id: string | undefined, input: TaskInput, version?: number, requestId?: string) {
    const target = id ?? requestId ?? randomUUID()
    transaction(this.db, () => {
      const prior = id ? this.check('tasks', userId, id, version) : undefined
      if (!id && this.db.prepare('SELECT id FROM tasks WHERE id=? AND userId=?').get(target, userId)) return
      if (!id) this.capacity('tasks', userId)
      if (input.applicationId) this.application(userId, input.applicationId)
      const completedAt = input.status === 'COMPLETED' ? (prior?.completedAt || now()) : ''
      if (id) this.db.prepare(`UPDATE tasks SET ${taskKeys.map(key => `${key}=?`).join(',')},completedAt=?,version=version+1,updatedAt=? WHERE userId=? AND id=?`).run(...taskKeys.map(key => input[key]), completedAt, now(), userId, id)
      else this.db.prepare('INSERT INTO tasks (id,userId,title,description,applicationId,dueDate,priority,status,completedAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(target, userId, ...taskKeys.map(key => input[key]), completedAt, now(), now())
      this.event(userId, input.applicationId, input.status === 'COMPLETED' && prior?.status !== 'COMPLETED' ? 'task_completed' : id ? 'task_updated' : 'task_created', `${input.status === 'COMPLETED' ? 'Completed' : id ? 'Updated task' : 'Created task'}: ${input.title}`)
    })
    return this.task(userId, target)
  }

  deleteTask(userId: string, id: string, version: number) {
    transaction(this.db, () => {
      const task = taskSchema.parse(this.check('tasks', userId, id, version))
      this.db.prepare('DELETE FROM tasks WHERE userId=? AND id=?').run(userId, id)
      this.event(userId, task.applicationId, 'task_updated', `Task deleted: ${task.title}`)
    })
  }

  notes(userId: string, applicationId: string, page: number) {
    this.application(userId, applicationId)
    return this.page('SELECT * FROM application_notes WHERE userId=? AND applicationId=? ORDER BY createdAt DESC,id', [userId, applicationId], page, 20, row => noteSchema.parse(row))
  }

  saveNote(userId: string, applicationId: string, body: string, id?: string, version?: number, requestId?: string) {
    const target = id ?? requestId ?? randomUUID()
    transaction(this.db, () => {
      this.application(userId, applicationId)
      if (id && this.check('application_notes', userId, id, version).applicationId !== applicationId) throw new ApiError(404, 'This note is no longer available.')
      if (!id && this.db.prepare('SELECT id FROM application_notes WHERE id=? AND userId=? AND applicationId=?').get(target, userId, applicationId)) return
      if (!id) this.capacity('application_notes', userId)
      if (id) this.db.prepare('UPDATE application_notes SET body=?,version=version+1,updatedAt=? WHERE userId=? AND id=?').run(body, now(), userId, id)
      else this.db.prepare('INSERT INTO application_notes (id,userId,applicationId,body,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run(target, userId, applicationId, body, now(), now())
      this.event(userId, applicationId, id ? 'note_updated' : 'note_added', id ? 'Note updated' : 'Note added')
    })
    return noteSchema.parse(this.check('application_notes', userId, target))
  }

  deleteNote(userId: string, applicationId: string, id: string, version: number) {
    transaction(this.db, () => {
      if (this.check('application_notes', userId, id, version).applicationId !== applicationId) throw new ApiError(404, 'This note is no longer available.')
      this.db.prepare('DELETE FROM application_notes WHERE userId=? AND id=?').run(userId, id)
      this.event(userId, applicationId, 'note_deleted', 'Note deleted')
    })
  }

  materials(userId: string, applicationId: string) {
    this.application(userId, applicationId)
    const row = this.db.prepare('SELECT * FROM application_materials WHERE userId=? AND applicationId=?').get(userId, applicationId)
    return materialsSchema.parse(row ? { ...row, skills: JSON.parse(String(row.skills)) } : { ...materialsInputSchema.parse({}), applicationId, version: 0, updatedAt: now() })
  }

  saveMaterials(userId: string, applicationId: string, input: MaterialsInput, version: number) {
    transaction(this.db, () => {
      if (this.materials(userId, applicationId).version !== version) throw new ApiError(409, 'These materials changed. Close and reopen them to review the latest version. Your draft is still here.')
      this.db.prepare(`INSERT INTO application_materials (applicationId,userId,${materialKeys.join(',')},skills,updatedAt) VALUES (${Array(10).fill('?').join(',')}) ON CONFLICT(applicationId) DO UPDATE SET ${materialKeys.map(key => `${key}=excluded.${key}`).join(',')},skills=excluded.skills,updatedAt=excluded.updatedAt,version=version+1`).run(applicationId, userId, ...materialKeys.map(key => input[key]), JSON.stringify(input.skills), now())
      this.event(userId, applicationId, 'materials_updated', 'Application materials updated')
    })
    return this.materials(userId, applicationId)
  }

  preparation(userId: string, interviewId: string) {
    const interview = this.db.prepare('SELECT applicationId FROM interviews WHERE userId=? AND id=?').get(userId, interviewId)
    if (!interview) throw new ApiError(404, 'This interview is no longer available.')
    const row = this.db.prepare('SELECT * FROM interview_preparations WHERE userId=? AND interviewId=?').get(userId, interviewId)
    return preparationSchema.parse(row ? { ...row, applicationId: interview.applicationId, topics: JSON.parse(String(row.topics)) } : { ...preparationInputSchema.parse({}), interviewId, applicationId: interview.applicationId, version: 0, updatedAt: now() })
  }

  savePreparation(userId: string, interviewId: string, input: PreparationInput, version: number) {
    transaction(this.db, () => {
      const existing = this.preparation(userId, interviewId)
      if (existing.version !== version) throw new ApiError(409, 'This preparation changed. Close and reopen it to review the latest version. Your draft is still here.')
      this.db.prepare('INSERT INTO interview_preparations (interviewId,userId,topics,questionsToAsk,expectedQuestions,reflection,reflectionNotes,updatedAt) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(interviewId) DO UPDATE SET topics=excluded.topics,questionsToAsk=excluded.questionsToAsk,expectedQuestions=excluded.expectedQuestions,reflection=excluded.reflection,reflectionNotes=excluded.reflectionNotes,updatedAt=excluded.updatedAt,version=version+1').run(interviewId, userId, JSON.stringify(input.topics), input.questionsToAsk, input.expectedQuestions, input.reflection, input.reflectionNotes, now())
      this.event(userId, existing.applicationId, 'preparation_updated', 'Interview preparation and reflection updated')
    })
    return this.preparation(userId, interviewId)
  }

  search(userId: string, q: string): SearchResult[] {
    if (q.trim().length < 2) return []
    const pattern = escaped(q.trim()), results: SearchResult[] = []
    const add = (kind: SearchResult['kind'], sql: string, href: (row: Record<string, unknown>) => string) => {
      for (const row of this.db.prepare(`${sql} LIMIT 8`).all(userId, pattern)) results.push({ id: String(row.id), kind, title: String(row.title), detail: String(row.detail ?? ''), href: href(row) })
    }
    add('Applications', "SELECT a.id,a.company || ' · ' || a.position AS title,a.status AS detail FROM applications a LEFT JOIN application_materials m ON m.applicationId=a.id AND m.userId=a.userId WHERE a.userId=? AND (a.company || ' ' || a.position || ' ' || a.notes || ' ' || COALESCE(m.jobDescription,'')) LIKE ? ESCAPE '\\' ORDER BY a.updatedAt DESC", row => `/applications/${row.id}`)
    add('Companies', "SELECT id,name AS title,industry AS detail FROM companies WHERE userId=? AND (name || ' ' || notes) LIKE ? ESCAPE '\\' ORDER BY name", row => `/companies/${row.id}`)
    add('Contacts', "SELECT id,name AS title,company || ' · ' || email AS detail,(SELECT applicationId FROM application_contacts ac WHERE ac.contactId=contacts.id AND ac.userId=contacts.userId LIMIT 1) AS applicationId FROM contacts WHERE userId=? AND (name || ' ' || email || ' ' || company) LIKE ? ESCAPE '\\' ORDER BY name", row => row.applicationId ? `/applications/${row.applicationId}` : `/contacts?q=${encodeURIComponent(q)}`)
    add('Tasks', "SELECT id,title,status AS detail FROM tasks WHERE userId=? AND (title || ' ' || description) LIKE ? ESCAPE '\\' ORDER BY updatedAt DESC", row => `/tasks?task=${row.id}`)
    add('Notes', "SELECT id,substr(body,1,120) AS title,'Application note' AS detail,applicationId FROM application_notes WHERE userId=? AND body LIKE ? ESCAPE '\\' ORDER BY createdAt DESC", row => `/applications/${row.applicationId}?tab=notes`)
    add('Saved jobs', "SELECT id,company || ' · ' || position AS title,'Saved job' AS detail FROM saved_jobs WHERE userId=? AND (company || ' ' || position || ' ' || notes) LIKE ? ESCAPE '\\' ORDER BY createdAt DESC", () => `/saved?q=${encodeURIComponent(q)}`)
    return results
  }

  schedule(userId: string, from: string, to: string, timezone: string, overdue: boolean, page: number): SchedulePage {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const dayOf = (at: string) => { const parts = formatter.formatToParts(new Date(at)); return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-') }
    const items: ScheduleItem[] = []
    const start = overdue ? '' : from
    const tasks = this.db.prepare("SELECT t.*,COALESCE(a.company,'') AS company FROM tasks t LEFT JOIN applications a ON a.id=t.applicationId AND a.userId=t.userId WHERE t.userId=? AND t.status='OPEN' AND t.dueDate<>'' AND t.dueDate>=? AND t.dueDate<=? AND (a.id IS NULL OR a.archivedAt='')").all(userId, start, to)
    for (const row of tasks) items.push({ id: String(row.id), kind: 'task', title: String(row.title), detail: String(row.company || 'Personal task'), day: String(row.dueDate), at: '', href: `/tasks?task=${row.id}`, task: taskSchema.parse(row) })
    for (const row of this.db.prepare("SELECT * FROM applications WHERE userId=? AND archivedAt='' AND ((followUpDate<>'' AND followUpCompletedAt='' AND followUpDate>=? AND followUpDate<=?) OR (deadline<>'' AND deadline>=? AND deadline<=?))").all(userId, start, to, start, to)) {
      const detail = `${row.company} · ${row.position}`, href = `/applications/${row.id}`
      if (row.followUpDate && !row.followUpCompletedAt && String(row.followUpDate) >= start && String(row.followUpDate) <= to) items.push({ id: `followup:${row.id}`, kind: 'followup', title: String(row.followUpReason || 'Follow up'), detail, day: String(row.followUpDate), at: '', href })
      if (row.deadline && String(row.deadline) >= start && String(row.deadline) <= to) items.push({ id: `deadline:${row.id}`, kind: 'deadline', title: 'Application deadline', detail, day: String(row.deadline), at: '', href })
    }
    for (const row of this.db.prepare('SELECT * FROM saved_jobs WHERE userId=? AND deadline<>\'\' AND deadline>=? AND deadline<=?').all(userId, start, to)) items.push({ id: `saved:${row.id}`, kind: 'deadline', title: 'Apply to saved job', detail: `${row.company} · ${row.position}`, day: String(row.deadline), at: '', href: `/saved?q=${encodeURIComponent(String(row.company))}` })
    const lower = new Date(`${from}T00:00:00Z`); lower.setUTCDate(lower.getUTCDate() - 1)
    const upper = new Date(`${to}T00:00:00Z`); upper.setUTCDate(upper.getUTCDate() + 2)
    for (const row of this.db.prepare("SELECT i.*,a.company,a.position FROM interviews i JOIN applications a ON a.id=i.applicationId AND a.userId=i.userId WHERE i.userId=? AND i.outcome='Scheduled' AND a.archivedAt='' AND i.scheduledAt>=? AND i.scheduledAt<?").all(userId, lower.toISOString(), upper.toISOString())) {
      const day = dayOf(String(row.scheduledAt))
      if (day >= from && day <= to) items.push({ id: String(row.id), kind: 'interview', title: `${row.round || row.type} interview`, detail: `${row.company} · ${row.position}`, day, at: String(row.scheduledAt), href: `/applications/${row.applicationId}?interview=${row.id}` })
    }
    items.sort((a, b) => a.day.localeCompare(b.day) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    const current = Math.min(page, Math.max(1, Math.ceil(items.length / 100)))
    const days = items.reduce<Record<string, number>>((result, item) => { result[item.day] = (result[item.day] ?? 0) + 1; return result }, {})
    return { items: items.slice((current - 1) * 100, current * 100), total: items.length, page: current, pageSize: 100, days }
  }

  suggestions(userId: string, today: string) {
    return this.db.prepare("SELECT a.id,a.company,a.position FROM applications a WHERE a.userId=? AND a.archivedAt='' AND a.status='SCREENING' AND (a.followUpDate='' OR a.followUpCompletedAt<>'') AND julianday(?) - julianday(COALESCE((SELECT MAX(e.at) FROM timeline_events e WHERE e.userId=a.userId AND e.applicationId=a.id AND e.type='status'),a.createdAt)) >= 7 ORDER BY a.updatedAt LIMIT 5").all(userId, today).map(row => ({ id: String(row.id), title: `Consider following up with ${row.company}`, detail: 'This application has been in Screening for at least 7 days with no open follow-up.', href: `/applications/${row.id}` }))
  }
}
