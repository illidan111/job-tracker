import { Router } from 'express'
import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod/v4'
import { companyInputSchema, materialsInputSchema, noteInputSchema, preparationInputSchema, TASK_STATUSES, taskInputSchema } from '../src/domain/career'
import { dateSchema } from '../src/validation/application'
import { CareerRepository } from './careerRepository'

const version = z.object({ version: z.number().int().positive() })
const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(100).default('') })
export function careerRoutes(db: DatabaseSync) {
  const router = Router(), repo = new CareerRepository(db)
  router.get('/companies', (req, res) => { const query = pageQuery.parse(req.query); res.json(repo.companies(res.locals.userId, query.q, query.page, query.pageSize)) })
  router.post('/companies', (req, res) => res.status(201).json(repo.saveCompany(res.locals.userId, undefined, companyInputSchema.parse(req.body))))
  router.get('/companies/:id', (req, res) => res.json(repo.company(res.locals.userId, String(req.params.id), pageQuery.parse(req.query).page)))
  router.put('/companies/:id', (req, res) => res.json(repo.saveCompany(res.locals.userId, String(req.params.id), companyInputSchema.parse(req.body), version.parse(req.body).version)))
  router.get('/tasks', (req, res) => res.json(repo.tasks(res.locals.userId, pageQuery.extend({ applicationId: z.string().min(1).max(100).optional(), status: z.enum(TASK_STATUSES).optional() }).parse(req.query))))
  router.get('/tasks/:id', (req, res) => res.json(repo.task(res.locals.userId, String(req.params.id))))
  router.post('/tasks', (req, res) => res.status(201).json(repo.saveTask(res.locals.userId, undefined, taskInputSchema.parse(req.body), undefined, z.object({ requestId: z.uuid().optional() }).parse(req.body).requestId)))
  router.put('/tasks/:id', (req, res) => res.json(repo.saveTask(res.locals.userId, String(req.params.id), taskInputSchema.parse(req.body), version.parse(req.body).version)))
  router.delete('/tasks/:id', (req, res) => { repo.deleteTask(res.locals.userId, String(req.params.id), version.parse(req.body).version); res.status(204).end() })
  router.get('/applications/:id/notes', (req, res) => res.json(repo.notes(res.locals.userId, String(req.params.id), pageQuery.parse(req.query).page)))
  router.post('/applications/:id/notes', (req, res) => res.status(201).json(repo.saveNote(res.locals.userId, String(req.params.id), noteInputSchema.parse(req.body).body, undefined, undefined, z.object({ requestId: z.uuid().optional() }).parse(req.body).requestId)))
  router.put('/applications/:id/notes/:noteId', (req, res) => res.json(repo.saveNote(res.locals.userId, String(req.params.id), noteInputSchema.parse(req.body).body, String(req.params.noteId), version.parse(req.body).version)))
  router.delete('/applications/:id/notes/:noteId', (req, res) => { repo.deleteNote(res.locals.userId, String(req.params.id), String(req.params.noteId), version.parse(req.body).version); res.status(204).end() })
  router.get('/applications/:id/materials', (req, res) => res.json(repo.materials(res.locals.userId, String(req.params.id))))
  router.put('/applications/:id/materials', (req, res) => res.json(repo.saveMaterials(res.locals.userId, String(req.params.id), materialsInputSchema.parse(req.body), z.object({ version: z.number().int().nonnegative() }).parse(req.body).version)))
  router.get('/interviews/:id/preparation', (req, res) => res.json(repo.preparation(res.locals.userId, String(req.params.id))))
  router.put('/interviews/:id/preparation', (req, res) => res.json(repo.savePreparation(res.locals.userId, String(req.params.id), preparationInputSchema.parse(req.body), z.object({ version: z.number().int().nonnegative() }).parse(req.body).version)))
  router.get('/search', (req, res) => res.json(repo.search(res.locals.userId, pageQuery.parse(req.query).q)))
  router.get('/suggestions', (req, res) => res.json(repo.suggestions(res.locals.userId, z.object({ today: dateSchema }).parse(req.query).today)))
  router.get('/schedule', (req, res) => {
    const query = z.object({ from: dateSchema, to: dateSchema, timezone: z.string().max(100).default('UTC').refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false } }, 'Choose a valid timezone'), overdue: z.enum(['true', 'false']).default('false'), page: pageQuery.shape.page }).refine(value => value.from <= value.to && (Date.parse(value.to) - Date.parse(value.from)) / 86400000 <= 93, 'Choose a date range of up to 93 days').parse(req.query)
    res.json(repo.schedule(res.locals.userId, query.from, query.to, query.timezone, query.overdue === 'true', query.page))
  })
  return router
}
