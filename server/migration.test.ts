import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { openDatabase } from './database'

it('migrates an existing application and interview without losing either record', () => {
  const directory = mkdtempSync(join(tmpdir(), 'waypoint-migration-'))
  const path = join(directory, 'old.sqlite')
  try {
    const old = new DatabaseSync(path)
    old.exec('PRAGMA foreign_keys=ON')
    old.exec('CREATE TABLE migrations (name TEXT PRIMARY KEY, appliedAt TEXT NOT NULL) STRICT')
    old.exec(readFileSync(fileURLToPath(new URL('./migrations/001_initial.sql', import.meta.url)), 'utf8'))
    const time = '2026-09-01T10:00:00.000Z'
    old.prepare('INSERT INTO migrations VALUES (?,?)').run('001_initial.sql', time)
    old.prepare('INSERT INTO users (id,email,passwordHash,name,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run('u1', 'legacy@example.test', 'unused', 'Legacy User', time, time)
    old.prepare('INSERT INTO applications (id,userId,company,position,employmentType,status,dateApplied,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run('a1', 'u1', 'Old Company', 'Engineer', 'Full-time', 'APPLIED', '2026-09-01', time, time)
    old.prepare('INSERT INTO interviews (id,applicationId,userId,scheduledAt,type,outcome,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)').run('i1', 'a1', 'u1', time, 'Video', 'Scheduled', time, time)
    old.close()
    const migrated = openDatabase(path)
    const app = migrated.prepare('SELECT * FROM applications WHERE id=?').get('a1')!
    const interview = migrated.prepare('SELECT * FROM interviews WHERE id=?').get('i1')!
    expect(app).toMatchObject({ company: 'Old Company', source: '', deadline: '', archivedAt: '', followUpReason: '', followUpNote: '' })
    expect(interview).toMatchObject({ type: 'Video', round: '', location: '' })
    expect(migrated.prepare('SELECT COUNT(*) AS n FROM saved_jobs').get()).toMatchObject({ n: 0 })
    migrated.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
