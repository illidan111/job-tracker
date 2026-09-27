import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { ApiError } from './errors'

export function linkCompany(db: DatabaseSync, userId: string, applicationId: string, name: string) {
  const time = new Date().toISOString()
  if (!db.prepare('SELECT id FROM companies WHERE userId=? AND name=? COLLATE NOCASE').get(userId, name.trim()) && Number(db.prepare('SELECT count(*) n FROM companies WHERE userId=?').get(userId)!.n) >= 10000) throw new ApiError(422, 'Your workspace has reached the 10,000 company limit.')
  db.prepare('INSERT INTO companies (id,userId,name,createdAt,updatedAt) VALUES (?,?,?,?,?) ON CONFLICT(userId,name) DO NOTHING').run(randomUUID(), userId, name.trim(), time, time)
  const company = db.prepare('SELECT id FROM companies WHERE userId=? AND name=? COLLATE NOCASE').get(userId, name.trim())!
  db.prepare('INSERT INTO application_companies (applicationId,userId,companyId) VALUES (?,?,?) ON CONFLICT(applicationId) DO UPDATE SET companyId=excluded.companyId').run(applicationId, userId, company.id)
  return String(company.id)
}
