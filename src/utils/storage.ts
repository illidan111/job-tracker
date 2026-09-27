import { z } from 'zod/v4'
import { applicationsSchema, savedJobSchema } from '../validation/application'
import type { Application, SavedJob } from '../types/application'
import { careerBackupSchema, type CareerBackup } from '../domain/career'

export const STORAGE_KEY = 'waypoint.workspace.v1'
export interface WorkspaceBackup { applications: Application[]; savedJobs: SavedJob[]; career?: CareerBackup }
export function readLegacyApplications(): Application[] | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? parseImport(raw) : null
}
export function parseImport(raw: string): Application[] {
  return parseWorkspaceBackup(raw).applications
}
export function parseWorkspaceBackup(raw: string): WorkspaceBackup {
  const json: unknown = JSON.parse(raw)
  const envelope = z.object({ version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), applications: applicationsSchema, savedJobs: z.array(savedJobSchema).max(10000).optional(), career: careerBackupSchema.optional() }).safeParse(json)
  const result = Array.isArray(json) ? applicationsSchema.safeParse(json) : envelope
  if (!result.success) throw new Error('Choose a valid Waypoint JSON export with unique IDs, valid statuses, and valid dates.')
  if (Array.isArray(result.data)) return { applications: result.data, savedJobs: [] }
  const savedJobs = result.data.savedJobs ?? []
  if (new Set(savedJobs.map(job => job.id)).size !== savedJobs.length) throw new Error('Saved job IDs must be unique.')
  return { applications: result.data.applications, savedJobs, career: result.data.career }
}
export function exportApplications(applications: Application[]): string {
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), applications }, null, 2)
}
export function exportWorkspaceBackup(applications: Application[], savedJobs: SavedJob[]): string {
  return JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), applications, savedJobs }, null, 2)
}
