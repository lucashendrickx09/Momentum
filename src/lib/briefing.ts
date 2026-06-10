import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store'

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

const REFRESH_MS = 5 * 60 * 1000 // re-fetch briefing every 5 min while open

export function useBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

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
  }, [tick])

  // Re-fetch when the app comes back to the foreground and on a timer,
  // so prices stay as fresh as the published briefing allows.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    const onVis = () => {
      if (document.visibilityState === 'visible') bump()
    }
    document.addEventListener('visibilitychange', onVis)
    const id = window.setInterval(bump, REFRESH_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(id)
    }
  }, [])

  const refresh = () => setTick((t) => t + 1)

  return { briefing, loading, refresh }
}

// ---------- Price history (public/history.json, 3 months of daily closes) ----------

export interface HistoryPoint {
  date: string // YYYY-MM-DD
  close: number
}

export interface PriceHistory {
  generatedAt: string
  source: string
  series: Record<string, HistoryPoint[]>
}

export function usePriceHistory() {
  const [history, setHistory] = useState<PriceHistory | null>(null)

  useEffect(() => {
    let alive = true
    const url = `${import.meta.env.BASE_URL}history.json?_=${Date.now()}`
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PriceHistory | null) => {
        if (alive && data && data.series) setHistory(data)
      })
      .catch(() => {
        /* history is optional */
      })
    return () => {
      alive = false
    }
  }, [])

  return history
}

// ---------- Live quotes (optional Finnhub key, set in Settings) ----------

export interface LiveQuote {
  price: number
  changePct?: number
  prevClose?: number
}

const LIVE_POLL_MS = 60 * 1000

export function useLiveQuotes(tickers: string[]) {
  const key = useStore((s) => s.settings.finnhubKey)
  const [quotes, setQuotes] = useState<Map<string, LiveQuote>>(new Map())
  const list = useMemo(() => [...new Set(tickers.map((t) => t.toUpperCase()))].sort(), [tickers])
  const listKey = list.join(',')

  useEffect(() => {
    if (!key || list.length === 0) {
      setQuotes(new Map())
      return
    }
    let alive = true

    async function poll() {
      const next = new Map<string, LiveQuote>()
      await Promise.all(
        list.map(async (t) => {
          try {
            const r = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(key!)}`,
            )
            if (!r.ok) return
            const q = (await r.json()) as { c?: number; dp?: number; pc?: number }
            if (typeof q.c === 'number' && q.c > 0) {
              next.set(t, { price: q.c, changePct: q.dp ?? undefined, prevClose: q.pc ?? undefined })
            }
          } catch {
            /* skip ticker */
          }
        }),
      )
      if (alive && next.size > 0) setQuotes(next)
    }

    poll()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') poll()
    }, LIVE_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, listKey])

  return quotes
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

  function undismiss() {
    try {
      localStorage.removeItem(DISMISS_KEY)
    } catch {
      /* ignore */
    }
    setDismissedAt(null)
  }

  return { dismissed, dismiss, undismiss }
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
