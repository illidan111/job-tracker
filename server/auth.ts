import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Request, Response } from 'express'
import { z } from 'zod/v4'
import { ApiError } from './errors'

export const emailSchema = z.email('Enter a valid email address').max(254).transform(email => email.toLowerCase())
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) })
export const signupSchema = loginSchema.extend({ name: z.string().trim().min(1, 'Your name is required').max(80), password: z.string().min(12, 'Use at least 12 characters').max(128) })
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const userSchema = z.object({ id: z.string(), email: z.string(), passwordHash: z.string() })

// Bound concurrent memory-hard operations to keep authentication load predictable.
let hashing = 0
const waiters: (() => void)[] = []
async function derive(password: string, salt: string): Promise<Buffer> {
  if (hashing >= 2) {
    if (waiters.length >= 20) throw new ApiError(429, 'Too many sign-in requests. Please try again shortly.')
    await new Promise<void>(resolve => waiters.push(resolve))
  } else hashing++
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
    })
  } finally { const next = waiters.shift(); if (next) next(); else hashing-- }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt:${salt}:${(await derive(password, salt)).toString('hex')}`
}

export async function verifyPassword(password: string, encoded?: string) {
  // Unknown accounts still perform the same expensive operation.
  const [, salt, digest] = (encoded ?? `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':')
  const derived = await derive(password, salt)
  const expected = Buffer.from(digest, 'hex')
  return expected.length === derived.length && timingSafeEqual(expected, derived) && Boolean(encoded)
}

export interface AuthOptions { sessionDays: number; secureCookie: boolean; rateLimit?: number }
export class Authentication {
  constructor(private db: DatabaseSync, private options: AuthOptions) {}
  private cookieName() { return this.options.secureCookie ? '__Host-waypoint_session' : 'waypoint_session' }
  private token(request: Request) {
    return request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${this.cookieName()}=`))?.slice(this.cookieName().length + 1) ?? ''
  }
  user(request: Request) {
    const token = this.token(request)
    if (!/^[a-f0-9]{64}$/.test(token)) return null
    const row = this.db.prepare('SELECT users.id,users.email,users.passwordHash FROM sessions JOIN users ON users.id=sessions.userId WHERE sessions.tokenHash=? AND sessions.expiresAt>?').get(hashToken(token), Date.now())
    return row ? userSchema.parse(row) : null
  }
  requireUser(request: Request) {
    const user = this.user(request)
    if (!user) throw new ApiError(401, 'Your session has ended. Sign in again to continue.')
    return user
  }
  limit(request: Request, email: string) {
    const now = Date.now()
    this.db.prepare('DELETE FROM rate_limits WHERE expiresAt < ?').run(now)
    for (const [key, max] of [[`ip:${request.socket.remoteAddress}`, this.options.rateLimit ?? 60], [`email:${hashToken(email)}`, 12]] as const) {
      this.db.prepare('INSERT INTO rate_limits (key,attempts,expiresAt) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key, now + 15 * 60 * 1000)
      const row = this.db.prepare('SELECT attempts FROM rate_limits WHERE key=?').get(key)
      if (Number(row?.attempts) > max) throw new ApiError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.')
    }
  }
  async signup(input: z.infer<typeof signupSchema>) {
    if (this.db.prepare('SELECT id FROM users WHERE email=?').get(input.email)) throw new ApiError(409, 'An account with this email already exists. Try signing in.')
    const passwordHash = await hashPassword(input.password)
    const id = randomUUID()
    const now = new Date().toISOString()
    try {
      this.db.prepare('INSERT INTO users (id,email,passwordHash,name,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run(id, input.email, passwordHash, input.name, now, now)
    } catch (error) {
      if (this.db.prepare('SELECT id FROM users WHERE email=?').get(input.email)) throw new ApiError(409, 'An account with this email already exists. Try signing in.')
      throw error
    }
    return id
  }
  async login(input: z.infer<typeof loginSchema>) {
    const row = this.db.prepare('SELECT id,email,passwordHash FROM users WHERE email=?').get(input.email)
    const user = row ? userSchema.parse(row) : null
    if (!await verifyPassword(input.password, user?.passwordHash)) throw new ApiError(401, 'Email or password is incorrect.')
    return user!.id
  }
  createSession(request: Request, response: Response, userId: string) {
    this.logout(request, response)
    const token = randomBytes(32).toString('hex')
    const maxAge = this.options.sessionDays * 24 * 60 * 60 * 1000
    this.db.prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(Date.now())
    this.db.prepare('INSERT INTO sessions (tokenHash,userId,expiresAt,createdAt) VALUES (?,?,?,?)').run(hashToken(token), userId, Date.now() + maxAge, Date.now())
    response.cookie(this.cookieName(), token, { httpOnly: true, secure: this.options.secureCookie, sameSite: 'strict', path: '/', maxAge })
  }
  logout(request: Request, response: Response) {
    this.db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(hashToken(this.token(request)))
    response.clearCookie(this.cookieName(), { httpOnly: true, secure: this.options.secureCookie, sameSite: 'strict', path: '/' })
  }
}
