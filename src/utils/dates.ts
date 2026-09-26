export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return dateKey(date)
}

export function parseDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T12:00:00` : value)
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'Not scheduled'
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return date.toLocaleDateString('en-US', options ?? { month: 'short', day: 'numeric' })
}

export function formatDateTime(value: string): string {
  if (!value) return 'Not scheduled'
  return parseDate(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function startOfWeek(): string {
  const date = new Date()
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return dateKey(date)
}

export function localDateTime(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
