import { randomUUID } from 'node:crypto'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { z } from 'zod/v4'
import type { Application, ApplicationInput, ContactInput, InterviewInput, Notification, Profile, SavedJob, SavedJobInput, Status, TimelineEvent, Workspace } from '../src/types/application'
import { applicationSchema, contactSchema, interviewSchema, profileSchema, savedJobSchema } from '../src/validation/application'
import { dateKey } from '../src/utils/dates'
import { ApiError } from './errors'
import { transaction } from './database'
import { recordActivity } from './activity'
import { linkCompany } from './companies'
import { restoreCareer } from './careerBackup'
import type { CareerBackup } from '../src/domain/career'

const now = () => new Date().toISOString()
const baseKeys = ['company', 'position', 'location', 'salary', 'employmentType', 'workMode', 'status', 'dateApplied', 'jobUrl', 'source', 'deadline', 'notes', 'followUpDate', 'followUpReason', 'followUpNote'] as const
const contactKeys = ['name', 'email', 'company', 'role', 'linkedInUrl', 'notes'] as const
const interviewKeys = ['scheduledAt', 'type', 'interviewer', 'meetingUrl', 'notes', 'outcome', 'round', 'location'] as const
const savedKeys = ['company', 'position', 'location', 'jobUrl', 'salary', 'source', 'deadline', 'notes'] as const
const timelineSchema = applicationSchema.shape.timeline.unwrap().element
const notificationSchema = z.object({ id: z.string(), applicationId: z.string(), kind: z.enum(['interview', 'followup']), title: z.string(), message: z.string(), dueAt: z.string(), readAt: z.string().nullable() })

export class Repository {
  constructor(private db: DatabaseSync) {}
  private insert(table: string, values: Record<string, SQLInputValue>) {
    // Table and column names are internal constants. All external values are bound.
    const keys = Object.keys(values)
    this.db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(values))
  }
  contacts(userId: string, limit = 10000) { return this.db.prepare('SELECT * FROM contacts WHERE userId=? ORDER BY name LIMIT ?').all(userId, limit).map(row => contactSchema.parse(row)) }
  applications(userId: string, id?: string | string[], historyLimit = 1000): Application[] {
    if (Array.isArray(id) && !id.length) return []
    const ids = id ? (Array.isArray(id) ? id : [id]) : []
    const match = ` IN (${ids.map(() => '?').join(',')})`
    const suffix = id ? ` AND applicationId${match}` : ''
    const args = [userId, ...ids]
    const contacts = this.db.prepare(`SELECT c.*,ac.applicationId FROM contacts c JOIN application_contacts ac ON ac.contactId=c.id AND ac.userId=c.userId WHERE ac.userId=?${id ? ` AND ac.applicationId${match}` : ''} ORDER BY ac.linkedAt,c.id`).all(...args)
    const tags = this.db.prepare(`SELECT t.name,at.applicationId FROM tags t JOIN application_tags at ON at.tagId=t.id AND at.userId=t.userId WHERE at.userId=?${id ? ` AND at.applicationId${match}` : ''} ORDER BY t.name`).all(...args)
    const interviews = this.db.prepare(`SELECT * FROM interviews WHERE userId=?${suffix} ORDER BY scheduledAt`).all(...args)
    const events = this.db.prepare(`SELECT * FROM (SELECT *,row_number() OVER (PARTITION BY applicationId ORDER BY at DESC,id DESC) eventNumber FROM timeline_events WHERE userId=?${suffix}) WHERE eventNumber<=? ORDER BY at`).all(...args, historyLimit)
    const group = <T extends { applicationId?: unknown }>(rows: T[]) => {
      const result = new Map<string, T[]>()
      for (const row of rows) { const key = String(row.applicationId); const list = result.get(key) ?? []; list.push(row); result.set(key, list) }
      return result
    }
    const groupedContacts = group(contacts), groupedTags = group(tags), groupedInterviews = group(interviews), groupedEvents = group(events)
    return this.db.prepare(`SELECT a.*,ac.companyId FROM applications a LEFT JOIN application_companies ac ON ac.applicationId=a.id AND ac.userId=a.userId WHERE a.userId=?${id ? ` AND a.id${match}` : ''} ORDER BY a.createdAt DESC`).all(...args).map(row => {
      const appId = String(row.id)
      const appContacts = (groupedContacts.get(appId) ?? []).map(item => contactSchema.parse(item))
      const appInterviews = (groupedInterviews.get(appId) ?? []).map(item => interviewSchema.parse(item))
      return applicationSchema.parse({ ...row, salary: row.salary ?? undefined,
        recruiter: appContacts[0]?.name ?? '', recruiterEmail: appContacts[0]?.email ?? '',
        interviewDate: appInterviews.find(item => item.outcome === 'Scheduled')?.scheduledAt ?? '',
        contacts: appContacts, interviews: appInterviews,
        tags: (groupedTags.get(appId) ?? []).map(item => item.name),
        timeline: (groupedEvents.get(appId) ?? []).map(item => timelineSchema.parse({ ...item, status: item.status ?? undefined })),
      })
    })
  }
  application(userId: string, id: string) {
    const app = this.applications(userId, id, 20)[0]
    if (!app) throw new ApiError(404, 'This application is no longer available. Refresh your workspace.')
    return app
  }
  private check(userId: string, id: string, version: number) {
    const row = this.db.prepare('SELECT version FROM applications WHERE userId=? AND id=?').get(userId, id)
    if (!row) throw new ApiError(404, 'This application is no longer available. Refresh your workspace.')
    if (row.version !== version) throw new ApiError(409, 'This application changed in another window. We refreshed its latest details. Review your changes and try again.')
  }
  private touch(userId: string, id: string) {
    this.db.prepare('UPDATE applications SET version=version+1,updatedAt=? WHERE userId=? AND id=?').run(now(), userId, id)
  }
  private event(userId: string, id: string, type: TimelineEvent['type'], description: string, status?: Status, at = now()) {
    recordActivity(this.db, userId, id, type, description, status, at)
  }
  private tags(userId: string, id: string, names: string[]) {
    this.db.prepare('DELETE FROM application_tags WHERE userId=? AND applicationId=?').run(userId, id)
    for (const name of new Set(names.map(tag => tag.trim()))) {
      this.db.prepare('INSERT INTO tags (id,userId,name) VALUES (?,?,?) ON CONFLICT(userId,name) DO NOTHING').run(randomUUID(), userId, name)
      const tag = this.db.prepare('SELECT id FROM tags WHERE userId=? AND name=?').get(userId, name)!
      this.db.prepare('INSERT OR IGNORE INTO application_tags (applicationId,userId,tagId) VALUES (?,?,?)').run(id, userId, tag.id)
    }
    this.db.prepare('DELETE FROM tags WHERE userId=? AND id NOT IN (SELECT tagId FROM application_tags WHERE userId=?)').run(userId, userId)
  }
  private insertContact(userId: string, input: ContactInput) {
    const id = randomUUID(), time = now()
    this.insert('contacts', { id, userId, ...input, version: 1, createdAt: time, updatedAt: time })
    return id
  }
  private linkContact(userId: string, id: string, contactId: string) {
    this.db.prepare('INSERT OR IGNORE INTO application_contacts (applicationId,userId,contactId,linkedAt) VALUES (?,?,?,?)').run(id, userId, contactId, now())
  }
  private insertInterview(userId: string, id: string, input: InterviewInput) {
    if (Number(this.db.prepare('SELECT COUNT(*) AS n FROM interviews WHERE userId=? AND applicationId=?').get(userId, id)?.n) >= 100) throw new ApiError(422, 'An application can have up to 100 interviews.')
    const time = now()
    const interviewId = randomUUID()
    this.insert('interviews', { id: interviewId, applicationId: id, userId, ...input, createdAt: time, updatedAt: time })
    return interviewId
  }
  private legacyFields(userId: string, id: string, input: ApplicationInput, before?: Application) {
    if (input.recruiter !== (before?.recruiter ?? '') || input.recruiterEmail !== (before?.recruiterEmail ?? '')) {
      const primary = before?.contacts[0]
      if (primary) this.db.prepare('DELETE FROM application_contacts WHERE userId=? AND applicationId=? AND contactId=?').run(userId, id, primary.id)
      if (input.recruiter || input.recruiterEmail) {
        const name = input.recruiter || input.recruiterEmail
        const match = this.db.prepare('SELECT id FROM contacts WHERE userId=? AND name=? AND email=? AND company=?').get(userId, name, input.recruiterEmail, input.company)
        this.linkContact(userId, id, match ? String(match.id) : this.insertContact(userId, { name, email: input.recruiterEmail, company: input.company, role: 'Recruiter', linkedInUrl: '', notes: '' }))
      }
      this.event(userId, id, 'contact', input.recruiter || input.recruiterEmail ? `Contact added: ${input.recruiter || input.recruiterEmail}` : 'Primary contact removed')
    }
    if (input.interviewDate !== (before?.interviewDate ?? '')) {
      const current = before?.interviews.find(item => item.outcome === 'Scheduled')
      if (current) this.db.prepare('UPDATE interviews SET scheduledAt=?,outcome=?,updatedAt=? WHERE userId=? AND applicationId=? AND id=?').run(input.interviewDate || current.scheduledAt, input.interviewDate ? 'Scheduled' : 'Cancelled', now(), userId, id, current.id)
      else if (input.interviewDate) this.insertInterview(userId, id, { scheduledAt: input.interviewDate, type: 'Video', interviewer: input.recruiter, meetingUrl: '', notes: '', outcome: 'Scheduled', round: '', location: '' })
      this.event(userId, id, input.interviewDate ? 'interview_scheduled' : 'interview_cancelled', input.interviewDate ? 'Interview scheduled' : 'Interview cancelled')
    }
  }
  private insertApplication(userId: string, input: ApplicationInput, id = randomUUID(), createdAt = now()) {
    this.insert('applications', { id, userId, ...Object.fromEntries(baseKeys.map(key => [key, input[key] ?? null])), createdAt, updatedAt: createdAt, version: 1 })
    linkCompany(this.db, userId, id, input.company)
    this.tags(userId, id, input.tags)
    return id
  }
  create(userId: string, input: ApplicationInput) {
    const count = Number(this.db.prepare('SELECT COUNT(*) AS n FROM applications WHERE userId=?').get(userId)?.n)
    if (count >= 10000) throw new ApiError(422, 'Your workspace has reached the 10,000 application limit.')
    const id = transaction(this.db, () => {
      const id = this.insertApplication(userId, input)
      this.event(userId, id, 'created', 'Application added', input.status)
      this.legacyFields(userId, id, input)
      if (input.followUpDate) this.event(userId, id, 'followup_scheduled', `Follow-up scheduled for ${input.followUpDate}`)
      return id
    })
    return this.application(userId, id)
  }
  update(userId: string, id: string, version: number, input: ApplicationInput) {
    transaction(this.db, () => {
      this.check(userId, id, version)
      const before = this.application(userId, id)
      this.db.prepare(`UPDATE applications SET ${baseKeys.map(key => `${key}=?`).join(',')},followUpCompletedAt=? WHERE userId=? AND id=?`).run(...baseKeys.map(key => input[key] ?? null), input.followUpDate === before.followUpDate ? before.followUpCompletedAt : '', userId, id)
      this.tags(userId, id, input.tags)
      linkCompany(this.db, userId, id, input.company)
      this.legacyFields(userId, id, input, before)
      this.event(userId, id, before.status === input.status ? 'updated' : 'status', before.status === input.status ? 'Application details updated' : `Moved to ${input.status.toLowerCase()}`, input.status)
      if (before.followUpDate !== input.followUpDate) this.event(userId, id, 'followup_scheduled', input.followUpDate ? `Follow-up scheduled for ${input.followUpDate}` : 'Follow-up removed')
      this.touch(userId, id)
    })
    return this.application(userId, id)
  }
  status(userId: string, id: string, version: number, status: Status) {
    transaction(this.db, () => {
      this.check(userId, id, version)
      const previous = this.db.prepare('SELECT status FROM applications WHERE userId=? AND id=?').get(userId, id)
      if (previous?.status === status) return
      this.db.prepare('UPDATE applications SET status=? WHERE userId=? AND id=?').run(status, userId, id)
      this.event(userId, id, 'status', `Moved to ${status.toLowerCase()}`, status)
      this.touch(userId, id)
    })
    return this.application(userId, id)
  }
  remove(userId: string, id: string, version: number) {
    transaction(this.db, () => { this.check(userId, id, version); this.db.prepare('DELETE FROM applications WHERE userId=? AND id=?').run(userId, id) })
  }
  savedJobs(userId: string, limit = 10000): SavedJob[] {
    return this.db.prepare('SELECT * FROM saved_jobs WHERE userId=? ORDER BY createdAt DESC LIMIT ?').all(userId, limit).map(row => savedJobSchema.parse({ ...row, salary: row.salary ?? undefined }))
  }
  private savedJob(userId: string, id: string) {
    const row = this.db.prepare('SELECT * FROM saved_jobs WHERE userId=? AND id=?').get(userId, id)
    if (!row) throw new ApiError(404, 'This saved job is no longer available.')
    return savedJobSchema.parse({ ...row, salary: row.salary ?? undefined })
  }
  private checkSaved(userId: string, id: string, version: number) {
    const job = this.savedJob(userId, id)
    if (job.version !== version) throw new ApiError(409, 'This saved job changed in another window. Refresh and try again.')
    return job
  }
  createSavedJob(userId: string, input: SavedJobInput) {
    if (Number(this.db.prepare('SELECT COUNT(*) AS n FROM saved_jobs WHERE userId=?').get(userId)?.n) >= 10000) throw new ApiError(422, 'Your saved jobs have reached the 10,000 job limit.')
    const id = randomUUID(), time = now()
    this.insert('saved_jobs', { id, userId, ...Object.fromEntries(savedKeys.map(key => [key, input[key] ?? null])), version: 1, createdAt: time, updatedAt: time })
    return this.savedJob(userId, id)
  }
  updateSavedJob(userId: string, id: string, version: number, input: SavedJobInput) {
    transaction(this.db, () => {
      this.checkSaved(userId, id, version)
      this.db.prepare(`UPDATE saved_jobs SET ${savedKeys.map(key => `${key}=?`).join(',')},version=version+1,updatedAt=? WHERE userId=? AND id=?`).run(...savedKeys.map(key => input[key] ?? null), now(), userId, id)
    })
    return this.savedJob(userId, id)
  }
  removeSavedJob(userId: string, id: string, version: number) {
    transaction(this.db, () => { this.checkSaved(userId, id, version); this.db.prepare('DELETE FROM saved_jobs WHERE userId=? AND id=?').run(userId, id) })
  }
  applySavedJob(userId: string, id: string, version: number, dateApplied: string) {
    const applicationId = transaction(this.db, () => {
      const job = this.checkSaved(userId, id, version)
      if (Number(this.db.prepare('SELECT COUNT(*) AS n FROM applications WHERE userId=?').get(userId)?.n) >= 10000) throw new ApiError(422, 'Your workspace has reached the 10,000 application limit.')
      const applicationId = this.insertApplication(userId, {
        company: job.company, position: job.position, location: job.location, salary: job.salary,
        employmentType: 'Full-time', workMode: 'Not specified', status: 'APPLIED', dateApplied,
        jobUrl: job.jobUrl, source: job.source, deadline: job.deadline, notes: job.notes,
        recruiter: '', recruiterEmail: '', interviewDate: '', tags: [], followUpDate: '', followUpReason: '', followUpNote: '',
      })
      this.event(userId, applicationId, 'created', 'Applied to saved job', 'APPLIED')
      this.db.prepare('DELETE FROM saved_jobs WHERE userId=? AND id=?').run(userId, id)
      return applicationId
    })
    return this.application(userId, applicationId)
  }
  bulk(userId: string, items: { id: string; version: number }[], action: 'status' | 'addTag' | 'removeTag' | 'archive' | 'restore' | 'delete', value?: string) {
    transaction(this.db, () => {
      for (const item of items) this.check(userId, item.id, item.version)
      for (const item of items) {
        if (action === 'delete') { this.db.prepare('DELETE FROM applications WHERE userId=? AND id=?').run(userId, item.id); continue }
        if (action === 'status') {
          const previous = this.db.prepare('SELECT status FROM applications WHERE userId=? AND id=?').get(userId, item.id)
          if (previous?.status === value) continue
          this.db.prepare('UPDATE applications SET status=? WHERE userId=? AND id=?').run(value!, userId, item.id)
          this.event(userId, item.id, 'status', `Moved to ${value?.toLowerCase()}`, value as Status)
        } else if (action === 'addTag' || action === 'removeTag') {
          const app = this.application(userId, item.id)
          const hasTag = app.tags.some(tag => tag.toLowerCase() === value!.toLowerCase())
          if ((action === 'addTag' && hasTag) || (action === 'removeTag' && !hasTag)) continue
          const tags = action === 'addTag' ? [...app.tags, value!] : app.tags.filter(tag => tag.toLowerCase() !== value!.toLowerCase())
          if (tags.length > 10) throw new ApiError(422, 'An application can have up to 10 tags.')
          this.tags(userId, item.id, tags)
          this.event(userId, item.id, 'updated', action === 'addTag' ? `Tag added: ${value}` : `Tag removed: ${value}`)
        } else {
          const alreadyArchived = Boolean(this.db.prepare('SELECT archivedAt FROM applications WHERE userId=? AND id=?').get(userId, item.id)?.archivedAt)
          if ((action === 'archive' && alreadyArchived) || (action === 'restore' && !alreadyArchived)) continue
          const archivedAt = action === 'archive' ? now() : ''
          this.db.prepare('UPDATE applications SET archivedAt=? WHERE userId=? AND id=?').run(archivedAt, userId, item.id)
          this.event(userId, item.id, 'updated', action === 'archive' ? 'Application archived' : 'Application restored')
        }
        this.touch(userId, item.id)
      }
    })
    return this.workspace(userId)
  }
  followUp(userId: string, id: string, version: number, date: string, complete: boolean, reason: string, note: string) {
    transaction(this.db, () => {
      this.check(userId, id, version)
      if (complete && !date) throw new ApiError(422, 'Set a follow-up date before marking it complete.')
      this.db.prepare('UPDATE applications SET followUpDate=?,followUpCompletedAt=?,followUpReason=?,followUpNote=? WHERE userId=? AND id=?').run(date, complete ? now() : '', reason, note, userId, id)
      this.event(userId, id, complete ? 'followup_completed' : 'followup_scheduled', complete ? reason ? `Completed: ${reason}` : 'Follow-up completed' : date ? reason ? `${reason} · ${date}` : `Follow-up scheduled for ${date}` : 'Follow-up removed')
      this.touch(userId, id)
    })
    return this.application(userId, id)
  }
  interview(userId: string, id: string, version: number, input: InterviewInput | null, interviewId?: string) {
    transaction(this.db, () => {
      this.check(userId, id, version)
      if (interviewId) {
        if (!this.db.prepare('SELECT id FROM interviews WHERE userId=? AND applicationId=? AND id=?').get(userId, id, interviewId)) throw new ApiError(404, 'This interview is no longer available.')
        if (input) this.db.prepare(`UPDATE interviews SET ${interviewKeys.map(key => `${key}=?`).join(',')},updatedAt=? WHERE userId=? AND applicationId=? AND id=?`).run(...interviewKeys.map(key => input[key]), now(), userId, id, interviewId)
        else this.db.prepare('DELETE FROM interviews WHERE userId=? AND applicationId=? AND id=?').run(userId, id, interviewId)
      } else if (input) {
        this.insertInterview(userId, id, input)
      }
      const type = !input ? 'interview_deleted' : input.outcome === 'Cancelled' ? 'interview_cancelled' : input.outcome !== 'Scheduled' ? 'interview_completed' : interviewId ? 'interview_updated' : 'interview_scheduled'
      this.event(userId, id, type, input ? `${input.type} interview · ${input.outcome.toLowerCase()}` : 'Interview removed')
      this.touch(userId, id)
    })
    return this.application(userId, id)
  }
  attachContact(userId: string, id: string, version: number, contactId?: string, input?: ContactInput) {
    transaction(this.db, () => {
      this.check(userId, id, version)
      if (contactId && this.db.prepare('SELECT contactId FROM application_contacts WHERE userId=? AND applicationId=? AND contactId=?').get(userId, id, contactId)) return
      if (Number(this.db.prepare('SELECT COUNT(*) AS n FROM application_contacts WHERE userId=? AND applicationId=?').get(userId, id)?.n) >= 30) throw new ApiError(422, 'An application can have up to 30 contacts.')
      if (contactId && !this.db.prepare('SELECT id FROM contacts WHERE userId=? AND id=?').get(userId, contactId)) throw new ApiError(404, 'This contact is no longer available.')
      const target = contactId ?? this.insertContact(userId, input!)
      this.linkContact(userId, id, target)
      const contact = this.db.prepare('SELECT name FROM contacts WHERE userId=? AND id=?').get(userId, target)!
      this.event(userId, id, 'contact', `Contact added: ${contact.name}`)
      this.touch(userId, id)
    })
  }
  editContact(userId: string, contactId: string, version: number, input: ContactInput) {
    transaction(this.db, () => {
      const contact = this.db.prepare('SELECT version FROM contacts WHERE userId=? AND id=?').get(userId, contactId)
      if (!contact) throw new ApiError(404, 'This contact is no longer available.')
      if (contact.version !== version) throw new ApiError(409, 'This contact has changed. Review the latest details and try again.')
      this.db.prepare(`UPDATE contacts SET ${contactKeys.map(key => `${key}=?`).join(',')},version=version+1,updatedAt=? WHERE userId=? AND id=?`).run(...contactKeys.map(key => input[key]), now(), userId, contactId)
      for (const row of this.db.prepare('SELECT applicationId FROM application_contacts WHERE userId=? AND contactId=?').all(userId, contactId)) { this.event(userId, String(row.applicationId), 'contact', `Contact updated: ${input.name}`); this.touch(userId, String(row.applicationId)) }
    })
  }
  detachContact(userId: string, id: string, version: number, contactId: string) {
    transaction(this.db, () => {
      this.check(userId, id, version)
      const result = this.db.prepare('DELETE FROM application_contacts WHERE userId=? AND applicationId=? AND contactId=?').run(userId, id, contactId)
      if (!result.changes) throw new ApiError(404, 'This contact is no longer linked.')
      this.event(userId, id, 'contact', 'Contact unlinked')
      this.touch(userId, id)
    })
  }
  private profile(userId: string) {
    const user = this.db.prepare('SELECT * FROM users WHERE id=?').get(userId)
    if (!user) throw new ApiError(401, 'Please sign in again.')
    return profileSchema.parse({ ...user, interviewReminders: user.interviewReminders === 1 })
  }
  updateProfile(userId: string, input: Omit<Profile, 'email'>) {
    this.db.prepare('UPDATE users SET name=?,headline=?,weeklyGoal=?,appearance=?,interviewReminders=?,updatedAt=? WHERE id=?').run(input.name, input.headline, input.weeklyGoal, input.appearance, Number(input.interviewReminders), now(), userId)
  }
  notifications(userId: string, page = 1): Notification[] {
    const activeKeys = new Set<string>(), time = Date.now(), today = dateKey(), reminders = this.profile(userId).interviewReminders
    transaction(this.db, () => {
      const put = (applicationId: string, key: string, kind: Notification['kind'], title: string, message: string, dueAt: string) => {
        activeKeys.add(key)
        this.db.prepare('INSERT INTO notifications (id,userId,applicationId,sourceKey,kind,title,message,dueAt) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(userId,sourceKey) DO UPDATE SET title=excluded.title,message=excluded.message,dueAt=excluded.dueAt').run(randomUUID(), userId, applicationId, key, kind, title, message, dueAt)
      }
      if (reminders) for (const row of this.db.prepare("SELECT i.id,i.applicationId,i.scheduledAt,i.type,a.company,a.position FROM interviews i JOIN applications a ON a.id=i.applicationId AND a.userId=i.userId WHERE i.userId=? AND a.archivedAt='' AND i.outcome='Scheduled' AND i.scheduledAt BETWEEN ? AND ?").all(userId, new Date(time - 3600000).toISOString(), new Date(time + 48 * 3600000).toISOString())) put(String(row.applicationId), 'interview:' + row.id + ':' + row.scheduledAt, 'interview', 'Interview with ' + row.company, row.type + ' \u00b7 ' + row.position, String(row.scheduledAt))
      for (const row of this.db.prepare("SELECT id,company,position,followUpDate FROM applications WHERE userId=? AND archivedAt='' AND followUpCompletedAt='' AND followUpDate<>'' AND followUpDate<=?").all(userId, today)) put(String(row.id), 'followup:' + row.id + ':' + row.followUpDate, 'followup', 'Follow up with ' + row.company, String(row.position), String(row.followUpDate))
      for (const row of this.db.prepare('SELECT id,sourceKey FROM notifications WHERE userId=?').all(userId)) if (!activeKeys.has(String(row.sourceKey))) this.db.prepare('DELETE FROM notifications WHERE userId=? AND id=?').run(userId, row.id)
    })
    return this.db.prepare('SELECT * FROM notifications WHERE userId=? ORDER BY readAt IS NOT NULL,dueAt,id LIMIT 50 OFFSET ?').all(userId, (page - 1) * 50).map(row => notificationSchema.parse(row))
  }
  readNotification(userId: string, id?: string) {
    const result = id ? this.db.prepare('UPDATE notifications SET readAt=? WHERE userId=? AND id=?').run(now(), userId, id) : this.db.prepare('UPDATE notifications SET readAt=? WHERE userId=? AND readAt IS NULL').run(now(), userId)
    if (id && !result.changes) throw new ApiError(404, 'This reminder is no longer available.')
  }
  workspace(userId: string): Workspace {
    const profile = this.profile(userId), ids = this.db.prepare('SELECT id FROM applications WHERE userId=? ORDER BY createdAt DESC LIMIT 50').all(userId).map(row => String(row.id)), applications = this.applications(userId, ids, 20)
    return { user: { id: userId, email: profile.email }, profile, applications, savedJobs: this.savedJobs(userId, 200), contacts: this.contacts(userId, 200), notifications: this.notifications(userId) }
  }
  replace(userId: string, applications: Application[], savedJobs?: SavedJob[], career?: CareerBackup) {
    // Validate shared contact consistency before deleting anything; all writes are atomic.
    const contactMap = new Map<string, { id: string; source: string }>()
    const applicationMap = new Map<string, string>(), interviewMap = new Map<string, string>()
    transaction(this.db, () => {
      if (savedJobs) {
        this.db.prepare('DELETE FROM saved_jobs WHERE userId=?').run(userId)
        for (const job of savedJobs) this.insert('saved_jobs', { id: randomUUID(), userId, ...Object.fromEntries(savedKeys.map(key => [key, job[key] ?? null])), version: 1, createdAt: job.createdAt, updatedAt: job.updatedAt })
      }
      this.db.prepare('DELETE FROM applications WHERE userId=?').run(userId)
      this.db.prepare('DELETE FROM contacts WHERE userId=?').run(userId)
      this.db.prepare('DELETE FROM tags WHERE userId=?').run(userId)
      for (const source of applications) {
        const id = this.insertApplication(userId, source, randomUUID(), source.createdAt)
        applicationMap.set(source.id, id)
        this.db.prepare('UPDATE applications SET updatedAt=?,followUpCompletedAt=?,archivedAt=? WHERE userId=? AND id=?').run(source.updatedAt, source.followUpCompletedAt, source.archivedAt, userId, id)
        if (source.contacts.length) for (const contact of source.contacts) {
          const input = Object.fromEntries(contactKeys.map(key => [key, contact[key]])) as ContactInput
          const fingerprint = JSON.stringify(input), existing = contactMap.get(contact.id)
          if (existing && existing.source !== fingerprint) throw new ApiError(422, 'This backup contains conflicting versions of the same contact. Your existing data is unchanged.')
          const target = existing?.id ?? this.insertContact(userId, input)
          contactMap.set(contact.id, { id: target, source: fingerprint })
          this.linkContact(userId, id, target)
        }
        if (source.interviews.length) for (const item of source.interviews) {
          if (interviewMap.has(item.id)) throw new ApiError(422, 'Interview IDs must be unique within a backup.')
          const input = Object.fromEntries(interviewKeys.map(key => [key, item[key]])) as InterviewInput
          interviewMap.set(item.id, this.insertInterview(userId, id, input))
        }
        this.legacyFields(userId, id, { ...source, recruiter: source.contacts.length ? '' : source.recruiter, recruiterEmail: source.contacts.length ? '' : source.recruiterEmail, interviewDate: source.interviews.length ? '' : source.interviewDate })
        this.db.prepare('DELETE FROM timeline_events WHERE userId=? AND applicationId=?').run(userId, id)
        for (const event of source.timeline) this.event(userId, id, event.type, event.description ?? '', event.status, event.at)
        if (!source.timeline.length) this.event(userId, id, 'created', 'Application imported', source.status, source.createdAt)
      }
      if (career) restoreCareer(this.db, userId, career, applicationMap, interviewMap, contactMap)
    })
  }
}
