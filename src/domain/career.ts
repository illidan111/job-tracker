import { z } from 'zod/v4'
import { contactSchema, optionalDate, optionalUrl } from '../validation/application'

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export const TASK_STATUSES = ['OPEN', 'COMPLETED'] as const
export const INTERVIEW_REFLECTIONS = ['Pending', 'Positive', 'Neutral', 'Negative'] as const
const id = z.string().min(1).max(100)
const timestamp = z.iso.datetime({ offset: true })
const versioned = { id, version: z.number().int().positive(), createdAt: timestamp, updatedAt: timestamp }

export const companyInputSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100),
  website: optionalUrl.default(''), industry: z.string().trim().max(100).default(''),
  location: z.string().trim().max(120).default(''), notes: z.string().max(10000).default(''),
})
export const companySchema = companyInputSchema.extend(versioned)
export type Company = z.infer<typeof companySchema>
export type CompanyInput = z.infer<typeof companyInputSchema>

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(160),
  description: z.string().max(5000).default(''),
  applicationId: id.nullable().default(null), dueDate: optionalDate.default(''),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'), status: z.enum(TASK_STATUSES).default('OPEN'),
})
export const taskSchema = taskInputSchema.extend({ ...versioned, completedAt: z.union([z.literal(''), timestamp]).default(''), applicationLabel: z.string().optional() }).refine(task => (task.status === 'COMPLETED') === Boolean(task.completedAt), 'Task completion date must match its state')
export type Task = z.infer<typeof taskSchema>
export type TaskInput = z.infer<typeof taskInputSchema>

export const noteInputSchema = z.object({ body: z.string().trim().min(1, 'Write a note before saving').max(10000) })
export const noteSchema = noteInputSchema.extend({ ...versioned, applicationId: id })
export type CareerNote = z.infer<typeof noteSchema>

export const materialsInputSchema = z.object({
  jobDescription: z.string().max(30000).default(''),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]).transform(items => [...new Map(items.map(item => [item.toLowerCase(), item])).values()]),
  resumeVersion: z.string().trim().max(120).default(''), resumeUrl: optionalUrl.default(''),
  coverLetter: z.string().max(15000).default(''), portfolioUrl: optionalUrl.default(''), assignmentUrl: optionalUrl.default(''),
})
export const materialsSchema = materialsInputSchema.extend({ applicationId: id, version: z.number().int().nonnegative(), updatedAt: timestamp })
export type Materials = z.infer<typeof materialsSchema>
export type MaterialsInput = z.infer<typeof materialsInputSchema>

export const preparationInputSchema = z.object({
  topics: z.array(z.object({ title: z.string().trim().min(1).max(200), done: z.boolean() })).max(40).default([]),
  questionsToAsk: z.string().max(10000).default(''), expectedQuestions: z.string().max(10000).default(''),
  reflection: z.enum(INTERVIEW_REFLECTIONS).default('Pending'), reflectionNotes: z.string().max(10000).default(''),
})
export const preparationSchema = preparationInputSchema.extend({ interviewId: id, applicationId: id, version: z.number().int().nonnegative(), updatedAt: timestamp })
export type Preparation = z.infer<typeof preparationSchema>
export type PreparationInput = z.infer<typeof preparationInputSchema>

export interface PageResult<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ScheduleItem { id: string; kind: 'interview' | 'followup' | 'task' | 'deadline'; title: string; detail: string; day: string; at: string; href: string; task?: Task }
export interface SchedulePage extends PageResult<ScheduleItem> { days: Record<string, number> }
export interface SearchResult { id: string; kind: 'Applications' | 'Companies' | 'Contacts' | 'Tasks' | 'Notes' | 'Saved jobs'; title: string; detail: string; href: string }

export const careerBackupSchema = z.object({
  companies: z.array(companySchema).max(10000).default([]),
  companyLinks: z.array(z.object({ applicationId: id, companyId: id })).max(10000).default([]),
  contacts: z.array(contactSchema).max(10000).default([]),
  tasks: z.array(taskSchema).max(10000).default([]), notes: z.array(noteSchema).max(10000).default([]),
  materials: z.array(materialsSchema).max(10000).default([]), preparations: z.array(preparationSchema).max(10000).default([]),
})
export type CareerBackup = z.infer<typeof careerBackupSchema>
