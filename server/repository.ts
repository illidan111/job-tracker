import { randomUUID } from 'node:crypto'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { z } from 'zod/v4'
import type { Application, ApplicationInput, ContactInput, InterviewInput, Notification, Profile, Status, TimelineEvent, Workspace } from '../src/types/application'
import { applicationSchema, contactSchema, interviewSchema, profileSchema } from '../src/validation/application'
import { dateKey } from '../src/utils/dates'
import { ApiError } from './errors'
import { transaction } from './database'

const now = () => new Date().toISOString()
const baseKeys = ['company', 'position', 'location', 'salary', 'employmentType', 'workMode', 'status', 'dateApplied', 'jobUrl', 'notes', 'followUpDate'] as const
const contactKeys = ['name', 'email', 'company', 'role', 'linkedInUrl', 'notes'] as const
const interviewKeys = ['scheduledAt', 'type', 'interviewer', 'meetingUrl', 'notes', 'outcome'] as const
const timelineSchema = applicationSchema.shape.timeline.unwrap().element
const notificationSchema = z.object({ id: z.string(), applicationId: z.string(), kind: z.enum(['interview', 'followup']), title: z.string(), message: z.string(), dueAt: z.string(), readAt: z.string().nullable() })

export class Repository {
  constructor(private db: DatabaseSync) {}
  private insert(table: string, values: Record<string, SQLInputValue>) {
    // Table and column names are internal constants. All external values are bound.
    const keys = Object.keys(values)
    this.db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(values))
  }
  contacts(userId: string) { return this.db.prepare('SELECT * FROM contacts WHERE userId=? ORDER BY name').all(userId).map(row => contactSchema.parse(row)) }
  applications(userId: string, id?: string): Application[] {
    const suffix = id ? ' AND applicationId=?' : ''
    const args = id ? [userId, id] : [userId]
    const contacts = this.db.prepare(`SELECT c.*,ac.applicationId FROM contacts c JOIN application_contacts ac ON ac.contactId=c.id AND ac.userId=c.userId WHERE ac.userId=?${id ? ' AND ac.applicationId=?' : ''} ORDER BY ac.linkedAt,c.id`).all(...args)
    const tags = this.db.prepare(`SELECT t.name,at.applicationId FROM tags t JOIN application_tags at ON at.tagId=t.id AND at.userId=t.userId WHERE at.userId=?${id ? ' AND at.applicationId=?' : ''} ORDER BY t.name`).all(...args)
    const interviews = this.db.prepare(`SELECT * FROM interviews WHERE userId=?${suffix} ORDER BY scheduledAt`).all(...args)
    const events = this.db.prepare(`SELECT * FROM timeline_events WHERE userId=?${suffix} ORDER BY at`).all(...args)
    const group = <T extends { applicationId?: unknown }>(rows: T[]) => {
      const result = new Map<string, T[]>()
      for (const row of rows) { const key = String(row.applicationId); const list = result.get(key) ?? []; list.push(row); result.set(key, list) }
      return result
    }
    const groupedContacts = group(contacts), groupedTags = group(tags), groupedInterviews = group(interviews), groupedEvents = group(events)
    return this.db.prepare(`SELECT * FROM applications WHERE userId=?${id ? ' AND id=?' : ''} ORDER BY createdAt DESC`).all(...args).map(row => {
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
    const app = this.applications(userId, id)[0]
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
    this.insert('timeline_events', { id: randomUUID(), applicationId: id, userId, type, description: description.slice(0, 500), status: status ?? null, at })
    this.db.prepare('DELETE FROM timeline_events WHERE userId=? AND applicationId=? AND id NOT IN (SELECT id FROM timeline_events WHERE userId=? AND applicationId=? ORDER BY at DESC,rowid DESC LIMIT 1000)').run(userId, id, userId, id)
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
    const time = now()
    this.insert('interviews', { id: randomUUID(), applicationId: id, userId, ...input, createdAt: time, updatedAt: time })
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
      else if (input.interviewDate) this.insertInterview(userId, id, { scheduledAt: input.interviewDate, type: 'Video', interviewer: input.recruiter, meetingUrl: '', notes: '', outcome: 'Scheduled' })
      this.event(userId, id, input.interviewDate ? 'interview_scheduled' : 'interview_cancelled', input.interviewDate ? 'Interview scheduled' : 'Interview cancelled')
    }
  }
  private insertApplication(userId: string, input: ApplicationInput, id = randomUUID(), createdAt = now()) {
    this.insert('applications', { id, userId, ...Object.fromEntries(baseKeys.map(key => [key, input[key] ?? null])), createdAt, updatedAt: createdAt, version: 1 })
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
  followUp(userId: string, id: string, version: number, date: string, complete: boolean) {
    transaction(this.db, () => {
      this.check(userId, id, version)
      if (complete && !date) throw new ApiError(422, 'Set a follow-up date before marking it complete.')
      this.db.prepare('UPDATE applications SET followUpDate=?,followUpCompletedAt=? WHERE userId=? AND id=?').run(date, complete ? now() : '', userId, id)
      this.event(userId, id, complete ? 'followup_completed' : 'followup_scheduled', complete ? 'Follow-up completed' : date ? `Follow-up scheduled for ${date}` : 'Follow-up removed')
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
        if (Number(this.db.prepare('SELECT COUNT(*) AS n FROM interviews WHERE userId=? AND applicationId=?').get(userId, id)?.n) >= 100) throw new ApiError(422, 'An application can have up to 100 interviews.')
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
  private notifications(userId: string, applications: Application[], reminders: boolean): Notification[] {
    const activeKeys = new Set<string>(), time = Date.now(), today = dateKey()
    transaction(this.db, () => {
      const put = (app: Application, key: string, kind: Notification['kind'], title: string, message: string, dueAt: string) => {
        activeKeys.add(key)
        this.db.prepare('INSERT INTO notifications (id,userId,applicationId,sourceKey,kind,title,message,dueAt) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(userId,sourceKey) DO UPDATE SET title=excluded.title,message=excluded.message,dueAt=excluded.dueAt').run(randomUUID(), userId, app.id, key, kind, title, message, dueAt)
      }
      for (const app of applications) {
        if (reminders) for (const item of app.interviews) {
          const delta = Date.parse(item.scheduledAt) - time
          if (item.outcome === 'Scheduled' && delta >= -3600000 && delta <= 48 * 3600000) put(app, `interview:${item.id}:${item.scheduledAt}`, 'interview', `Interview with ${app.company}`, `${item.type} · ${app.position}`, item.scheduledAt)
        }
        if (app.followUpDate && !app.followUpCompletedAt && app.followUpDate <= today) put(app, `followup:${app.id}:${app.followUpDate}`, 'followup', `Follow up with ${app.company}`, app.position, app.followUpDate)
      }
      for (const row of this.db.prepare('SELECT id,sourceKey FROM notifications WHERE userId=?').all(userId)) if (!activeKeys.has(String(row.sourceKey))) this.db.prepare('DELETE FROM notifications WHERE userId=? AND id=?').run(userId, row.id)
    })
    return this.db.prepare('SELECT * FROM notifications WHERE userId=? ORDER BY readAt IS NOT NULL,dueAt').all(userId).map(row => notificationSchema.parse(row))
  }
  readNotification(userId: string, id?: string) {
    const result = id ? this.db.prepare('UPDATE notifications SET readAt=? WHERE userId=? AND id=?').run(now(), userId, id) : this.db.prepare('UPDATE notifications SET readAt=? WHERE userId=? AND readAt IS NULL').run(now(), userId)
    if (id && !result.changes) throw new ApiError(404, 'This reminder is no longer available.')
  }
  workspace(userId: string): Workspace {
    const profile = this.profile(userId), applications = this.applications(userId)
    return { user: { id: userId, email: profile.email }, profile, applications, contacts: this.contacts(userId), notifications: this.notifications(userId, applications, profile.interviewReminders) }
  }
  replace(userId: string, applications: Application[]) {
    // Validate shared contact consistency before deleting anything; all writes are atomic.
    const contactMap = new Map<string, { id: string; source: string }>()
    transaction(this.db, () => {
      this.db.prepare('DELETE FROM applications WHERE userId=?').run(userId)
      this.db.prepare('DELETE FROM contacts WHERE userId=?').run(userId)
      this.db.prepare('DELETE FROM tags WHERE userId=?').run(userId)
      for (const source of applications) {
        const id = this.insertApplication(userId, source, randomUUID(), source.createdAt)
        this.db.prepare('UPDATE applications SET updatedAt=?,followUpCompletedAt=? WHERE userId=? AND id=?').run(source.updatedAt, source.followUpCompletedAt, userId, id)
        if (source.contacts.length) for (const contact of source.contacts) {
          const input = Object.fromEntries(contactKeys.map(key => [key, contact[key]])) as ContactInput
          const fingerprint = JSON.stringify(input), existing = contactMap.get(contact.id)
          if (existing && existing.source !== fingerprint) throw new ApiError(422, 'This backup contains conflicting versions of the same contact. Your existing data is unchanged.')
          const target = existing?.id ?? this.insertContact(userId, input)
          contactMap.set(contact.id, { id: target, source: fingerprint })
          this.linkContact(userId, id, target)
        }
        if (source.interviews.length) for (const item of source.interviews) {
          const input = Object.fromEntries(interviewKeys.map(key => [key, item[key]])) as InterviewInput
          this.insertInterview(userId, id, input)
        }
        this.legacyFields(userId, id, { ...source, recruiter: source.contacts.length ? '' : source.recruiter, recruiterEmail: source.contacts.length ? '' : source.recruiterEmail, interviewDate: source.interviews.length ? '' : source.interviewDate })
        this.db.prepare('DELETE FROM timeline_events WHERE userId=? AND applicationId=?').run(userId, id)
        for (const event of source.timeline) this.event(userId, id, event.type, event.description ?? '', event.status, event.at)
        if (!source.timeline.length) this.event(userId, id, 'created', 'Application imported', source.status, source.createdAt)
      }
    })
  }
}
