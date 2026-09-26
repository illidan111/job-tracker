import { config } from './config'
import { openDatabase } from './database'
import { Authentication, signupSchema } from './auth'
import { Repository } from './repository'
import { createDemoApplications } from '../src/data/demo'

const db = openDatabase(config.databasePath)
try {
  if (process.argv[2] === 'seed') {
    const input = signupSchema.parse({ name: 'Alex Morgan', email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD })
    const auth = new Authentication(db, config)
    const exists = db.prepare('SELECT id FROM users WHERE email=?').get(input.email)
    const userId = exists ? await auth.login(input) : await auth.signup(input)
    const repo = new Repository(db)
    if (repo.applications(userId).length) throw new Error('This account already has applications. Use Settings → Reset demo to explicitly replace them.')
    repo.replace(userId, createDemoApplications())
    console.log(`Seeded 24 applications for ${input.email}. Sign in with the password you configured.`)
  } else if (process.argv[2] === 'migrate') console.log('Database migrations are up to date.')
  else throw new Error('Use npm run db:migrate or npm run db:seed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The database command failed.')
  process.exitCode = 1
} finally { db.close() }
