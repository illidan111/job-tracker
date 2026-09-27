import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Status, TimelineEvent } from '../src/types/application'

export function recordActivity(db: DatabaseSync, userId: string, applicationId: string, type: TimelineEvent['type'], description: string, status?: Status, at = new Date().toISOString()) {
  db.prepare('INSERT INTO timeline_events (id,userId,applicationId,type,description,status,at) VALUES (?,?,?,?,?,?,?)').run(randomUUID(), userId, applicationId, type, description.slice(0, 500), status ?? null, at)
  db.prepare('DELETE FROM timeline_events WHERE userId=? AND applicationId=? AND id NOT IN (SELECT id FROM timeline_events WHERE userId=? AND applicationId=? ORDER BY at DESC,rowid DESC LIMIT 1000)').run(userId, applicationId, userId, applicationId)
}
