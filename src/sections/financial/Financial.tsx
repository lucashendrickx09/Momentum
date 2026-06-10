import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/store'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, SectionHeader, Segmented, Empty, Pill } from '../../components/ui/primitives'
import { TrendArea } from '../../components/charts/Charts'
import { fmtEUR, sum, round } from '../../lib/stats'
import { ACCENT } from '../../lib/sections'
import {
  useBriefing,
  usePriceHistory,
  useLiveQuotes,
  timeAgo,
  type Headline,
} from '../../lib/briefing'
import { fetchHoldingsFromUrl } from '../../lib/csv'
import { ImportModal, HoldingForm, CashModal } from './modals'
import type { Holding } from '../../store/types'

const C = ACCENT.financial
type Range = '7' | '30' | '90'

interface PricedHolding {
  h: Holding
  price?: number
  prevClose?: number
  changePct?: number
  currency?: string
  value: number
  dayDelta: number
  gain?: number
  gainPct?: number
  live: boolean
}

export function Financial() {
  const holdings = useStore((s) => s.financial.holdings)
  const cash = useStore((s) => s.financial.cash)
  const currency = useStore((s) => s.settings.currency)
  const csvUrl = useStore((s) => s.financial.holdingsCsvUrl)
  const replaceHoldings = useStore((s) => s.replaceHoldings)
  const removeHolding = useStore((s) => s.removeHolding)

  const { briefing, refresh } = useBriefing()
  const history = usePriceHistory()
  const tickers = useMemo(() => holdings.map((h) => h.ticker), [holdings])
  const live = useLiveQuotes(tickers)

  const [range, setRange] = useState<Range>('30')
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [cashOpen, setCashOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Auto-sync holdings from the saved Google Sheet once per app open.
  const synced = useRef(false)
  useEffect(() => {
    if (synced.current || !csvUrl) return
    synced.current = true
    fetchHoldingsFromUrl(csvUrl)
      .then((list) => {
        if (list.length > 0) replaceHoldings(list)
      })
      .catch(() => {
        /* keep current holdings if the sheet is unreachable */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvUrl])

  // ---- Merge prices: briefing as base, live quotes override ----
  const priced: PricedHolding[] = useMemo(() => {
    const base = new Map(briefing?.items.map((it) => [it.ticker.toUpperCase(), it]) ?? [])
    return holdings.map((h) => {
      const key = h.ticker.toUpperCase()
      const b = base.get(key)
      const l = live.get(key)
      const price = l?.price ?? b?.price
      const prevClose = l?.prevClose ?? b?.previousClose
      const changePct = l?.changePct ?? b?.changePct
      const value = price != null ? price * h.quantity : 0
      const dayDelta = price != null && prevClose != null ? (price - prevClose) * h.quantity : 0
      const gain = price != null && h.costBasis ? value - h.costBasis : undefined
      const gainPct = gain != null && h.costBasis ? (gain / h.costBasis) * 100 : undefined
      return { h, price, prevClose, changePct, currency: b?.currency, value, dayDelta, gain, gainPct, live: !!l }
    })
  }, [holdings, briefing, live])

  const valued = priced.filter((p) => p.price != null && p.h.quantity > 0)
  const totalValue = sum(valued.map((p) => p.value))
  const dayChange = sum(valued.map((p) => p.dayDelta))
  const dayPct = totalValue - dayChange !== 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0
  const totalCost = sum(valued.filter((p) => p.h.costBasis).map((p) => p.h.costBasis!))
  const totalGain = sum(valued.filter((p) => p.gain != null).map((p) => p.gain!))
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
  const netWorth = totalValue + (cash ?? 0)
  const anyLive = valued.some((p) => p.live)

  const quoteCcys = new Set(valued.map((p) => p.currency || currency))
  const ccy = quoteCcys.size === 1 ? [...quoteCcys][0]! : currency

  // ---- Portfolio value over time (history.json closes × quantities) ----
  const series = useMemo(() => {
    if (!history || valued.length === 0) return []
    const held = holdings.filter((h) => h.quantity > 0)
    const dateSet = new Set<string>()
    const maps = held.map((h) => {
      const pts = history.series[h.ticker.toUpperCase()] ?? []
      pts.forEach((p) => dateSet.add(p.date))
      return { qty: h.quantity, map: new Map(pts.map((p) => [p.date, p.close])) }
    })
    const dates = [...dateSet].sort()
    const lastClose = new Map<number, number>()
    const out: { date: string; value: number }[] = []
    for (const d of dates) {
      let total = 0
      let have = false
      maps.forEach((m, i) => {
        const c = m.map.get(d) ?? lastClose.get(i)
        if (c != null) {
          lastClose.set(i, c)
          total += c * m.qty
          have = true
        }
      })
      if (have) out.push({ date: d, value: round(total, 0) })
    }
    return out.slice(-Number(range))
  }, [history, holdings, valued.length, range])

  const movers = [...valued].filter((p) => p.changePct != null).sort((a, b) => b.changePct! - a.changePct!)
  const best = movers[0]
  const worst = movers[movers.length - 1]

  const sortedByValue = [...priced].sort((a, b) => b.value - a.value)

  // News for held tickers, newest first.
  const news = useMemo(() => {
    const held = new Set(holdings.map((h) => h.ticker.toUpperCase()))
    const all: (Headline & { ticker: string })[] = []
    briefing?.items
      .filter((it) => held.has(it.ticker.toUpperCase()))
      .forEach((it) => it.headlines.forEach((h) => all.push({ ...h, ticker: it.ticker })))
    return all
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .slice(0, 6)
  }, [briefing, holdings])

  const up = dayChange >= 0

  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Invest" accent={C} />

      {/* ---- Hero: portfolio value ---- */}
      <Card className="hero glow" accent={C}>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
            Portfolio value
          </span>
          <span className="spacer" />
          {anyLive ? (
            <Pill tone="good">● LIVE</Pill>
          ) : briefing ? (
            <span className="dim" style={{ fontSize: 11 }}>
              {timeAgo(briefing.generatedAt)}
            </span>
          ) : null}
          <button className="iconbtn" onClick={refresh} aria-label="Refresh prices" style={{ width: 30, height: 30, fontSize: 14 }}>
            ↻
          </button>
        </div>

        <div className="big-number" style={{ marginTop: 6 }}>
          {valued.length > 0 ? fmtEUR(totalValue, ccy) : '—'}
        </div>

        {valued.length > 0 && (
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span className="delta" style={{ color: up ? 'var(--good)' : 'var(--danger)' }}>
              {up ? '▲' : '▼'} {fmtEUR(Math.abs(dayChange), ccy)} ({up ? '+' : ''}
              {dayPct.toFixed(2)}%) today
            </span>
            {totalCost > 0 && (
              <span className="delta dim">
                · all-time {totalGain >= 0 ? '+' : '−'}
                {fmtEUR(Math.abs(totalGain), ccy)} ({totalGain >= 0 ? '+' : ''}
                {totalGainPct.toFixed(1)}%)
              </span>
            )}
          </div>
        )}

        <div className="row" style={{ marginTop: 14, gap: 10 }}>
          <div className="stat grow" style={{ background: 'transparent' }}>
            <div className="label">Cash</div>
            <div className="value" style={{ fontSize: 17 }}>
              {cash != null ? fmtEUR(cash, currency) : '—'}
              <button className="linkbtn" style={{ fontSize: 12, marginLeft: 6 }} onClick={() => setCashOpen(true)}>
                ✎
              </button>
            </div>
          </div>
          <div className="stat grow" style={{ background: 'transparent' }}>
            <div className="label">Net worth</div>
            <div className="value" style={{ fontSize: 17, color: C }}>
              {valued.length > 0 || cash != null ? fmtEUR(netWorth, ccy) : '—'}
            </div>
          </div>
          <div className="stat grow" style={{ background: 'transparent' }}>
            <div className="label">Positions</div>
            <div className="value" style={{ fontSize: 17 }}>{holdings.length}</div>
          </div>
        </div>
      </Card>

      {/* ---- Value chart ---- */}
      {series.length >= 2 && (
        <Card accent={C}>
          <SectionHeader title="Performance" sub={`Portfolio value · ${ccy}`} />
          <div style={{ maxWidth: 220, marginBottom: 6 }}>
            <Segmented<Range>
              value={range}
              onChange={setRange}
              options={[
                { value: '7', label: '1W' },
                { value: '30', label: '1M' },
                { value: '90', label: '3M' },
              ]}
            />
          </div>
          <TrendArea data={series} color={up ? '#2fd699' : '#ff6369'} unit="" height={190} />
        </Card>
      )}

      {/* ---- Today's movers ---- */}
      {movers.length >= 2 && best && worst && best !== worst && (
        <div className="grid2">
          <Card>
            <div className="dim" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Top mover
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{best.h.ticker}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--good)' }}>
              ▲ +{best.changePct!.toFixed(2)}%
            </div>
          </Card>
          <Card>
            <div className="dim" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Biggest drag
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{worst.h.ticker}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: worst.changePct! >= 0 ? 'var(--good)' : 'var(--danger)' }}>
              {worst.changePct! >= 0 ? '▲ +' : '▼ '}
              {worst.changePct!.toFixed(2)}%
            </div>
          </Card>
        </div>
      )}

      {/* ---- Holdings ---- */}
      <Card>
        <SectionHeader
          title="Holdings"
          sub={valued.length > 0 ? `${holdings.length} positions · live for ${valued.length}` : `${holdings.length} positions`}
          right={
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm ghost" onClick={() => setImportOpen(true)}>
                Import
              </button>
              <button
                className="btn sm"
                onClick={() => setEditing({ id: '', createdAt: '', ticker: '', quantity: 0 } as Holding)}
              >
                + Add
              </button>
            </div>
          }
        />
        {holdings.length === 0 ? (
          <Empty icon="📈" title="No holdings yet" sub="Import from a Google Sheet / CSV, or add positions manually." />
        ) : (
          <div className="list">
            {sortedByValue.map((p) => {
              const weight = totalValue > 0 ? (p.value / totalValue) * 100 : 0
              const isOpen = expanded === p.h.id
              return (
                <div key={p.h.id}>
                  <button
                    className="holding-row"
                    onClick={() => setExpanded(isOpen ? null : p.h.id)}
                  >
                    <div className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{p.h.ticker}</span>
                        {p.h.name && (
                          <span className="dim" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.h.name}
                          </span>
                        )}
                      </div>
                      <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {p.h.quantity} × {p.price != null ? fmtEUR(p.price, p.currency || ccy) : '—'}
                        {weight > 0 && ` · ${weight.toFixed(1)}%`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5 }} className="mono">
                        {p.price != null ? fmtEUR(p.value, p.currency || ccy) : '—'}
                      </div>
                      {p.changePct != null && (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: p.changePct >= 0 ? 'var(--good)' : 'var(--danger)',
                          }}
                        >
                          {p.changePct >= 0 ? '▲' : '▼'} {Math.abs(p.changePct).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </button>
                  {weight > 0 && (
                    <div className="weight-track">
                      <span style={{ width: `${Math.min(100, weight)}%` }} />
                    </div>
                  )}
                  {isOpen && (
                    <div className="holding-detail fadein">
                      <div className="grid3" style={{ marginBottom: 8 }}>
                        <div>
                          <div className="dim" style={{ fontSize: 10.5, fontWeight: 700 }}>COST</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }} className="mono">
                            {p.h.costBasis ? fmtEUR(p.h.costBasis, ccy) : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="dim" style={{ fontSize: 10.5, fontWeight: 700 }}>GAIN</div>
                          <div
                            style={{ fontSize: 13, fontWeight: 700, color: p.gain == null ? 'var(--text)' : p.gain >= 0 ? 'var(--good)' : 'var(--danger)' }}
                            className="mono"
                          >
                            {p.gain != null ? `${p.gain >= 0 ? '+' : '−'}${fmtEUR(Math.abs(p.gain), ccy)}` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="dim" style={{ fontSize: 10.5, fontWeight: 700 }}>RETURN</div>
                          <div
                            style={{ fontSize: 13, fontWeight: 700, color: p.gainPct == null ? 'var(--text)' : p.gainPct >= 0 ? 'var(--good)' : 'var(--danger)' }}
                            className="mono"
                          >
                            {p.gainPct != null ? `${p.gainPct >= 0 ? '+' : ''}${p.gainPct.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                      </div>
                      {p.h.buyReason && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--text-2)',
                            borderLeft: `2px solid ${C}`,
                            paddingLeft: 8,
                            marginBottom: 8,
                          }}
                        >
                          {p.h.buyReason}
                        </div>
                      )}
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn sm ghost" onClick={() => setEditing(p.h)}>
                          Edit
                        </button>
                        <button
                          className="btn sm ghost danger"
                          onClick={() => confirm(`Remove ${p.h.ticker}?`) && removeHolding(p.h.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ---- News for your holdings ---- */}
      {news.length > 0 && (
        <Card>
          <SectionHeader title="News on your stocks" sub="Reported as published — information only" />
          <div className="stack" style={{ gap: 10 }}>
            {news.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="news-row">
                <span className="tag" style={{ flexShrink: 0 }}>{n.ticker}</span>
                <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                  {n.title}
                  <span className="dim" style={{ fontSize: 11 }}> — {n.publisher}</span>
                </span>
              </a>
            ))}
          </div>
        </Card>
      )}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <HoldingForm holding={editing} onClose={() => setEditing(null)} />
      <CashModal open={cashOpen} onClose={() => setCashOpen(false)} />
    </>
  )
}
