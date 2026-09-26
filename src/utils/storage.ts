import { z } from 'zod/v4'
import { applicationsSchema } from '../validation/application'
import type { Application } from '../types/application'

export const STORAGE_KEY = 'waypoint.workspace.v1'
export function readLegacyApplications(): Application[] | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? parseImport(raw) : null
}
export function parseImport(raw: string): Application[] {
  const json: unknown = JSON.parse(raw)
  const envelope = z.object({ version: z.union([z.literal(1), z.literal(2)]), applications: applicationsSchema }).safeParse(json)
  const result = Array.isArray(json) ? applicationsSchema.safeParse(json) : envelope
  if (!result.success) throw new Error('Choose a valid Waypoint JSON export with unique IDs, valid statuses, and valid dates.')
  return Array.isArray(result.data) ? result.data : result.data.applications
}
export function exportApplications(applications: Application[]): string {
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), applications }, null, 2)
}
