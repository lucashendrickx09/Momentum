import { useEffect, useMemo, useRef, useState } from 'react'
import { Reveal, useCountUp } from '../../lib/animations'
import { useStore } from '../../store/store'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, SectionHeader, Segmented, Empty, Pill } from '../../components/ui/primitives'
import { TrendArea, AllocationDonut, CompareLines } from '../../components/charts/Charts'
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

// Distinct palette for the allocation donut (cycles if > 8 positions).
const ALLOC_COLORS = ['#18b97a', '#4f8cff', '#a07bff', '#ff8a3d', '#19c3c3', '#ffb224', '#ff5d64', '#8c95a8']

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

  // Count-up on the headline figure only — one number animating reads
  // as intentional; several at once reads as noise.
  const displayValue = useCountUp(totalValue, 700)

  const quoteCcys = new Set(valued.map((p) => p.currency || currency))
  const ccy = quoteCcys.size === 1 ? [...quoteCcys][0]! : currency

  // ---- Portfolio value over time (history.json closes × quantities) ----
  const fullSeries = useMemo(() => {
    if (!history) return [] as { date: string; value: number }[]
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
      if (have) out.push({ date: d, value: total })
    }
    return out
  }, [history, holdings])

  const series = useMemo(
    () => fullSeries.slice(-Number(range)).map((p) => ({ date: p.date, value: round(p.value, 0) })),
    [fullSeries, range],
  )

  // ---- Benchmark (SPY): both indexed to 100 at the start of the range ----
  const [showBench, setShowBench] = useState(false)
  const benchData = useMemo(() => {
    const spy = history?.series['SPY']
    if (!spy || fullSeries.length < 2) return []
    const spyMap = new Map(spy.map((p) => [p.date, p.close]))
    const win = fullSeries.slice(-Number(range))
    const firstPort = win[0]?.value
    const firstSpy = win.map((p) => spyMap.get(p.date)).find((v) => v != null)
    if (!firstPort || !firstSpy) return []
    return win.map((p) => {
      const sc = spyMap.get(p.date)
      return {
        date: p.date,
        a: round((p.value / firstPort) * 100, 1),
        b: sc != null ? round((sc / firstSpy) * 100, 1) : null,
      }
    })
  }, [history, fullSeries, range])

  const sortedByValue = [...priced].sort((a, b) => b.value - a.value)

  // ---- Allocation breakdown (donut data) ----
  const allocation = useMemo(() => {
    const top = [...valued].sort((a, b) => b.value - a.value)
    return top.map((p, i) => ({
      name: p.h.ticker,
      value: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
      amount: p.value,
      color: ALLOC_COLORS[i % ALLOC_COLORS.length],
    }))
  }, [valued, totalValue])

  // ---- Risk & return statistics from the 3-month daily series ----
  const stats = useMemo(() => {
    const full = fullSeries
    if (full.length < 10) return null
    const rets: number[] = []
    for (let i = 1; i < full.length; i++) {
      const prev = full[i - 1]!.value
      if (prev > 0) rets.push((full[i]!.value - prev) / prev)
    }
    if (rets.length < 5) return null

    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
    const dailyVol = Math.sqrt(variance)
    const annVol = dailyVol * Math.sqrt(252) * 100

    let bestDay = { date: '', ret: -Infinity }
    let worstDay = { date: '', ret: Infinity }
    rets.forEach((r, i) => {
      const date = full[i + 1]!.date
      if (r > bestDay.ret) bestDay = { date, ret: r }
      if (r < worstDay.ret) worstDay = { date, ret: r }
    })

    // Max drawdown over the window.
    let peak = full[0]!.value
    let maxDD = 0
    for (const p of full) {
      if (p.value > peak) peak = p.value
      const dd = peak > 0 ? (peak - p.value) / peak : 0
      if (dd > maxDD) maxDD = dd
    }

    const upDays = rets.filter((r) => r > 0).length
    const first = full[0]!.value
    const last = full[full.length - 1]!.value
    const periodRet = first > 0 ? ((last - first) / first) * 100 : 0

    // Sharpe ratio: annualised excess return over ~4% risk-free, per unit of vol.
    const annRet = mean * 252
    const sharpe = dailyVol > 0 ? (annRet - 0.04) / (dailyVol * Math.sqrt(252)) : null

    // Beta vs SPY: covariance of aligned daily returns / SPY variance.
    let beta: number | null = null
    const spy = history?.series['SPY']
    if (spy && spy.length > 10) {
      const spyMap = new Map(spy.map((p) => [p.date, p.close]))
      const pairs: [number, number][] = []
      for (let i = 1; i < full.length; i++) {
        const s0 = spyMap.get(full[i - 1]!.date)
        const s1 = spyMap.get(full[i]!.date)
        const p0 = full[i - 1]!.value
        if (s0 != null && s1 != null && s0 > 0 && p0 > 0) {
          pairs.push([(full[i]!.value - p0) / p0, (s1 - s0) / s0])
        }
      }
      if (pairs.length >= 10) {
        const mp = pairs.reduce((a, [p]) => a + p, 0) / pairs.length
        const ms = pairs.reduce((a, [, sp]) => a + sp, 0) / pairs.length
        let cov = 0
        let varS = 0
        for (const [p, sp] of pairs) {
          cov += (p - mp) * (sp - ms)
          varS += (sp - ms) ** 2
        }
        if (varS > 0) beta = cov / varS
      }
    }

    return {
      annVol,
      bestDay,
      worstDay,
      maxDD: maxDD * 100,
      winRate: (upDays / rets.length) * 100,
      periodRet,
      days: rets.length,
      sharpe,
      beta,
    }
  }, [fullSeries, history])

  // Concentration: weight of the single largest position.
  const topWeight = allocation.length > 0 ? allocation[0]!.value : 0

  // Diversification: HHI → effective number of holdings.
  // 16 equally weighted positions → 16; one dominant position → close to 1.
  const effectiveN = useMemo(() => {
    if (allocation.length < 2) return null
    const hhi = allocation.reduce((a, p) => a + (p.value / 100) ** 2, 0)
    return hhi > 0 ? 1 / hhi : null
  }, [allocation])

  // Per-position contribution to today's portfolio move (in % of yesterday's value).
  const contributions = useMemo(() => {
    const yesterday = totalValue - dayChange
    if (yesterday <= 0) return []
    return [...valued]
      .filter((p) => p.dayDelta !== 0)
      .map((p) => ({ ticker: p.h.ticker, delta: p.dayDelta, pct: (p.dayDelta / yesterday) * 100 }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6)
  }, [valued, totalValue, dayChange])

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

      <div className="fin-stack">

      {/* ---- Hero: portfolio value ---- */}
      <Reveal>
      <Card className="hero glow" accent={C}>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
            Portfolio value
          </span>
          <span className="spacer" />
          {anyLive ? (
            <span className="live-badge"><Pill tone="good">● LIVE</Pill></span>
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
          {valued.length > 0 ? fmtEUR(Math.round(displayValue), ccy) : '—'}
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
      </Reveal>

      {/* ---- Value chart ---- */}
      {series.length >= 2 && (
        <Reveal delay={60}>
        <Card accent={C}>
          <SectionHeader
            title="Performance"
            sub={showBench ? 'Indexed to 100 · dashed = S&P 500' : `Portfolio value · ${ccy}`}
            right={
              benchData.length >= 2 ? (
                <button className={`chip ${showBench ? 'on' : ''}`} onClick={() => setShowBench(!showBench)}>
                  vs S&P 500
                </button>
              ) : undefined
            }
          />
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
          {showBench && benchData.length >= 2 ? (
            <CompareLines
              data={benchData}
              colorA={C}
              colorB="var(--text-3)"
              labelA="Portfolio"
              labelB="S&P 500"
              height={190}
            />
          ) : (
            <TrendArea data={series} color={up ? '#2fd699' : '#ff6369'} unit="" height={190} />
          )}
        </Card>
        </Reveal>
      )}

      {/* ---- Allocation donut ---- */}
      {allocation.length >= 2 && (
        <Reveal delay={60}>
        <Card accent={C}>
          <SectionHeader title="Allocation" sub="Share of portfolio by position" />
          <div className="alloc-wrap">
            <div style={{ position: 'relative' }}>
              <AllocationDonut data={allocation} height={190} />
              <div className="alloc-center">
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>TOP</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{allocation[0]!.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{topWeight.toFixed(0)}%</div>
              </div>
            </div>
            <div className="alloc-legend">
              {allocation.map((a) => (
                <div key={a.name} className="alloc-row">
                  <span className="swatch" style={{ background: a.color }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</span>
                  <span className="spacer" />
                  <span className="mono dim" style={{ fontSize: 12 }}>{fmtEUR(a.amount, ccy)}</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: 'right' }}>
                    {a.value.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          {effectiveN != null && (
            <div className="dim" style={{ fontSize: 12, marginTop: 12 }}>
              Diversification: {allocation.length} positions behave like <b style={{ color: 'var(--text)' }}>{effectiveN.toFixed(1)}</b> equally
              weighted holdings{effectiveN < allocation.length / 2 ? ' — heavily concentrated.' : '.'}
            </div>
          )}
          {topWeight > 40 && (
            <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>
              ⚠ {allocation[0]!.name} is {topWeight.toFixed(0)}% of your portfolio — concentrated positions amplify both gains and losses.
            </div>
          )}
        </Card>
        </Reveal>
      )}

      {/* ---- Risk & return stats (3-month window) ---- */}
      {stats && (
        <Reveal delay={60}>
        <Card>
          <SectionHeader title="Risk & return" sub={`Computed from the last ${stats.days} trading days`} />
          <div className="grid3" style={{ gap: 12 }}>
            <div className="stat">
              <div className="label">3M return</div>
              <div className="value" style={{ fontSize: 18, color: stats.periodRet >= 0 ? 'var(--good)' : 'var(--danger)' }}>
                {stats.periodRet >= 0 ? '+' : ''}{stats.periodRet.toFixed(1)}%
              </div>
            </div>
            <div className="stat">
              <div className="label">Volatility</div>
              <div className="value" style={{ fontSize: 18 }}>{stats.annVol.toFixed(0)}%</div>
              <div className="foot">annualised</div>
            </div>
            <div className="stat">
              <div className="label">Max drawdown</div>
              <div className="value" style={{ fontSize: 18, color: 'var(--danger)' }}>−{stats.maxDD.toFixed(1)}%</div>
            </div>
            <div className="stat">
              <div className="label">Win rate</div>
              <div className="value" style={{ fontSize: 18 }}>{stats.winRate.toFixed(0)}%</div>
              <div className="foot">up days</div>
            </div>
            <div className="stat">
              <div className="label">Best day</div>
              <div className="value" style={{ fontSize: 18, color: 'var(--good)' }}>+{(stats.bestDay.ret * 100).toFixed(1)}%</div>
              <div className="foot">{stats.bestDay.date.slice(5)}</div>
            </div>
            <div className="stat">
              <div className="label">Worst day</div>
              <div className="value" style={{ fontSize: 18, color: 'var(--danger)' }}>{(stats.worstDay.ret * 100).toFixed(1)}%</div>
              <div className="foot">{stats.worstDay.date.slice(5)}</div>
            </div>
            {stats.beta != null && (
              <div className="stat">
                <div className="label">Beta</div>
                <div className="value" style={{ fontSize: 18 }}>{stats.beta.toFixed(2)}</div>
                <div className="foot">vs S&P 500</div>
              </div>
            )}
            {stats.sharpe != null && (
              <div className="stat">
                <div className="label">Sharpe</div>
                <div className="value" style={{ fontSize: 18, color: stats.sharpe >= 1 ? 'var(--good)' : 'var(--text)' }}>
                  {stats.sharpe.toFixed(2)}
                </div>
                <div className="foot">risk-adj. return</div>
              </div>
            )}
          </div>
          {stats.beta != null && (
            <div className="dim" style={{ fontSize: 12, marginTop: 12 }}>
              {stats.beta > 1.2
                ? `Beta ${stats.beta.toFixed(2)}: your portfolio swings ~${Math.round((stats.beta - 1) * 100)}% harder than the market.`
                : stats.beta < 0.8
                  ? `Beta ${stats.beta.toFixed(2)}: your portfolio moves less than the market — defensive tilt.`
                  : `Beta ${stats.beta.toFixed(2)}: your portfolio roughly tracks the market's moves.`}
            </div>
          )}
        </Card>
        </Reveal>
      )}

      {/* ---- Position returns comparison ---- */}
      {valued.filter((p) => p.gainPct != null).length >= 2 && (
        <Reveal delay={60}>
        <Card>
          <SectionHeader title="Position returns" sub="All-time return per holding vs cost basis" />
          <div className="stack" style={{ gap: 12 }}>
            {[...valued]
              .filter((p) => p.gainPct != null)
              .sort((a, b) => b.gainPct! - a.gainPct!)
              .map((p) => {
                const pct = p.gainPct!
                const maxAbs = Math.max(...valued.filter((v) => v.gainPct != null).map((v) => Math.abs(v.gainPct!)), 1)
                const width = (Math.abs(pct) / maxAbs) * 100
                return (
                  <div key={p.h.id} className="retbar-row">
                    <span style={{ fontWeight: 700, fontSize: 13, width: 56, flexShrink: 0 }}>{p.h.ticker}</span>
                    <div className="retbar-track">
                      <span
                        className={pct >= 0 ? 'pos' : 'neg'}
                        style={{ width: `${Math.max(2, width)}%` }}
                      />
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        minWidth: 58,
                        textAlign: 'right',
                        color: pct >= 0 ? 'var(--good)' : 'var(--danger)',
                      }}
                    >
                      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
          </div>
        </Card>
        </Reveal>
      )}

      {/* ---- What moved the portfolio today ---- */}
      {contributions.length >= 2 && (
        <Reveal delay={60}>
        <Card>
          <SectionHeader
            title="What moved your portfolio"
            sub="Each position's contribution to today's change"
          />
          <div className="stack" style={{ gap: 10 }}>
            {contributions.map((c) => {
              const maxAbs = Math.max(...contributions.map((x) => Math.abs(x.delta)), 0.01)
              const width = (Math.abs(c.delta) / maxAbs) * 100
              return (
                <div key={c.ticker} className="retbar-row">
                  <span style={{ fontWeight: 700, fontSize: 13, width: 56, flexShrink: 0 }}>{c.ticker}</span>
                  <div className="retbar-track">
                    <span className={c.delta >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.max(2, width)}%` }} />
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      minWidth: 86,
                      textAlign: 'right',
                      color: c.delta >= 0 ? 'var(--good)' : 'var(--danger)',
                    }}
                  >
                    {c.delta >= 0 ? '+' : '−'}{fmtEUR(Math.abs(c.delta), ccy)}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
        </Reveal>
      )}

      {/* ---- Holdings ---- */}
      <Reveal delay={60}>
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
            {sortedByValue.map((p, i) => {
              const weight = totalValue > 0 ? (p.value / totalValue) * 100 : 0
              const isOpen = expanded === p.h.id
              return (
                <div key={p.h.id} className="holding-animate" style={{ animationDelay: `${i * 45}ms` }}>
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
                      {p.h.costBasis != null && p.h.quantity > 0 && p.price != null && (
                        <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>
                          Break-even: <b className="mono" style={{ color: 'var(--text)' }}>{fmtEUR(p.h.costBasis / p.h.quantity, p.currency || ccy)}</b>
                          {' '}per share — currently{' '}
                          <b className="mono" style={{ color: p.price >= p.h.costBasis / p.h.quantity ? 'var(--good)' : 'var(--danger)' }}>
                            {((p.price / (p.h.costBasis / p.h.quantity) - 1) * 100).toFixed(1)}%
                          </b>{' '}
                          {p.price >= p.h.costBasis / p.h.quantity ? 'above' : 'below'} it.
                        </div>
                      )}
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
      </Reveal>

      {/* ---- News for your holdings ---- */}
      {news.length > 0 && (
        <Reveal delay={60}>
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
        </Reveal>
      )}

      </div>{/* end fin-stack */}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <HoldingForm holding={editing} onClose={() => setEditing(null)} />
      <CashModal open={cashOpen} onClose={() => setCashOpen(false)} />
    </>
  )
}
