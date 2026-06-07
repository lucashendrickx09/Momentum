import { useEffect, useState } from 'react'

// Remote market briefing produced by the scheduled GitHub Action
// (scripts/build-briefing.mjs). It is NOT user data — it lives outside the
// persisted store and is fetched fresh from the deployed site on open.

export interface Headline {
  title: string
  publisher: string
  url: string
  publishedAt?: string
}

export interface BriefingItem {
  ticker: string
  name?: string
  price?: number
  previousClose?: number
  changePct?: number
  currency?: string
  exchange?: string
  asOf?: string
  headlines: Headline[]
}

export interface Briefing {
  generatedAt: string
  source: string
  disclaimer?: string
  count: number
  items: BriefingItem[]
  errors?: string[]
}

function hasContent(b: Briefing | null): b is Briefing {
  return !!b && Array.isArray(b.items) && b.items.length > 0
}

export function useBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const url = `${import.meta.env.BASE_URL}briefing.json?_=${Date.now()}`
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Briefing | null) => {
        if (alive) setBriefing(hasContent(data) ? data : null)
      })
      .catch(() => {
        if (alive) setBriefing(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return { briefing, loading }
}

const DISMISS_KEY = 'momentum-briefing-dismissed'

export function useBriefingDismiss(generatedAt: string | undefined) {
  const [dismissedAt, setDismissedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY)
    } catch {
      return null
    }
  })

  const dismissed = !!generatedAt && dismissedAt === generatedAt

  function dismiss() {
    if (!generatedAt) return
    try {
      localStorage.setItem(DISMISS_KEY, generatedAt)
    } catch {
      /* ignore */
    }
    setDismissedAt(generatedAt)
  }

  return { dismissed, dismiss }
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}
