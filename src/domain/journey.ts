export const COMPANIONS = ['fox', 'cat', 'hare'] as const
export type CompanionKind = typeof COMPANIONS[number]
export const ACHIEVEMENTS = [
  { id: 'first-step', title: 'First step', description: 'Submit your first application.', type: 'APPLICATION_SUBMITTED', target: 1 },
  { id: 'in-motion', title: 'In motion', description: 'Submit 10 distinct applications.', type: 'APPLICATION_SUBMITTED', target: 10 },
  { id: 'open-horizons', title: 'Open horizons', description: 'Submit 50 distinct applications.', type: 'APPLICATION_SUBMITTED', target: 50 },
  { id: 'conversation', title: 'A conversation', description: 'Schedule an interview.', type: 'INTERVIEW_SCHEDULED', target: 1 },
  { id: 'ready', title: 'Ready for the room', description: 'Complete your preparation checklist and questions.', type: 'INTERVIEW_PREPARED', target: 1 },
  { id: 'showed-up', title: 'You showed up', description: 'Complete your first interview.', type: 'INTERVIEW_COMPLETED', target: 1 },
  { id: 'seasoned', title: 'Finding your voice', description: 'Complete 10 interviews.', type: 'INTERVIEW_COMPLETED', target: 10 },
  { id: 'connection', title: 'A new connection', description: 'Add your first contact.', type: 'CONTACT_ADDED', target: 1 },
  { id: 'network', title: 'Building bridges', description: 'Add 5 distinct contacts.', type: 'CONTACT_ADDED', target: 5 },
  { id: 'loop', title: 'Close the loop', description: 'Complete a follow-up.', type: 'FOLLOWUP_COMPLETED', target: 1 },
  { id: 'persistent', title: 'Keep in touch', description: 'Follow up on 10 opportunities.', type: 'FOLLOWUP_COMPLETED', target: 10 },
  { id: 'small-steps', title: 'Small steps add up', description: 'Complete 10 distinct tasks.', type: 'TASK_COMPLETED', target: 10 },
] as const

export function levelFor(xp: number) {
  let level = 1, floor = 0, next = 100
  while (xp >= next) { level++; floor = next; next += 100 + (level - 1) * 50 }
  return { level, floor, next, current: xp - floor, required: next - floor, title: level >= 20 ? 'Trailblazer' : level >= 10 ? 'Pathfinder' : level >= 5 ? 'Explorer' : 'Finding your stride', stage: level >= 20 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1 }
}
export interface JourneyStep { id: string; title: string; detail: string; href: string; kind: string; due: string; completed: boolean }
export interface Journey {
  xp: number; progress: ReturnType<typeof levelFor>; companion: CompanionKind; enabled: boolean
  achievements: { id: string; unlockedAt: string; source: string }[]
  counts: Record<string, number>
  events: { id: number; type: string; xp: number; createdAt: string; source: string }[]
  quests: JourneyStep[]; weekly: { count: number; target: number; complete: boolean }
  streak: { current: number; activeDays: number }
}
