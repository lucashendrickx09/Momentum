import { useRef, useState } from 'react'
import { useStore } from '../../store/store'
import { Card, SectionHeader, Field, TextInput, TextArea, Empty, Pill } from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'
import { TrendLine } from '../../components/charts/Charts'
import { fmtEUR, sum } from '../../lib/stats'
import { prettyDate, todayKey } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import { fetchHoldingsFromUrl, parseHoldingsCSV, parsePastedHoldings } from '../../lib/csv'
import { readFileText } from '../../lib/backup'
import type { Holding } from '../../store/types'

export function PortfolioTab() {
  const holdings = useStore((s) => s.financial.holdings)
  const netPositions = useStore((s) => s.financial.netPositions)
  const currency = useStore((s) => s.settings.currency)
  const removeHolding = useStore((s) => s.removeHolding)
  const removeNet = useStore((s) => s.removeNetPosition)

  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Holding | null>(null)
  const [netOpen, setNetOpen] = useState(false)

  const costBasis = sum(holdings.map((h) => h.costBasis ?? 0))
  const latestNet = netPositions[0]?.amount

  const netSeries = [...netPositions]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((n) => ({ date: n.date, value: Math.round(n.amount) }))

  return (
    <>
      {/* Net position */}
      <Card accent={ACCENT.financial}>
        <SectionHeader
          title="Net position"
          sub="Savings + holdings over time"
          right={
            <button className="btn sm" onClick={() => setNetOpen(true)}>
              + Snapshot
            </button>
          }
        />
        <div className="grid2">
          <div className="stat accent">
            <div className="label">Latest net</div>
            <div className="value">{latestNet != null ? fmtEUR(latestNet, currency) : '—'}</div>
          </div>
          <div className="stat">
            <div className="label">Invested (cost)</div>
            <div className="value">{fmtEUR(costBasis, currency)}</div>
          </div>
        </div>
        {netSeries.length >= 2 ? (
          <>
            <div className="divider" />
            <TrendLine data={netSeries} color={ACCENT.financial} unit="" />
          </>
        ) : (
          <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>
            Add snapshots over time to see your savings line grow.
          </p>
        )}
        {netPositions.length > 0 && (
          <div className="list" style={{ marginTop: 6 }}>
            {netPositions.slice(0, 4).map((n) => (
              <div className="item" key={n.id}>
                <div className="grow">
                  <div className="t">{fmtEUR(n.amount, currency)}</div>
                  <div className="s">
                    {prettyDate(n.date)}
                    {n.note ? ` · ${n.note}` : ''}
                  </div>
                </div>
                <button className="linkbtn danger" onClick={() => confirm('Delete snapshot?') && removeNet(n.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Holdings */}
      <Card>
        <SectionHeader
          title="Holdings"
          sub={`${holdings.length} positions`}
          right={
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm ghost" onClick={() => setImportOpen(true)}>
                Import
              </button>
              <button
                className="btn sm"
                onClick={() =>
                  setEditing({ id: '', createdAt: '', ticker: '', quantity: 0 } as Holding)
                }
              >
                + Add
              </button>
            </div>
          }
        />
        {holdings.length === 0 ? (
          <Empty
            icon="📈"
            title="No holdings yet"
            sub="Import from a Google Sheet CSV / file, or add one manually."
          />
        ) : (
          <div className="list">
            {holdings.map((h) => (
              <div className="item" key={h.id} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <span className="t" style={{ fontWeight: 800 }}>
                      {h.ticker}
                    </span>
                    {h.name && <span className="dim" style={{ fontSize: 12 }}>{h.name}</span>}
                  </div>
                  <div className="s">
                    {h.quantity} units{h.costBasis ? ` · cost ${fmtEUR(h.costBasis, currency)}` : ''}
                  </div>
                  {h.buyReason && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12.5,
                        color: 'var(--text-2)',
                        borderLeft: `2px solid ${ACCENT.financial}`,
                        paddingLeft: 8,
                      }}
                    >
                      {h.buyReason}
                    </div>
                  )}
                </div>
                <button className="linkbtn" onClick={() => setEditing(h)}>
                  ✎
                </button>
                <button className="linkbtn danger" onClick={() => confirm(`Remove ${h.ticker}?`) && removeHolding(h.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>
          Daily prices &amp; headlines for these tickers show in the Market briefing card above.
          This list tracks your positions, cost and your own buy reasons.
        </p>
      </Card>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <HoldingForm holding={editing} onClose={() => setEditing(null)} />
      <NetForm open={netOpen} onClose={() => setNetOpen(false)} />
    </>
  )
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const savedUrl = useStore((s) => s.financial.holdingsCsvUrl)
  const replaceHoldings = useStore((s) => s.replaceHoldings)
  const setUrl = useStore((s) => s.setHoldingsCsvUrl)
  const [url, setUrlLocal] = useState(savedUrl ?? '')
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const pastePreview = paste.trim() ? parsePastedHoldings(paste) : []

  const fromPaste = () => {
    if (pastePreview.length === 0) {
      setMsg({ ok: false, text: 'No tickers found — paste rows that start with a stock symbol.' })
      return
    }
    replaceHoldings(pastePreview)
    setMsg({ ok: true, text: `Loaded ${pastePreview.length} holdings.` })
    setPaste('')
  }

  const fromUrl = async () => {
    if (!url.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const list = await fetchHoldingsFromUrl(url.trim())
      replaceHoldings(list)
      setUrl(url.trim())
      setMsg({ ok: true, text: `Imported ${list.length} holdings.` })
    } catch (e) {
      setMsg({
        ok: false,
        text:
          (e as Error).message +
          ' — make sure the sheet is published to the web as CSV (File ▸ Share ▸ Publish to web).',
      })
    } finally {
      setBusy(false)
    }
  }

  const fromFile = async (file: File) => {
    setBusy(true)
    setMsg(null)
    try {
      const text = await readFileText(file)
      const list = parseHoldingsCSV(text)
      if (list.length === 0) throw new Error('No ticker column found in that file.')
      replaceHoldings(list)
      setMsg({ ok: true, text: `Imported ${list.length} holdings from file.` })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import holdings">
      <div className="stack">
        <Field
          label="Paste your stocks"
          hint="Paste rows from a spreadsheet or broker (one stock per line). It auto-detects the symbol, name, shares and cost — extra columns are fine."
        >
          <TextArea
            rows={5}
            placeholder={'TSM\tTSMC\t…\t12\t$187.00\t$2,244.00\nMSFT\tMicrosoft\t…\t1\t$512.40\t$512.40'}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'pre' }}
          />
        </Field>
        {pastePreview.length > 0 && (
          <div className="list" style={{ maxHeight: 150, overflowY: 'auto' }}>
            {pastePreview.slice(0, 30).map((h, i) => (
              <div className="item" key={i}>
                <div className="grow">
                  <span style={{ fontWeight: 800 }}>{h.ticker}</span>
                  {h.name && <span className="dim" style={{ fontSize: 12 }}> {h.name}</span>}
                </div>
                <span className="dim" style={{ fontSize: 12 }}>
                  {h.quantity || 0} units{h.costBasis ? ` · cost ${h.costBasis}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        <button className="btn block" onClick={fromPaste} disabled={busy || pastePreview.length === 0}>
          {pastePreview.length > 0 ? `Load ${pastePreview.length} holdings` : 'Load pasted stocks'}
        </button>

        <div className="row" style={{ gap: 10 }}>
          <div className="divider" style={{ flex: 1 }} />
          <span className="dim" style={{ fontSize: 11 }}>
            OR
          </span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        <Field
          label="Published Google Sheet CSV URL"
          hint="Sheet ▸ File ▸ Share ▸ Publish to web ▸ CSV. A normal sheet share link works too."
        >
          <TextInput
            placeholder="https://docs.google.com/spreadsheets/…"
            value={url}
            onChange={(e) => setUrlLocal(e.target.value)}
          />
        </Field>
        <button className="btn block" onClick={fromUrl} disabled={busy}>
          {busy ? 'Importing…' : 'Import from URL'}
        </button>

        <div className="row" style={{ gap: 10 }}>
          <div className="divider" style={{ flex: 1 }} />
          <span className="dim" style={{ fontSize: 11 }}>
            OR
          </span>
          <div className="divider" style={{ flex: 1 }} />
        </div>

        <button className="btn ghost block" onClick={() => fileRef.current?.click()} disabled={busy}>
          Upload CSV file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) fromFile(f)
            e.target.value = ''
          }}
        />

        {msg && (
          <div style={{ fontSize: 13 }}>
            <Pill tone={msg.ok ? 'good' : 'danger'}>{msg.ok ? 'Done' : 'Error'}</Pill>{' '}
            <span className="muted">{msg.text}</span>
          </div>
        )}
        <p className="dim" style={{ fontSize: 11 }}>
          Recognised columns: ticker/symbol, name, quantity/shares, cost/invested, reason/notes.
          Re-importing keeps any buy reasons you've already written.
        </p>
      </div>
    </Modal>
  )
}

function HoldingForm({ holding, onClose }: { holding: Holding | null; onClose: () => void }) {
  const addHolding = useStore((s) => s.addHolding)
  const updateHolding = useStore((s) => s.updateHolding)
  const isEdit = !!holding?.id
  const [ticker, setTicker] = useState(holding?.ticker ?? '')
  const [name, setName] = useState(holding?.name ?? '')
  const [qty, setQty] = useState(holding ? String(holding.quantity || '') : '')
  const [cost, setCost] = useState(holding?.costBasis ? String(holding.costBasis) : '')
  const [reason, setReason] = useState(holding?.buyReason ?? '')

  // Re-sync local state whenever a different holding is opened.
  const key = holding?.id ?? holding?.ticker ?? 'new'

  return (
    <Modal open={!!holding} onClose={onClose} title={isEdit ? `Edit ${holding?.ticker}` : 'Add holding'}>
      <div className="stack" key={key}>
        <div className="grid2">
          <Field label="Ticker">
            <TextInput value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="AAPL" />
          </Field>
          <Field label="Quantity">
            <TextInput type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
        </div>
        <Field label="Name (optional)">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc." />
        </Field>
        <Field label="Cost basis EUR (optional)">
          <TextInput type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Why I bought it — your thesis">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The reason behind this position…" />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            if (!ticker.trim()) return
            const payload = {
              ticker: ticker.trim().toUpperCase(),
              name: name.trim() || undefined,
              quantity: parseFloat(qty) || 0,
              costBasis: cost ? parseFloat(cost) : undefined,
              buyReason: reason.trim() || undefined,
            }
            if (isEdit && holding) updateHolding(holding.id, payload)
            else addHolding(payload)
            onClose()
          }}
        >
          {isEdit ? 'Save changes' : 'Add holding'}
        </button>
      </div>
    </Modal>
  )
}

function NetForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addNet = useStore((s) => s.addNetPosition)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Net position snapshot">
      <div className="stack">
        <Field label="Total net position (EUR)" hint="Savings + cash + investments — your call on what to include.">
          <TextInput type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            const a = parseFloat(amount)
            if (!Number.isFinite(a)) return
            addNet({ amount: a, date, note: note.trim() || undefined })
            setAmount('')
            setNote('')
            setDate(todayKey())
            onClose()
          }}
        >
          Save snapshot
        </button>
      </div>
    </Modal>
  )
}
