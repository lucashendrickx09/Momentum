import Papa from 'papaparse'
import type { Holding } from '../store/types'

type NewHolding = Omit<Holding, 'id' | 'createdAt'>

// Accept a variety of column names so a published Google Sheet just works.
const PICK = {
  ticker: ['ticker', 'symbol', 'stock', 'asset', 'code'],
  name: ['name', 'company', 'description', 'title'],
  quantity: ['quantity', 'qty', 'shares', 'units', 'amount', 'holdings'],
  costBasis: ['costbasis', 'cost', 'cost basis', 'invested', 'book value', 'total cost', 'paid'],
  buyReason: ['buyreason', 'reason', 'note', 'notes', 'thesis', 'why', 'comment'],
}

function findKey(row: Record<string, string>, names: string[]): string | undefined {
  const keys = Object.keys(row)
  for (const want of names) {
    const hit = keys.find((k) => k.trim().toLowerCase() === want)
    if (hit) return hit
  }
  // loose contains-match fallback
  for (const want of names) {
    const hit = keys.find((k) => k.trim().toLowerCase().includes(want))
    if (hit) return hit
  }
  return undefined
}

function num(v: string | undefined): number {
  if (!v) return 0
  const cleaned = v.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function rowsToHoldings(rows: Record<string, string>[]): NewHolding[] {
  if (rows.length === 0) return []
  const sample = rows[0]
  const kTicker = findKey(sample, PICK.ticker)
  const kName = findKey(sample, PICK.name)
  const kQty = findKey(sample, PICK.quantity)
  const kCost = findKey(sample, PICK.costBasis)
  const kReason = findKey(sample, PICK.buyReason)

  const out: NewHolding[] = []
  for (const row of rows) {
    const ticker = (kTicker ? row[kTicker] : '')?.trim()
    if (!ticker) continue
    out.push({
      ticker: ticker.toUpperCase(),
      name: kName ? row[kName]?.trim() || undefined : undefined,
      quantity: kQty ? num(row[kQty]) : 0,
      costBasis: kCost ? num(row[kCost]) || undefined : undefined,
      buyReason: kReason ? row[kReason]?.trim() || undefined : undefined,
    })
  }
  return out
}

export function parseHoldingsCSV(text: string): NewHolding[] {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return rowsToHoldings(res.data)
}

// ---- Smart paste --------------------------------------------------------
// Parse a block pasted straight from a spreadsheet or broker export. Tolerates
// no header row, extra columns (sector, market cap, current price…), $ signs
// and thousands separators. Each non-empty line becomes one holding.

function splitCells(line: string): string[] {
  let parts: string[]
  if (line.includes('\t')) parts = line.split('\t')
  else if (line.includes(',')) parts = line.split(',')
  else parts = line.split(/\s+/)
  return parts.map((c) => c.trim())
}

function toNum(s: string | undefined): number | null {
  if (s == null) return null
  const cleaned = s.replace(/[^0-9.\-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function isNumericCell(s: string): boolean {
  return /[0-9]/.test(s) && toNum(s) != null
}

function isTickerCell(s: string): boolean {
  return /^[A-Za-z][A-Za-z.\-]{0,9}$/.test(s)
}

function isCapWord(s: string): boolean {
  return /^(mega|large|mid|small|micro|nano)(\s*cap)?$/i.test(s.trim())
}

const HEADER_FIRST = /^(ticker|symbol|stock|asset|code)$/i

export function parsePastedHoldings(text: string): NewHolding[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const out: NewHolding[] = []
  for (const line of lines) {
    const cells = splitCells(line)
    const first = cells[0]
    if (!first || HEADER_FIRST.test(first) || !isTickerCell(first)) continue

    const ticker = first.toUpperCase()
    const second = cells[1]
    const name = second && !isNumericCell(second) && !isCapWord(second) ? second : undefined

    const nums: number[] = []
    for (const c of cells) {
      const n = toNum(c)
      if (n != null && /[0-9]/.test(c)) nums.push(n)
    }

    // Identify (quantity, pricePerShare, totalCost) as a consecutive triple
    // where quantity * pricePerShare ≈ totalCost — robust to leading noise
    // columns such as market cap.
    let quantity = 0
    let costBasis: number | undefined
    for (let k = 0; k + 2 < nums.length; k++) {
      const [a, b, c] = [nums[k], nums[k + 1], nums[k + 2]]
      if (a > 0 && b > 0 && c > 0 && Math.abs(a * b - c) <= Math.max(0.02 * c, 0.5)) {
        quantity = a
        costBasis = c
        break
      }
    }
    if (!quantity) {
      const q = nums.find((v) => v > 0 && v < 1e6)
      if (q != null) quantity = q
    }

    out.push({ ticker, name, quantity, costBasis })
  }
  return out
}

// Turn an interactive Google Sheets URL into a CSV export URL when possible;
// pass through anything that already looks like a CSV endpoint.
export function normalizeSheetUrl(url: string): string {
  const u = url.trim()
  const m = u.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (m && !u.includes('output=csv') && !u.includes('/pub')) {
    const gid = u.match(/[#&?]gid=([0-9]+)/)?.[1] ?? '0'
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`
  }
  return u
}

export async function fetchHoldingsFromUrl(url: string): Promise<NewHolding[]> {
  const res = await fetch(normalizeSheetUrl(url))
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
  const text = await res.text()
  const holdings = parseHoldingsCSV(text)
  if (holdings.length === 0) throw new Error('No rows with a ticker column were found.')
  return holdings
}
