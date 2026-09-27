import { randomUUID } from 'node:crypto'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { careerBackupSchema } from '../src/domain/career'
import type { CareerBackup } from '../src/domain/career'
import { ApiError } from './errors'
import { linkCompany } from './companies'

export function exportCareer(db: DatabaseSync, userId: string): CareerBackup {
  const rows = (table: string) => db.prepare(`SELECT * FROM ${table} WHERE userId=?`).all(userId)
  return careerBackupSchema.parse({ companies: rows('companies'), companyLinks: rows('application_companies'), contacts: rows('contacts'), tasks: rows('tasks'), notes: rows('application_notes'), materials: rows('application_materials').map(row => ({ ...row, skills: JSON.parse(String(row.skills)) })), preparations: db.prepare('SELECT p.*,i.applicationId FROM interview_preparations p JOIN interviews i ON i.id=p.interviewId AND i.userId=p.userId WHERE p.userId=?').all(userId).map(row => ({ ...row, topics: JSON.parse(String(row.topics)) })) })
}

export function restoreCareer(db: DatabaseSync, userId: string, backup: CareerBackup, applications: Map<string, string>, interviews: Map<string, string>, contacts: Map<string, { id: string; source: string }>) {
  const insert = (table: string, values: Record<string, SQLInputValue>) => {
    const keys = Object.keys(values)
    db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(values))
  }
  const mapped = (map: Map<string, string>, id: string, kind: string) => {
    const target = map.get(id)
    if (!target) throw new ApiError(422, `This backup contains a ${kind} link to a missing record. Your existing data is unchanged.`)
    return target
  }
  for (const items of [backup.companies, backup.contacts, backup.tasks, backup.notes]) if (new Set(items.map(item => item.id)).size !== items.length) throw new ApiError(422, 'This backup contains duplicate IDs.')
  for (const ids of [backup.companyLinks.map(item => item.applicationId), backup.materials.map(item => item.applicationId), backup.preparations.map(item => item.interviewId)]) if (new Set(ids).size !== ids.length) throw new ApiError(422, 'This backup contains duplicate relationships.')
  const companies = new Map<string, string>()
  db.prepare('DELETE FROM application_companies WHERE userId=?').run(userId)
  db.prepare('DELETE FROM companies WHERE userId=?').run(userId)
  for (const source of backup.companies) {
    const id = randomUUID()
    if (db.prepare('SELECT id FROM companies WHERE userId=? AND name=? COLLATE NOCASE').get(userId, source.name)) throw new ApiError(422, 'Company names must be unique within a backup.')
    insert('companies', { id, userId, name: source.name, website: source.website, industry: source.industry, location: source.location, notes: source.notes, version: 1, createdAt: source.createdAt, updatedAt: source.updatedAt })
    companies.set(source.id, id)
  }
  for (const link of backup.companyLinks) {
    const applicationId = mapped(applications, link.applicationId, 'company'), companyId = mapped(companies, link.companyId, 'company')
    const name = db.prepare('SELECT name FROM companies WHERE userId=? AND id=?').get(userId, companyId)!.name
    if (!db.prepare('SELECT id FROM applications WHERE userId=? AND id=? AND company=? COLLATE NOCASE').get(userId, applicationId, name)) throw new ApiError(422, 'Company names and application company links must agree in this backup.')
    insert('application_companies', { userId, applicationId, companyId })
  }
  for (const row of db.prepare('SELECT id,company FROM applications WHERE userId=? AND id NOT IN (SELECT applicationId FROM application_companies WHERE userId=?)').all(userId, userId)) linkCompany(db, userId, String(row.id), String(row.company))
  const contactKeys = ['name', 'email', 'company', 'role', 'linkedInUrl', 'notes'] as const
  for (const source of backup.contacts) {
    const values = Object.fromEntries(contactKeys.map(key => [key, source[key]]))
    const existing = contacts.get(source.id)
    if (existing) { if (existing.source !== JSON.stringify(values)) throw new ApiError(422, 'This backup contains conflicting versions of the same contact.'); continue }
    insert('contacts', { ...values, id: randomUUID(), userId, version: 1, createdAt: source.createdAt, updatedAt: source.updatedAt })
  }
  db.prepare('DELETE FROM tasks WHERE userId=?').run(userId)
  for (const source of backup.tasks) insert('tasks', { id: randomUUID(), userId, applicationId: source.applicationId ? mapped(applications, source.applicationId, 'task') : null, title: source.title, description: source.description, dueDate: source.dueDate, priority: source.priority, status: source.status, completedAt: source.completedAt, version: 1, createdAt: source.createdAt, updatedAt: source.updatedAt })
  for (const source of backup.notes) insert('application_notes', { id: randomUUID(), userId, applicationId: mapped(applications, source.applicationId, 'note'), body: source.body, version: 1, createdAt: source.createdAt, updatedAt: source.updatedAt })
  for (const source of backup.materials) insert('application_materials', { userId, applicationId: mapped(applications, source.applicationId, 'materials'), jobDescription: source.jobDescription, skills: JSON.stringify(source.skills), resumeVersion: source.resumeVersion, resumeUrl: source.resumeUrl, coverLetter: source.coverLetter, portfolioUrl: source.portfolioUrl, assignmentUrl: source.assignmentUrl, version: 1, updatedAt: source.updatedAt })
  for (const source of backup.preparations) {
    const interviewId = mapped(interviews, source.interviewId, 'interview preparation')
    const ownerApp = db.prepare('SELECT applicationId FROM interviews WHERE userId=? AND id=?').get(userId, interviewId)!
    if (ownerApp.applicationId !== mapped(applications, source.applicationId, 'interview preparation')) throw new ApiError(422, 'Interview preparation links do not match this backup.')
    insert('interview_preparations', { userId, interviewId, topics: JSON.stringify(source.topics), questionsToAsk: source.questionsToAsk, expectedQuestions: source.expectedQuestions, reflection: source.reflection, reflectionNotes: source.reflectionNotes, version: 1, updatedAt: source.updatedAt })
  }
}
