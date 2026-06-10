import { Card } from './ui/primitives'
import { ACCENT } from '../lib/sections'
import { useBriefing, useBriefingDismiss, timeAgo, type BriefingItem } from '../lib/briefing'

function fmtPrice(item: BriefingItem): string {
  if (item.price == null) return ''
  const cur = item.currency
  try {
    if (cur) return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(item.price)
  } catch {
    /* fall through for non-ISO currency codes */
  }
  return item.price.toLocaleString()
}

function changeColor(pct?: number): string {
  if (pct == null || Math.abs(pct) < 0.05) return 'var(--text-3)'
  return pct > 0 ? 'var(--good)' : 'var(--danger)'
}

function fmtChange(pct?: number): string {
  if (pct == null) return '—'
  const arrow = pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : '•'
  return `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export function BriefingBanner({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { briefing, loading, refresh } = useBriefing()
  const { dismissed, dismiss, undismiss } = useBriefingDismiss(briefing?.generatedAt)

  if (loading) return null

  if (!briefing) {
    return (
      <Card accent={ACCENT.financial} className="briefing">
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="pill" style={{ ['--accent' as string]: ACCENT.financial }}>
            ◴ Market briefing
          </span>
          <span className="spacer" />
          <button className="btn sm ghost" onClick={refresh} style={{ fontSize: 11 }}>
            ↻ Refresh
          </button>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
          No briefing available — runs weekdays after US market close.
        </p>
      </Card>
    )
  }

  if (dismissed) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <span className="dim" style={{ fontSize: 12 }}>Market briefing hidden</span>
        <button className="btn sm ghost" onClick={undismiss} style={{ fontSize: 11 }}>
          Show
        </button>
        <button className="btn sm ghost" onClick={refresh} style={{ fontSize: 11 }}>
          ↻
        </button>
      </div>
    )
  }

  const maxItems = variant === 'compact' ? 4 : 6
  const items = briefing.items.slice(0, maxItems)

  return (
    <Card accent={ACCENT.financial} className="briefing">
      <div className="row" style={{ alignItems: 'center' }}>
        <span className="pill" style={{ ['--accent' as string]: ACCENT.financial }}>
          ◴ Market briefing
        </span>
        <span className="spacer" />
        <span className="dim" style={{ fontSize: 11 }}>
          {timeAgo(briefing.generatedAt)}
        </span>
        <button className="btn sm ghost" onClick={refresh} style={{ fontSize: 11, marginLeft: 8 }}>
          ↻
        </button>
        <button
          className="iconbtn"
          onClick={dismiss}
          aria-label="Dismiss briefing"
          style={{ marginLeft: 4, width: 28, height: 28 }}
        >
          ✕
        </button>
      </div>

      <div className="stack" style={{ gap: 10, marginTop: 10 }}>
        {items.map((item) => (
          <div key={item.ticker}>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{item.ticker}</span>
              {item.name && (
                <span
                  className="dim"
                  style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {item.name}
                </span>
              )}
              <span className="spacer" />
              {item.price != null && (
                <span className="dim" style={{ fontSize: 12 }}>
                  {fmtPrice(item)}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: changeColor(item.changePct), minWidth: 72, textAlign: 'right' }}>
                {fmtChange(item.changePct)}
              </span>
            </div>

            {variant === 'full' &&
              item.headlines.slice(0, 2).map((h, i) => (
                <a
                  key={i}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="briefing-headline"
                  style={{ display: 'block', fontSize: 12, marginTop: 4, color: 'inherit', textDecoration: 'none' }}
                >
                  <span style={{ opacity: 0.85 }}>{h.title}</span>
                  <span className="dim" style={{ fontSize: 11 }}>
                    {' '}— reported by {h.publisher}
                  </span>
                </a>
              ))}
          </div>
        ))}
      </div>

      {variant === 'full' && (
        <p className="dim" style={{ fontSize: 10.5, marginTop: 12, lineHeight: 1.4 }}>
          {briefing.disclaimer ?? 'Information only, reported as published.'} Source: {briefing.source}.
        </p>
      )}
    </Card>
  )
}
