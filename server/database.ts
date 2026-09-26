import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export function transaction<T>(db: DatabaseSync, action: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try { const result = action(); db.exec('COMMIT'); return result } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, appliedAt TEXT NOT NULL) STRICT')
  const directory = fileURLToPath(new URL('./migrations/', import.meta.url))
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT name FROM migrations WHERE name = ?').get(name)) continue
    transaction(db, () => {
      db.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8'))
      db.prepare('INSERT INTO migrations (name,appliedAt) VALUES (?,?)').run(name, new Date().toISOString())
    })
  }
  return db
}
