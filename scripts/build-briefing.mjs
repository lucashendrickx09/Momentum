// Phase 2 — Market briefing builder.
//
// Runs on a schedule in GitHub Actions (see .github/workflows/briefing.yml),
// NOT in the browser. It reads a watchlist of tickers, looks up each one's
// most recent move and a few real headlines from free, no-key public
// endpoints, and writes public/briefing.json which the app fetches on open.
//
// Information only. Everything is reported as-is ("reported by <publisher>").
// No buy/sell recommendations, no predictions.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Papa from 'papaparse'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const WATCHLIST_FILE = join(ROOT, 'public', 'watchlist.json')
const OUT_FILE = join(ROOT, 'public', 'briefing.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const MAX_TICKERS = 40
const NEWS_PER_TICKER = 4
const FETCH_TIMEOUT_MS = 12000

async function httpGet(url, headers = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...headers } })
  } finally {
    clearTimeout(t)
  }
}

// Yahoo gates some regions behind a consent interstitial and requires a
// per-session crumb. Bootstrap a cookie + crumb once, reuse for every call.
// Best-effort: if it fails we still try unauthenticated (US runners usually
// don't need it).
const yahoo = { cookie: '', crumb: '' }

async function initYahoo() {
  try {
    const r = await httpGet('https://fc.yahoo.com/', { Accept: 'text/html' })
    const setCookie = r.headers.get('set-cookie')
    if (setCookie) yahoo.cookie = setCookie.split(';')[0]
  } catch {
    /* ignore */
  }
  try {
    const r = await httpGet('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      Accept: 'text/plain',
      ...(yahoo.cookie ? { Cookie: yahoo.cookie } : {}),
    })
    const text = (await r.text()).trim()
    if (r.ok && text && !text.startsWith('<')) yahoo.crumb = text
  } catch {
    /* ignore */
  }
  console.log(yahoo.crumb ? 'Yahoo session ready (crumb acquired).' : 'Yahoo session: no crumb (will try unauthenticated).')
}

async function getYahooJSON(url) {
  const withCrumb = yahoo.crumb ? `${url}${url.includes('?') ? '&' : '?'}crumb=${encodeURIComponent(yahoo.crumb)}` : url
  const res = await httpGet(withCrumb, {
    Accept: 'application/json',
    ...(yahoo.cookie ? { Cookie: yahoo.cookie } : {}),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.text()
  if (body.startsWith('<')) throw new Error('blocked (consent/HTML response)')
  return JSON.parse(body)
}

// --- Watchlist resolution: Google Sheet CSV (secret) first, else the file. ---

const TICKER_COLS = ['ticker', 'symbol', 'stock', 'asset', 'code']

function tickersFromCsv(text) {
  const res = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const rows = res.data
  if (!rows.length) return []
  const keys = Object.keys(rows[0])
  let col = keys.find((k) => TICKER_COLS.includes(k.trim().toLowerCase()))
  if (!col) col = keys.find((k) => TICKER_COLS.some((w) => k.trim().toLowerCase().includes(w)))
  if (!col) return []
  return rows.map((r) => String(r[col] ?? '').trim()).filter(Boolean)
}

function normalizeSheetUrl(url) {
  const u = url.trim()
  const m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (m && !u.includes('output=csv') && !u.includes('/pub')) {
    const gid = u.match(/[#&?]gid=([0-9]+)/)?.[1] ?? '0'
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`
  }
  return u
}

async function resolveTickers() {
  const sheetUrl = process.env.SHEET_CSV_URL?.trim()
  if (sheetUrl) {
    try {
      const res = await fetch(normalizeSheetUrl(sheetUrl), { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const tickers = tickersFromCsv(await res.text())
      if (tickers.length) {
        console.log(`Watchlist: ${tickers.length} ticker(s) from SHEET_CSV_URL`)
        return tickers
      }
      console.warn('SHEET_CSV_URL returned no tickers — falling back to watchlist.json')
    } catch (e) {
      console.warn(`SHEET_CSV_URL failed (${e.message}) — falling back to watchlist.json`)
    }
  }
  try {
    const raw = JSON.parse(await readFile(WATCHLIST_FILE, 'utf8'))
    const tickers = Array.isArray(raw) ? raw : raw.tickers
    console.log(`Watchlist: ${tickers?.length ?? 0} ticker(s) from watchlist.json`)
    return Array.isArray(tickers) ? tickers : []
  } catch {
    console.warn('No watchlist.json found.')
    return []
  }
}

function cleanTickers(list) {
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const t = String(raw).trim().toUpperCase()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= MAX_TICKERS) break
  }
  return out
}

// --- Per-ticker data (free Yahoo Finance public endpoints, no key) ---

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=5d&interval=1d`
  const data = await getYahooJSON(url)
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('no chart data')
  const meta = result.meta ?? {}
  const price = meta.regularMarketPrice
  const prevClose = meta.chartPreviousClose ?? meta.previousClose
  if (typeof price !== 'number' || typeof prevClose !== 'number' || !prevClose) {
    throw new Error('incomplete quote')
  }
  const changePct = ((price - prevClose) / prevClose) * 100
  const asOf = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : undefined
  return {
    name: meta.longName || meta.shortName || undefined,
    price: round2(price),
    previousClose: round2(prevClose),
    changePct: round2(changePct),
    currency: meta.currency || undefined,
    exchange: meta.fullExchangeName || meta.exchangeName || undefined,
    asOf,
  }
}

async function fetchNews(ticker) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    ticker,
  )}&newsCount=${NEWS_PER_TICKER}&quotesCount=0&enableFuzzyQuery=false`
  const data = await getYahooJSON(url)
  const news = Array.isArray(data?.news) ? data.news : []
  return news
    .filter((n) => n?.title && n?.link)
    .slice(0, NEWS_PER_TICKER)
    .map((n) => ({
      title: String(n.title).trim(),
      publisher: n.publisher ? String(n.publisher).trim() : 'Unknown',
      url: String(n.link),
      publishedAt: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : undefined,
    }))
}

function round2(n) {
  return Math.round(n * 100) / 100
}

async function buildItem(ticker) {
  const [quoteRes, newsRes] = await Promise.allSettled([fetchQuote(ticker), fetchNews(ticker)])
  if (quoteRes.status !== 'fulfilled') {
    throw new Error(quoteRes.reason?.message || 'quote failed')
  }
  const headlines = newsRes.status === 'fulfilled' ? newsRes.value : []
  return { ticker, ...quoteRes.value, headlines }
}

async function main() {
  const tickers = cleanTickers(await resolveTickers())
  await initYahoo()
  const items = []
  const errors = []

  for (const ticker of tickers) {
    try {
      items.push(await buildItem(ticker))
      console.log(`  ✓ ${ticker}`)
    } catch (e) {
      errors.push(`${ticker}: ${e.message}`)
      console.warn(`  ✗ ${ticker}: ${e.message}`)
    }
  }

  // Most-moved first, by absolute overnight change.
  items.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))

  const briefing = {
    generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance',
    disclaimer:
      'Information only, reported as published. Not financial advice — no buy/sell recommendations or predictions.',
    count: items.length,
    items,
    errors,
  }

  await writeFile(OUT_FILE, JSON.stringify(briefing, null, 2) + '\n', 'utf8')
  console.log(`\nWrote ${OUT_FILE} — ${items.length} item(s), ${errors.length} error(s).`)
}

main().catch((e) => {
  console.error('Briefing build failed:', e)
  process.exit(1)
})
