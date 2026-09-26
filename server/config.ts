import { resolve } from 'node:path'
import { z } from 'zod/v4'

try { process.loadEnvFile() } catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}

const environment = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'APP_ORIGIN must use HTTP or HTTPS').default(process.env.NODE_ENV === 'production' ? `http://127.0.0.1:${process.env.PORT || '3001'}` : 'http://127.0.0.1:5173'),
  DATABASE_PATH: z.string().min(1).default('./data/waypoint.sqlite'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
}).parse(process.env)

export const config = {
  port: environment.PORT,
  origin: new URL(environment.APP_ORIGIN).origin,
  databasePath: resolve(environment.DATABASE_PATH),
  sessionDays: environment.SESSION_DAYS,
  secureCookie: environment.COOKIE_SECURE === 'true',
}
