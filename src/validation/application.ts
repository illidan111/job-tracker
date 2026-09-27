import { z } from 'zod/v4'
import { APPLICATION_SOURCES, EMPLOYMENT_TYPES, EVENT_TYPES, INTERVIEW_OUTCOMES, INTERVIEW_TYPES, STATUSES, WORK_MODES } from '../types/application'

export const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export const dateSchema = z.string().refine(validDate, 'Enter a valid date')
export const optionalEmail = z.string().trim().max(254).refine(value => !value || z.email().safeParse(value).success, 'Enter a valid email address')
export const optionalUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}, 'Enter a complete http:// or https:// URL')
const interviewDate = z.string().refine(value => !value || (/^\d{4}-\d{2}-\d{2}T/.test(value) && validDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value))), 'Enter a valid interview date and time')
const isoDate = z.iso.datetime({ offset: true })
export const optionalDate = z.union([z.literal(''), dateSchema])

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required').max(100),
  email: optionalEmail,
  company: z.string().trim().max(100),
  role: z.string().trim().max(100),
  linkedInUrl: optionalUrl,
  notes: z.string().max(10000),
})
export const contactSchema = contactInputSchema.extend({
  id: z.string().min(1).max(100), version: z.number().int().positive().default(1), createdAt: isoDate, updatedAt: isoDate,
})
export const interviewInputSchema = z.object({
  scheduledAt: isoDate,
  type: z.enum(INTERVIEW_TYPES),
  interviewer: z.string().trim().max(100),
  meetingUrl: optionalUrl,
  notes: z.string().max(10000),
  outcome: z.enum(INTERVIEW_OUTCOMES),
  round: z.string().trim().max(80).default(''),
  location: z.string().trim().max(200).default(''),
})
export const interviewSchema = interviewInputSchema.extend({ id: z.string().min(1).max(100), createdAt: isoDate, updatedAt: isoDate })

const fields = {
  company: z.string().trim().min(1, 'Company is required').max(100),
  position: z.string().trim().min(1, 'Position is required').max(150),
  location: z.string().trim().max(120),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(STATUSES),
  dateApplied: dateSchema,
  jobUrl: optionalUrl,
  source: z.union([z.literal(''), z.enum(APPLICATION_SOURCES)]),
  deadline: optionalDate,
  followUpReason: z.string().trim().max(120),
  followUpNote: z.string().trim().max(1000),
  recruiter: z.string().trim().max(100),
  recruiterEmail: optionalEmail,
  interviewDate,
  notes: z.string().max(10000, 'Keep notes under 10,000 characters'),
  workMode: z.enum(WORK_MODES),
  followUpDate: optionalDate,
}

export const applicationFormSchema = z.object({
  ...fields,
  salary: z.string().refine(value => value === '' || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 100000000), 'Enter a positive annual salary, up to 100,000,000'),
  tags: z.string().max(300).refine(value => value.split(',').filter(s => s.trim()).length <= 10, 'Add up to 10 tags').refine(value => value.split(',').every(tag => tag.trim().length <= 100), 'Each tag must be under 100 characters'),
})
export type ApplicationFormValues = z.infer<typeof applicationFormSchema>

export const applicationSchema = z.object({
  ...fields,
  source: fields.source.default(''),
  deadline: fields.deadline.default(''),
  followUpReason: fields.followUpReason.default(''),
  followUpNote: fields.followUpNote.default(''),
  id: z.string().min(1).max(100),
  companyId: z.string().optional(),
  location: fields.location.default(''),
  salary: z.number().finite().min(0).max(100000000).optional(),
  jobUrl: optionalUrl.default(''),
  recruiter: fields.recruiter.default(''),
  recruiterEmail: optionalEmail.default(''),
  interviewDate: z.union([z.literal(''), isoDate]).default(''),
  notes: fields.notes.default(''),
  tags: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int().positive().default(1),
  workMode: z.enum(WORK_MODES).default('Not specified'),
  followUpDate: optionalDate.default(''),
  followUpCompletedAt: z.union([z.literal(''), isoDate]).default(''),
  archivedAt: z.union([z.literal(''), isoDate]).default(''),
  contacts: z.array(contactSchema).max(30).default([]),
  interviews: z.array(interviewSchema).max(100).default([]),
  timeline: z.array(z.object({
    id: z.string(), type: z.enum(EVENT_TYPES), at: isoDate,
    status: z.enum(STATUSES).optional(),
    description: z.string().max(500).optional(),
  })).max(1000).default([]),
})

export const applicationInputSchema = applicationSchema.omit({
  id: true, companyId: true, createdAt: true, updatedAt: true, timeline: true, version: true, contacts: true, interviews: true, followUpCompletedAt: true, archivedAt: true,
})

export const savedJobInputSchema = z.object({
  company: fields.company,
  position: fields.position,
  location: fields.location.default(''),
  jobUrl: optionalUrl.default(''),
  salary: z.number().finite().min(0).max(100000000).optional(),
  source: fields.source.default(''),
  deadline: optionalDate.default(''),
  notes: fields.notes.default(''),
})
export const savedJobSchema = savedJobInputSchema.extend({ id: z.string(), version: z.number().int().positive(), createdAt: isoDate, updatedAt: isoDate })

export const applicationsSchema = z.array(applicationSchema).max(10000).refine(
  apps => new Set(apps.map(app => app.id)).size === apps.length,
  'Application IDs must be unique',
)

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Your name is required').max(80),
  email: optionalEmail,
  headline: z.string().trim().max(120),
  weeklyGoal: z.number().int().min(1).max(100),
  appearance: z.enum(['light', 'dark', 'system']),
  interviewReminders: z.boolean(),
})
