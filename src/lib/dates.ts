import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  subDays,
  isAfter,
} from 'date-fns'

// Local 'YYYY-MM-DD' for "today" — avoids UTC off-by-one on date inputs.
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  return parseISO(key)
}

export function prettyDate(key: string): string {
  try {
    return format(fromKey(key), 'd MMM yyyy')
  } catch {
    return key
  }
}

export function prettyShort(key: string): string {
  try {
    return format(fromKey(key), 'd MMM')
  } catch {
    return key
  }
}

export function relativeDay(key: string): string {
  const diff = differenceInCalendarDays(new Date(), fromKey(key))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return `${diff} days ago`
  return prettyShort(key)
}

// Days until a future date (negative if past).
export function daysUntil(key: string): number {
  return differenceInCalendarDays(fromKey(key), new Date())
}

export function weekRange(d: Date = new Date()) {
  return {
    start: startOfWeek(d, { weekStartsOn: 1 }),
    end: endOfWeek(d, { weekStartsOn: 1 }),
  }
}

export function inThisWeek(key: string): boolean {
  const { start, end } = weekRange()
  const d = fromKey(key)
  return !isAfter(start, d) && !isAfter(d, end)
}

export function lastNDays(n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(todayKey(subDays(new Date(), i)))
  return out
}

export function monthsAgoKey(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return todayKey(d)
}

export { differenceInCalendarDays }
