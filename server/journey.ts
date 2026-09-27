import type { DatabaseSync } from 'node:sqlite'
import { Router } from 'express'
import { z } from 'zod/v4'
import { COMPANIONS, levelFor } from '../src/domain/journey'
import type { Journey, JourneyStep } from '../src/domain/journey'

export function activityStreak(days: string[], today: string) {
  const unique = new Set(days)
  const cursor = new Date(today + 'T12:00:00Z')
  if (!unique.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let current = 0
  while (unique.has(cursor.toISOString().slice(0, 10))) { current++; cursor.setUTCDate(cursor.getUTCDate() - 1) }
  return { current, activeDays: unique.size }
}

export function journey(db: DatabaseSync, userId: string): Journey {
  const preference = db.prepare('SELECT companion,enabled FROM user_progress WHERE userId=?').get(userId)!
  const xp = Number(db.prepare('SELECT coalesce(sum(xp),0) xp FROM reward_events WHERE userId=?').get(userId)!.xp)
  const counts = Object.fromEntries(db.prepare('SELECT type,count(*) n FROM reward_events WHERE userId=? AND xp>0 GROUP BY type').all(userId).map(row => [String(row.type), Number(row.n)]))
  const now = new Date(), today = now.toISOString().slice(0, 10)
  const week = new Date(now); week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7))
  const days = db.prepare("SELECT DISTINCT substr(createdAt,1,10) day FROM reward_events WHERE userId=? AND source='action' AND xp>0").all(userId).map(row => String(row.day))
  const weeklyCount = Number(db.prepare("SELECT count(*) n FROM reward_events WHERE userId=? AND type='APPLICATION_SUBMITTED' AND source='action' AND createdAt>=?").get(userId, week.toISOString().slice(0, 10))!.n)
  const target = Number(db.prepare('SELECT weeklyGoal FROM users WHERE id=?').get(userId)!.weeklyGoal)
  const quests: JourneyStep[] = []
  const soon = new Date(now); soon.setUTCDate(soon.getUTCDate() + 7)
  for (const row of db.prepare("SELECT i.id,i.applicationId,i.scheduledAt,a.company FROM interviews i JOIN applications a ON a.id=i.applicationId AND a.userId=i.userId WHERE i.userId=? AND a.archivedAt='' AND i.outcome='Scheduled' AND i.scheduledAt>=? AND i.scheduledAt<=? AND NOT EXISTS(SELECT 1 FROM interview_preparations p WHERE p.userId=i.userId AND p.interviewId=i.id AND json_array_length(p.topics)>0 AND length(trim(p.questionsToAsk))>0 AND NOT EXISTS(SELECT 1 FROM json_each(p.topics) WHERE json_extract(value,'$.done')<>1)) ORDER BY i.scheduledAt LIMIT 2").all(userId, now.toISOString(), soon.toISOString())) quests.push({ id: String(row.id), title: `Prepare for ${row.company}`, detail: 'Review your topics and questions before the conversation.', href: `/applications/${row.applicationId}?interview=${row.id}`, kind: 'Preparation', due: String(row.scheduledAt).slice(0, 10), completed: false })
  for (const row of db.prepare("SELECT id,company,followUpDate,followUpReason FROM applications WHERE userId=? AND archivedAt='' AND followUpDate<>'' AND followUpCompletedAt='' AND followUpDate<=? ORDER BY followUpDate LIMIT 2").all(userId, today)) quests.push({ id: String(row.id), title: `Follow up with ${row.company}`, detail: String(row.followUpReason || 'A short check-in can clarify your next step.'), href: `/applications/${row.id}`, kind: 'Follow-up', due: String(row.followUpDate), completed: false })
  for (const row of db.prepare("SELECT t.id,t.title,t.dueDate FROM tasks t LEFT JOIN applications a ON a.id=t.applicationId AND a.userId=t.userId WHERE t.userId=? AND t.status='OPEN' AND (a.id IS NULL OR a.archivedAt='') ORDER BY CASE WHEN t.dueDate<>'' AND t.dueDate<=? THEN 0 ELSE 1 END,CASE t.priority WHEN 'HIGH' THEN 0 ELSE 1 END,t.dueDate,t.createdAt LIMIT 2").all(userId, today)) quests.push({ id: String(row.id), title: String(row.title), detail: 'One useful step you chose.', href: `/tasks?task=${row.id}`, kind: 'Task', due: String(row.dueDate), completed: false })
  if (!quests.length) {
    const saved = db.prepare("SELECT company FROM saved_jobs WHERE userId=? ORDER BY deadline='',deadline,createdAt LIMIT 1").get(userId)
    if (saved) quests.push({ id: 'saved', title: `Review ${saved.company}`, detail: 'Decide whether this opportunity belongs on your path.', href: '/saved', kind: 'Discovery', due: '', completed: false })
  }
  const completed = db.prepare("SELECT id,type,createdAt FROM reward_events WHERE userId=? AND source='action' AND xp>0 AND createdAt>=? AND type IN ('TASK_COMPLETED','INTERVIEW_PREPARED','FOLLOWUP_COMPLETED') ORDER BY id DESC LIMIT 3").all(userId, today)
  for (const row of completed) quests.push({ id: `done-${row.id}`, title: row.type === 'TASK_COMPLETED' ? 'A task completed' : row.type === 'INTERVIEW_PREPARED' ? 'Ready for an interview' : 'A follow-up completed', detail: 'Done today. Take it at your own pace.', href: row.type === 'TASK_COMPLETED' ? '/tasks' : '/applications', kind: 'Complete', due: today, completed: true })
  return { xp, progress: levelFor(xp), companion: preference.companion as Journey['companion'], enabled: Boolean(preference.enabled), counts, quests: quests.slice(0, 7), weekly: { count: weeklyCount, target, complete: weeklyCount >= target }, streak: activityStreak(days, today), achievements: db.prepare('SELECT id,unlockedAt,source FROM user_achievements WHERE userId=? ORDER BY unlockedAt DESC,id').all(userId) as Journey['achievements'], events: db.prepare("SELECT id,type,xp,createdAt,source FROM reward_events WHERE userId=? AND xp>0 ORDER BY id DESC LIMIT 12").all(userId) as unknown as Journey['events'] }
}

export function journeyRoutes(db: DatabaseSync) {
  const router = Router()
  router.get('/journey', (_request, response) => response.json(journey(db, response.locals.userId)))
  router.patch('/journey/preferences', (request, response) => {
    const input = z.object({ companion: z.enum(COMPANIONS).optional(), enabled: z.boolean().optional() }).strict().parse(request.body)
    if (input.companion) db.prepare('UPDATE user_progress SET companion=? WHERE userId=?').run(input.companion, response.locals.userId)
    if (input.enabled !== undefined) db.prepare('UPDATE user_progress SET enabled=? WHERE userId=?').run(Number(input.enabled), response.locals.userId)
    response.json(journey(db, response.locals.userId))
  })
  return router
}
