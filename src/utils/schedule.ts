import { dateKey, parseDate } from './dates'

export function shiftDay(day: string, offset: number) { const date = parseDate(day); date.setDate(date.getDate() + offset); return dateKey(date) }
export function agendaGroup(day: string, today: string) {
  if (day < today) return 'Overdue'
  if (day === today) return 'Today'
  if (day === shiftDay(today, 1)) return 'Tomorrow'
  if (day <= shiftDay(today, 7)) return 'Next 7 days'
  return 'Later'
}
export function monthDays(month: string) {
  const first = parseDate(`${month}-01`)
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => shiftDay(dateKey(start), index))
}
