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
    old.prepare('INSERT INTO timeline_events (id,applicationId,userId,type,at,status,description) VALUES (?,?,?,?,?,?,?)').run('e1', 'a1', 'u1', 'created', time, 'APPLIED', 'Original application')
    old.close()
    const migrated = openDatabase(path)
    const app = migrated.prepare('SELECT * FROM applications WHERE id=?').get('a1')!
    const interview = migrated.prepare('SELECT * FROM interviews WHERE id=?').get('i1')!
    expect(app).toMatchObject({ company: 'Old Company', source: '', deadline: '', archivedAt: '', followUpReason: '', followUpNote: '' })
    expect(interview).toMatchObject({ type: 'Video', round: '', location: '' })
    expect(migrated.prepare('SELECT COUNT(*) AS n FROM saved_jobs').get()).toMatchObject({ n: 0 })
    expect(migrated.prepare('SELECT c.name FROM companies c JOIN application_companies ac ON ac.companyId=c.id AND ac.userId=c.userId WHERE ac.applicationId=?').get('a1')).toMatchObject({ name: 'Old Company' })
    expect(migrated.prepare('SELECT description FROM timeline_events WHERE id=?').get('e1')).toMatchObject({ description: 'Original application' })
    expect(migrated.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    expect(migrated.prepare('SELECT sum(xp) xp FROM reward_events WHERE userId=?').get('u1')).toMatchObject({ xp: 55 })
    expect(migrated.prepare('SELECT DISTINCT source FROM reward_events').all()).toEqual([{ source: 'backfill' }])
    expect(migrated.prepare('SELECT createdAt FROM reward_events WHERE type=?').get('APPLICATION_SUBMITTED')!.createdAt).toBe(time)
    expect(migrated.prepare('SELECT id FROM user_achievements WHERE userId=? ORDER BY id').all('u1').map(row => row.id)).toEqual(['conversation', 'first-step'])
    expect(migrated.prepare('SELECT name FROM sqlite_master WHERE type=\'index\' AND name IN (\'tasks_user_due\',\'application_companies_company\',\'notes_application\')').all()).toHaveLength(3)
    // Simulate a database opened by the watcher before the explicit UPSERT fix.
    const triggerUpgrade = readFileSync(fileURLToPath(new URL('./migrations/005_journey_trigger_integrity.sql', import.meta.url)), 'utf8')
    migrated.exec(triggerUpgrade.replaceAll('INSERT INTO', 'INSERT OR IGNORE INTO').replaceAll(' ON CONFLICT DO NOTHING', ''))
    migrated.prepare('DELETE FROM migrations WHERE name=?').run('005_journey_trigger_integrity.sql')
    migrated.close()
    const reopened = openDatabase(path)
    expect(reopened.prepare('SELECT sum(xp) xp FROM reward_events WHERE userId=?').get('u1')).toMatchObject({ xp: 55 })
    expect(reopened.prepare("SELECT sql FROM sqlite_master WHERE name='award_candidate'").get()!.sql).toContain('ON CONFLICT DO NOTHING')
    expect(reopened.prepare("SELECT sql FROM sqlite_master WHERE name='unlock_achievements'").get()!.sql).toContain('ON CONFLICT DO NOTHING')
    expect(reopened.prepare('SELECT count(*) n FROM user_achievements WHERE userId=?').get('u1')).toMatchObject({ n: 2 })
    reopened.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
