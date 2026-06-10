// Notification automation: daily check-in reminders + deadline alerts.
// Schedules using the Notification Triggers API (Chrome Android) when
// available, otherwise fires on app open if the reminder time has passed.

const SHOWN_KEY = 'momentum-notif-shown-date'

export function notifSupported(): boolean {
  return 'Notification' in window
}

export async function requestPermission(): Promise<boolean> {
  if (!notifSupported()) return false
  const p = await Notification.requestPermission()
  return p === 'granted'
}

export function hasPermission(): boolean {
  return notifSupported() && Notification.permission === 'granted'
}

// Called once on app open. Shows a reminder notification if:
//   - permission is granted
//   - notifications are enabled in user prefs
//   - reminderTime has passed today and not already shown today
export function checkReminderOnOpen(reminderTime: string) {
  if (!hasPermission()) return
  const now = new Date()
  const [hh, mm] = reminderTime.split(':').map(Number)
  const today = now.toISOString().slice(0, 10)
  const alreadyShown = localStorage.getItem(SHOWN_KEY)
  if (alreadyShown === today) return
  const reminderToday = new Date(now)
  reminderToday.setHours(hh ?? 21, mm ?? 0, 0, 0)
  if (now >= reminderToday) {
    showNotification('Daily check-in', "Don't forget to log today's sleep, mood and workout.")
    localStorage.setItem(SHOWN_KEY, today)
  }
}

// Show deadline alerts for items due within `withinDays`.
export function checkDeadlineAlerts(
  deadlines: { id: string; title: string; kind: string; date: string; done?: boolean }[],
  withinDays = 3,
) {
  if (!hasPermission()) return
  const today = new Date()
  const alertKey = 'momentum-deadline-alerted'
  let alerted: string[] = []
  try {
    alerted = JSON.parse(localStorage.getItem(alertKey) ?? '[]') as string[]
  } catch { /* ignore */ }

  const toAlert = deadlines.filter((d) => {
    if (d.done) return false
    if (alerted.includes(d.id)) return false
    const due = new Date(d.date)
    const days = Math.round((due.getTime() - today.getTime()) / 86400000)
    return days >= 0 && days <= withinDays
  })

  for (const d of toAlert) {
    const due = new Date(d.date)
    const days = Math.round((due.getTime() - today.getTime()) / 86400000)
    const body = days === 0 ? `${d.kind}: due TODAY` : `${d.kind}: due in ${days} day${days === 1 ? '' : 's'}`
    showNotification(d.title, body)
    alerted.push(d.id)
  }

  if (toAlert.length > 0) {
    try { localStorage.setItem(alertKey, JSON.stringify(alerted)) } catch { /* ignore */ }
  }
}

// Schedule the next daily reminder using Notification Triggers (Chrome).
// Falls back gracefully if the API isn't available.
export async function scheduleNextReminder(reminderTime: string) {
  if (!hasPermission()) return
  const sw = navigator.serviceWorker?.controller
  if (!sw) return

  // Notification Triggers API (Chrome Android only).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = await navigator.serviceWorker.ready as any
  if (typeof reg.showNotification !== 'function') return
  if (typeof (window as unknown as Record<string, unknown>)['TimestampTrigger'] === 'undefined') return

  const [hh, mm] = reminderTime.split(':').map(Number)
  const next = new Date()
  next.setHours(hh ?? 21, mm ?? 0, 0, 0)
  if (next <= new Date()) next.setDate(next.getDate() + 1)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const TT = (window as any).TimestampTrigger
    await reg.showNotification('Daily check-in', {
      body: "Don't forget to log today's sleep, mood and workout.",
      tag: 'momentum-daily',
      showTrigger: new TT(next.getTime()),
    })
  } catch { /* ignore */ }
}

function showNotification(title: string, body: string) {
  try {
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      icon: '/icons/apple-touch-icon.png',
      badge: '/icons/apple-touch-icon.png',
      tag: `momentum-${title.slice(0, 10)}`,
    })
  } catch { /* ignore */ }
}
