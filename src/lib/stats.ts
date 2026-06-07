import { todayKey, fromKey, lastNDays } from './dates'
import { subDays } from 'date-fns'

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0)
export const round = (n: number, d = 0) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}

// Distinct day-keys that have at least one entry.
export function activeDays<T>(items: T[], getDay: (t: T) => string): Set<string> {
  const s = new Set<string>()
  for (const it of items) s.add(getDay(it))
  return s
}

// Current consecutive-day streak ending today (or yesterday — so an
// unlogged "today" doesn't immediately break a streak).
export function currentStreak(days: Set<string>): number {
  let streak = 0
  let cursor = new Date()
  if (!days.has(todayKey(cursor))) {
    cursor = subDays(cursor, 1)
    if (!days.has(todayKey(cursor))) return 0
  }
  while (days.has(todayKey(cursor))) {
    streak++
    cursor = subDays(cursor, 1)
  }
  return streak
}

export function longestStreak(days: Set<string>): number {
  if (days.size === 0) return 0
  const sorted = [...days].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = fromKey(sorted[i - 1])
    const cur = fromKey(sorted[i])
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000)
    if (diff === 1) run++
    else run = 1
    if (run > best) best = run
  }
  return best
}

// Group numeric values by day-key, summing collisions.
export function dailySeries<T>(
  items: T[],
  getDay: (t: T) => string,
  getVal: (t: T) => number,
  days: number,
): { date: string; value: number }[] {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = getDay(it)
    map.set(k, (map.get(k) ?? 0) + getVal(it))
  }
  return lastNDays(days).map((date) => ({ date, value: round(map.get(date) ?? 0, 2) }))
}

// 7-day rolling totals over the last `weeks` weeks (for consistency charts).
export function weeklyCounts<T>(
  items: T[],
  getDay: (t: T) => string,
  weeks: number,
): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = []
  const today = new Date()
  for (let w = weeks - 1; w >= 0; w--) {
    const end = subDays(today, w * 7)
    const start = subDays(end, 6)
    const count = items.filter((it) => {
      const d = fromKey(getDay(it))
      return d >= start && d <= end
    }).length
    out.push({ date: todayKey(end), value: count })
  }
  return out
}

export function within<T>(items: T[], getDay: (t: T) => string, days: number): T[] {
  const cutoff = subDays(new Date(), days)
  return items.filter((it) => fromKey(getDay(it)) >= cutoff)
}

export function latestByDay<T extends { date: string }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
}

export function fmtEUR(n: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n)
}

export function fmtNum(n: number, d = 1): string {
  return new Intl.NumberFormat('en-IE', { maximumFractionDigits: d }).format(n)
}
