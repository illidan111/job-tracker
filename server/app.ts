import express from 'express'
import type { ErrorRequestHandler } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'
import { z } from 'zod/v4'
import { Authentication, loginSchema, signupSchema } from './auth'
import type { AuthOptions } from './auth'
import { Repository } from './repository'
import { ApiError } from './errors'
import { applicationInputSchema, applicationsSchema, contactInputSchema, interviewInputSchema, optionalDate, profileSchema } from '../src/validation/application'
import { STATUSES } from '../src/types/application'
import { createDemoApplications } from '../src/data/demo'

const versionSchema = z.object({ version: z.number().int().positive() })
export function createApp(db: DatabaseSync, options: AuthOptions & { origin: string; staticDir?: string }) {
  const app = express(), auth = new Authentication(db, options), repo = new Repository(db)
  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" })
    if (options.secureCookie) response.set('Strict-Transport-Security', 'max-age=31536000')
    next()
  })
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (request.headers.origin !== options.origin) return next(new ApiError(403, 'This request came from an unrecognized site. Open Waypoint directly and try again.'))
      if (!request.is('application/json')) return next(new ApiError(415, 'Requests must use JSON.'))
    }
    next()
  })
  app.use(express.json({ limit: '5mb' }))
  app.get('/api/health', (_request, response) => { db.prepare('SELECT 1').get(); response.json({ status: 'ok' }) })
  app.get('/api/auth/session', (request, response) => { const user = auth.user(request); response.json(user ? repo.workspace(user.id) : null) })
  app.post('/api/auth/signup', async (request, response) => {
    const input = signupSchema.parse(request.body)
    auth.limit(request, input.email)
    const id = await auth.signup(input)
    auth.createSession(request, response, id)
    response.status(201).json(repo.workspace(id))
  })
  app.post('/api/auth/login', async (request, response) => {
    const input = loginSchema.parse(request.body)
    auth.limit(request, input.email)
    const id = await auth.login(input)
    auth.createSession(request, response, id)
    response.json(repo.workspace(id))
  })
  app.post('/api/auth/logout', (request, response) => { auth.logout(request, response); response.status(204).end() })
  app.use('/api', (request, response, next) => { response.locals.userId = auth.requireUser(request).id; next() })
  app.get('/api/workspace', (_request, response) => response.json(repo.workspace(response.locals.userId)))
  app.post('/api/applications', (request, response) => response.status(201).json(repo.create(response.locals.userId, applicationInputSchema.parse(request.body))))
  app.get('/api/applications/:id', (request, response) => response.json(repo.application(response.locals.userId, String(request.params.id))))
  app.put('/api/applications/:id', (request, response) => response.json(repo.update(response.locals.userId, String(request.params.id), versionSchema.parse(request.body).version, applicationInputSchema.parse(request.body))))
  app.delete('/api/applications/:id', (request, response) => { repo.remove(response.locals.userId, String(request.params.id), versionSchema.parse(request.body).version); response.status(204).end() })
  app.patch('/api/applications/:id/status', (request, response) => {
    const input = versionSchema.extend({ status: z.enum(STATUSES) }).parse(request.body)
    response.json(repo.status(response.locals.userId, String(request.params.id), input.version, input.status))
  })
  app.patch('/api/applications/:id/follow-up', (request, response) => {
    const input = versionSchema.extend({ date: optionalDate, complete: z.boolean() }).parse(request.body)
    response.json(repo.followUp(response.locals.userId, String(request.params.id), input.version, input.date, input.complete))
  })
  app.post('/api/applications/:id/interviews', (request, response) => response.status(201).json(repo.interview(response.locals.userId, String(request.params.id), versionSchema.parse(request.body).version, interviewInputSchema.parse(request.body))))
  app.put('/api/applications/:id/interviews/:interviewId', (request, response) => response.json(repo.interview(response.locals.userId, String(request.params.id), versionSchema.parse(request.body).version, interviewInputSchema.parse(request.body), String(request.params.interviewId))))
  app.delete('/api/applications/:id/interviews/:interviewId', (request, response) => response.json(repo.interview(response.locals.userId, String(request.params.id), versionSchema.parse(request.body).version, null, String(request.params.interviewId))))
  app.post('/api/applications/:id/contacts', (request, response) => {
    const input = versionSchema.extend({ contactId: z.string().min(1).optional(), contact: contactInputSchema.optional() }).refine(item => Boolean(item.contactId) !== Boolean(item.contact), 'Choose an existing contact or add a new one').parse(request.body)
    repo.attachContact(response.locals.userId, String(request.params.id), input.version, input.contactId, input.contact)
    response.json(repo.workspace(response.locals.userId))
  })
  app.put('/api/contacts/:id', (request, response) => { repo.editContact(response.locals.userId, String(request.params.id), versionSchema.parse(request.body).version, contactInputSchema.parse(request.body)); response.json(repo.workspace(response.locals.userId)) })
  app.delete('/api/applications/:id/contacts/:contactId', (request, response) => { repo.detachContact(response.locals.userId, String(request.params.id), versionSchema.parse(request.body).version, String(request.params.contactId)); response.json(repo.workspace(response.locals.userId)) })
  app.patch('/api/profile', (request, response) => { repo.updateProfile(response.locals.userId, profileSchema.omit({ email: true }).parse(request.body)); response.json(repo.workspace(response.locals.userId)) })
  app.post('/api/notifications/read-all', (_request, response) => { repo.readNotification(response.locals.userId); response.json(repo.workspace(response.locals.userId)) })
  app.post('/api/notifications/:id/read', (request, response) => { repo.readNotification(response.locals.userId, String(request.params.id)); response.json(repo.workspace(response.locals.userId)) })
  app.post('/api/workspace/import', (request, response) => { repo.replace(response.locals.userId, z.object({ applications: applicationsSchema }).parse(request.body).applications); response.json(repo.workspace(response.locals.userId)) })
  app.post('/api/workspace/demo', (_request, response) => { repo.replace(response.locals.userId, createDemoApplications()); response.json(repo.workspace(response.locals.userId)) })
  app.post('/api/workspace/clear', (_request, response) => { repo.replace(response.locals.userId, []); response.json(repo.workspace(response.locals.userId)) })
  app.use('/api', (_request, _response, next) => next(new ApiError(404, 'This endpoint does not exist.')))
  if (options.staticDir) {
    app.use(express.static(options.staticDir, { index: false }))
    app.get('/{*path}', (_request, response) => response.sendFile(resolve(options.staticDir!, 'index.html')))
  }
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof z.ZodError) { response.status(422).json({ error: error.issues[0]?.message ?? 'Please check your input.' }); return }
    if (error instanceof ApiError) { response.status(error.status).json({ error: error.message }); return }
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') { response.status(413).json({ error: 'Choose a file smaller than 5 MB.' }); return }
    if (error instanceof SyntaxError && 'body' in error) { response.status(400).json({ error: 'This request contains invalid JSON.' }); return }
    console.error('API operation failed', error instanceof Error ? error.message : 'Unknown error')
    response.status(503).json({ error: 'The workspace could not be saved. Please try again shortly.' })
  }
  app.use(errors)
  return app
}
