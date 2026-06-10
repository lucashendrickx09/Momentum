import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../store/store'
import { Card, Pill } from '../../components/ui/primitives'
import { MiniSpark } from '../../components/charts/MiniSpark'
import { BriefingBanner } from '../../components/BriefingBanner'
import { DailyCheckIn } from '../../components/DailyCheckIn'
import { ACCENT } from '../../lib/sections'
import { fmtEUR, fmtNum, sum, avg, round, within, dailySeries } from '../../lib/stats'
import { inThisWeek, daysUntil } from '../../lib/dates'
import { useBriefing, useLiveQuotes } from '../../lib/briefing'
import { downloadBackup, daysSinceBackup } from '../../lib/backup'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up?'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const BACKUP_NUDGE_DAYS = 14

export function Dashboard() {
  const s = useStore()
  const currency = s.settings.currency

  const { briefing } = useBriefing()
  const tickers = useMemo(() => s.financial.holdings.map((h) => h.ticker), [s.financial.holdings])
  const live = useLiveQuotes(tickers)

  // Portfolio glance: live value + day change.
  const glance = useMemo(() => {
    const base = new Map(briefing?.items.map((it) => [it.ticker.toUpperCase(), it]) ?? [])
    let value = 0
    let delta = 0
    let priced = 0
    let ccy: string | undefined
    for (const h of s.financial.holdings) {
      if (h.quantity <= 0) continue
      const key = h.ticker.toUpperCase()
      const l = live.get(key)
      const b = base.get(key)
      const price = l?.price ?? b?.price
      const prev = l?.prevClose ?? b?.previousClose
      if (price == null) continue
      priced++
      value += price * h.quantity
      if (prev != null) delta += (price - prev) * h.quantity
      ccy = ccy ?? b?.currency
    }
    return { value, delta, priced, ccy: ccy ?? currency }
  }, [s.financial.holdings, briefing, live, currency])

  const weekStudy = sum(s.education.study.filter((e) => inThisWeek(e.date)).map((e) => e.hours))
  const nextDeadline = [...s.education.deadlines]
    .filter((d) => !d.done && daysUntil(d.date) >= 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0]

  const weekSessions = s.physical.sessions.filter((x) => inThisWeek(x.date)).length

  const sleep7 = within(s.mental.sleep, (e) => e.date, 7)
  const avgSleep = sleep7.length ? round(avg(sleep7.map((e) => e.hours)), 1) : 0
  const sleepSpark = dailySeries(s.mental.sleep, (e) => e.date, (e) => e.hours, 14)
  const lastNight = [...s.mental.sleep].sort((a, b) => (a.date < b.date ? 1 : -1))[0]

  // Backup nudge: only when there is data worth protecting.
  const [backupDismissed, setBackupDismissed] = useState(false)
  const hasData =
    s.financial.holdings.length + s.education.study.length + s.physical.sessions.length + s.mental.sleep.length > 5
  const sinceBackup = daysSinceBackup()
  const needBackup = hasData && !backupDismissed && (sinceBackup == null || sinceBackup >= BACKUP_NUDGE_DAYS)

  const up = glance.delta >= 0

  return (
    <>
      <header className="appbar">
        <div className="title">
          <span className="eyebrow">{greeting()}</span>
          <h1>Momentum</h1>
        </div>
        <span className="spacer" />
        <Link to="/settings" className="iconbtn" aria-label="Settings">
          ⚙
        </Link>
      </header>

      <div className="stack">
        {/* Backup safety net */}
        {needBackup && (
          <div className="nudge">
            <span style={{ fontSize: 16 }}>🛟</span>
            <span className="grow" style={{ fontSize: 12.5 }}>
              {sinceBackup == null ? 'Your data has never been backed up.' : `Last backup ${sinceBackup} days ago.`}
            </span>
            <button className="btn sm" onClick={downloadBackup}>
              Export
            </button>
            <button className="linkbtn" onClick={() => setBackupDismissed(true)}>
              ✕
            </button>
          </div>
        )}

        {/* Daily check-in — one habit instead of four */}
        <DailyCheckIn />

        {/* Portfolio glance */}
        <Link to="/financial" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card className="hero" accent={ACCENT.financial}>
            <div className="row">
              <span className="pill" style={{ ['--accent' as string]: ACCENT.financial }}>
                ▲ Invest
              </span>
              <span className="spacer" />
              {live.size > 0 && <Pill tone="good">● LIVE</Pill>}
              <span className="dim" style={{ fontSize: 18 }}>›</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
                Portfolio value
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {glance.priced > 0 ? fmtEUR(glance.value, glance.ccy) : '—'}
              </div>
              {glance.priced > 0 && (
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: up ? 'var(--good)' : 'var(--danger)' }}>
                  {up ? '▲' : '▼'} {fmtEUR(Math.abs(glance.delta), glance.ccy)} today
                </div>
              )}
              {glance.priced === 0 && (
                <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                  Add holdings to track your portfolio
                </div>
              )}
            </div>
          </Card>
        </Link>

        <BriefingBanner variant="compact" />

        <div className="grid2">
          {/* Education */}
          <Link to="/education" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card accent={ACCENT.education} className="tile">
              <span className="pill" style={{ ['--accent' as string]: ACCENT.education }}>
                ✎ Study
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
                {fmtNum(weekStudy)}
                <span className="dim" style={{ fontSize: 13 }}> hrs</span>
              </div>
              <div className="dim" style={{ fontSize: 12 }}>
                this week
              </div>
              {nextDeadline && (
                <div style={{ marginTop: 8 }}>
                  <Pill tone={daysUntil(nextDeadline.date) <= 7 ? 'warn' : 'gray'}>
                    {daysUntil(nextDeadline.date)}d · {nextDeadline.kind}
                  </Pill>
                </div>
              )}
            </Card>
          </Link>

          {/* Physical */}
          <Link to="/physical" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card accent={ACCENT.physical} className="tile">
              <span className="pill" style={{ ['--accent' as string]: ACCENT.physical }}>
                ⚡ Body
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
                {weekSessions}
                <span className="dim" style={{ fontSize: 13 }}> / {s.physical.weeklyTarget}</span>
              </div>
              <div className="dim" style={{ fontSize: 12 }}>
                sessions this week
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {Array.from({ length: s.physical.weeklyTarget }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 16,
                      height: 8,
                      borderRadius: 4,
                      background: i < weekSessions ? ACCENT.physical : 'var(--track)',
                    }}
                  />
                ))}
              </div>
            </Card>
          </Link>
        </div>

        {/* Mental — sleep front and centre */}
        <Link to="/mental" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card accent={ACCENT.mental}>
            <div className="row">
              <span className="pill" style={{ ['--accent' as string]: ACCENT.mental }}>
                ☾ Mind
              </span>
              <span className="right dim" style={{ fontSize: 18 }}>
                ›
              </span>
            </div>
            <div className="row" style={{ marginTop: 10, alignItems: 'flex-end', gap: 16 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>
                  {lastNight ? lastNight.hours : '—'}
                  <span className="dim" style={{ fontSize: 13 }}> hrs</span>
                </div>
                <div className="dim" style={{ fontSize: 12 }}>
                  last night · {avgSleep}h avg
                </div>
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                {s.mental.sleep.length > 1 && <MiniSpark data={sleepSpark} color={ACCENT.mental} />}
              </div>
            </div>
          </Card>
        </Link>

        <p className="dim" style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }}>
          All data is stored only on this device · back it up in Settings
        </p>
      </div>
    </>
  )
}
