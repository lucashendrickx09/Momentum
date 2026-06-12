// Detect overnight sleep gaps via the Page Visibility API.
// When the app hides (user locks phone / switches app) we stamp the time.
// When it becomes visible again we check whether the gap looks like sleep:
//   - between 3 and 13 hours
//   - hidden time between 7pm–3am, OR wakeup time between 4am–noon

const HIDDEN_KEY = 'momentum-sleep-hidden-at'
const LOGGED_KEY = 'momentum-sleep-auto-logged-date'

export function recordHidden() {
  try {
    localStorage.setItem(HIDDEN_KEY, Date.now().toString())
  } catch { /* ignore */ }
}

export interface SleepGap {
  hours: number     // rounded to nearest 0.25
  sleepDate: string // YYYY-MM-DD of the night (the date when they fell asleep)
  hiddenAt: Date
  wokeAt: Date
}

export function detectSleepGap(): SleepGap | null {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    if (!raw) return null
    const hiddenMs = Number(raw)
    if (!Number.isFinite(hiddenMs) || hiddenMs <= 0) return null

    const hiddenAt = new Date(hiddenMs)
    const wokeAt   = new Date()
    const gapMs    = wokeAt.getTime() - hiddenMs
    const gapH     = gapMs / 3600000

    if (gapH < 3 || gapH > 13) return null

    const hiddenHour  = hiddenAt.getHours()
    const wakeHour    = wokeAt.getHours()

    // "Fell asleep" window: 7pm–3am; "woke up" window: 4am–noon.
    const plausibleBedtime = hiddenHour >= 19 || hiddenHour <= 3
    const plausibleWakeup  = wakeHour >= 4 && wakeHour <= 12

    if (!plausibleBedtime && !plausibleWakeup) return null

    // Don't prompt if we already auto-logged today.
    const today = wokeAt.toISOString().slice(0, 10)
    if (localStorage.getItem(LOGGED_KEY) === today) return null

    const hours     = Math.round(gapH * 4) / 4  // nearest 15 min
    // Sleep date = the calendar day when the person fell asleep.
    const sleepDate = hiddenAt.toISOString().slice(0, 10)

    return { hours, sleepDate, hiddenAt, wokeAt }
  } catch {
    return null
  }
}

export function markAutoLogged() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(LOGGED_KEY, today)
    localStorage.removeItem(HIDDEN_KEY)
  } catch { /* ignore */ }
}

export function dismissSleepGap() {
  try {
    localStorage.removeItem(HIDDEN_KEY)
  } catch { /* ignore */ }
}
