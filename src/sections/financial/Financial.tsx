import { useState } from 'react'
import { useStore } from '../../store/store'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, Segmented, Bar } from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'
import { Field, TextInput } from '../../components/ui/primitives'
import { fmtEUR, sum } from '../../lib/stats'
import { monthsAgoKey } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import { IncomeTab } from './IncomeTab'
import { ProjectsTab } from './ProjectsTab'
import { PortfolioTab } from './PortfolioTab'

type Tab = 'income' | 'pipeline' | 'portfolio'

export function Financial() {
  const income = useStore((s) => s.financial.income)
  const goalTarget = useStore((s) => s.financial.goalTarget)
  const setGoalTarget = useStore((s) => s.setGoalTarget)
  const currency = useStore((s) => s.settings.currency)
  const [tab, setTab] = useState<Tab>('income')
  const [goalOpen, setGoalOpen] = useState(false)

  const earned6mo = sum(income.filter((e) => e.date >= monthsAgoKey(6)).map((e) => e.amount))
  const pct = goalTarget > 0 ? (earned6mo / goalTarget) * 100 : 0

  return (
    <>
      <PageHeader eyebrow="Top priority" title="Money" accent={ACCENT.financial} />

      {/* 6-month income goal hero */}
      <Card className="hero" accent={ACCENT.financial}>
        <div className="row">
          <div className="grow">
            <div className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
              6-month income goal
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>
              {fmtEUR(earned6mo, currency)}
              <span className="dim" style={{ fontSize: 16, fontWeight: 600 }}>
                {' '}
                / {fmtEUR(goalTarget, currency)}
              </span>
            </div>
          </div>
          <button className="iconbtn" onClick={() => setGoalOpen(true)} aria-label="Edit goal">
            ✎
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <Bar pct={pct} tall />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span className="dim" style={{ fontSize: 11 }}>
              {fmtEUR(100, currency)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT.financial }}>
              {Math.round(pct)}% there
            </span>
            <span className="dim" style={{ fontSize: 11 }}>
              {fmtEUR(500, currency)}
            </span>
          </div>
        </div>
      </Card>

      <div style={{ margin: '14px 0' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'income', label: 'Income' },
            { value: 'pipeline', label: 'Pipeline' },
            { value: 'portfolio', label: 'Portfolio' },
          ]}
        />
      </div>

      <div className="stack fadein" key={tab}>
        {tab === 'income' && <IncomeTab />}
        {tab === 'pipeline' && <ProjectsTab />}
        {tab === 'portfolio' && <PortfolioTab />}
      </div>

      <GoalModal open={goalOpen} onClose={() => setGoalOpen(false)} value={goalTarget} onSave={setGoalTarget} />
    </>
  )
}

function GoalModal({
  open,
  onClose,
  value,
  onSave,
}: {
  open: boolean
  onClose: () => void
  value: number
  onSave: (v: number) => void
}) {
  const [v, setV] = useState(String(value))
  return (
    <Modal open={open} onClose={onClose} title="6-month income goal">
      <div className="stack">
        <Field label="Target (EUR)" hint="A 6-month active-income target. The bar's reference band is €100–€500.">
          <TextInput type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
        </Field>
        <div className="chips">
          {[100, 250, 350, 500].map((n) => (
            <button key={n} className={`chip ${Number(v) === n ? 'on' : ''}`} onClick={() => setV(String(n))}>
              €{n}
            </button>
          ))}
        </div>
        <button
          className="btn block"
          onClick={() => {
            const n = parseFloat(v)
            if (Number.isFinite(n) && n > 0) onSave(n)
            onClose()
          }}
        >
          Save goal
        </button>
      </div>
    </Modal>
  )
}
