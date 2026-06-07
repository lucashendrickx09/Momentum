import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { Card, SectionHeader, Field, TextInput, Empty } from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'
import { Bars } from '../../components/charts/Charts'
import { fmtEUR, sum } from '../../lib/stats'
import { prettyDate, relativeDay, todayKey, monthsAgoKey } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import { format } from 'date-fns'

export function IncomeTab() {
  const income = useStore((s) => s.financial.income)
  const currency = useStore((s) => s.settings.currency)
  const addIncome = useStore((s) => s.addIncome)
  const removeIncome = useStore((s) => s.removeIncome)
  const [open, setOpen] = useState(false)

  const total = sum(income.map((e) => e.amount))

  // Monthly totals for the last 6 months (for the bar chart).
  const monthly = useMemo(() => {
    const buckets = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      buckets.set(format(d, 'yyyy-MM'), 0)
    }
    for (const e of income) {
      const key = e.date.slice(0, 7)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + e.amount)
    }
    return [...buckets.entries()].map(([k, v]) => ({ date: `${k}-15`, value: Math.round(v) }))
  }, [income])

  return (
    <>
      <Card accent={ACCENT.financial}>
        <SectionHeader
          title="Active income"
          sub="Money you've earned — logged by source"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Log
            </button>
          }
        />
        <div className="grid2">
          <div className="stat accent">
            <div className="label">All-time earned</div>
            <div className="value">{fmtEUR(total, currency)}</div>
          </div>
          <div className="stat">
            <div className="label">Last 6 months</div>
            <div className="value">
              {fmtEUR(
                sum(income.filter((e) => e.date >= monthsAgoKey(6)).map((e) => e.amount)),
                currency,
              )}
            </div>
          </div>
        </div>
        {income.length > 0 && (
          <>
            <div className="divider" />
            <Bars data={monthly} color={ACCENT.financial} unit="" />
            <div className="dim" style={{ fontSize: 11, textAlign: 'center' }}>
              Income by month — last 6 months
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionHeader title="History" sub={`${income.length} entries`} />
        {income.length === 0 ? (
          <Empty icon="💶" title="No income logged yet" sub="Tap “Log” to add your first entry." />
        ) : (
          <div className="list">
            {income.map((e) => (
              <div className="item" key={e.id}>
                <div className="grow">
                  <div className="t">{e.source}</div>
                  <div className="s">
                    {relativeDay(e.date)} · {prettyDate(e.date)}
                    {e.note ? ` · ${e.note}` : ''}
                  </div>
                </div>
                <div className="amt" style={{ color: ACCENT.financial }}>
                  +{fmtEUR(e.amount, currency)}
                </div>
                <button
                  className="linkbtn danger"
                  onClick={() => {
                    if (confirm('Delete this income entry?')) removeIncome(e.id)
                  }}
                  aria-label="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <IncomeForm
        open={open}
        onClose={() => setOpen(false)}
        onSave={(v) => {
          addIncome(v)
          setOpen(false)
        }}
      />
    </>
  )
}

function IncomeForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (v: { amount: number; source: string; date: string; note?: string }) => void
}) {
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')

  const submit = () => {
    const a = parseFloat(amount)
    if (!Number.isFinite(a) || a <= 0 || !source.trim()) return
    onSave({ amount: a, source: source.trim(), date, note: note.trim() || undefined })
    setAmount('')
    setSource('')
    setNote('')
    setDate(todayKey())
  }

  return (
    <Modal open={open} onClose={onClose} title="Log income">
      <div className="stack">
        <Field label="Amount (EUR)">
          <TextInput
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Source">
          <TextInput
            placeholder="e.g. Freelance gig, game sale, tutoring"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <TextInput placeholder="Anything to remember" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button className="btn block" onClick={submit}>
          Save income
        </button>
      </div>
    </Modal>
  )
}
