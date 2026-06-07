import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  Card,
  SectionHeader,
  Segmented,
  Field,
  TextInput,
  Select,
  Empty,
  Pill,
} from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'
import { Bars, TrendLine } from '../../components/charts/Charts'
import { weeklyCounts, fmtNum, round } from '../../lib/stats'
import { todayKey, prettyDate, relativeDay, inThisWeek } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import type { LiftEntry } from '../../store/types'

type Tab = 'workouts' | 'lifts' | 'measure'
const C = ACCENT.physical
const SESSION_KINDS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', 'Cardio', 'Other']

// Epley estimated 1-rep max — a single progressive-overload number.
const est1RM = (weight: number, reps: number) => round(weight * (1 + reps / 30), 1)

export function Physical() {
  const sessions = useStore((s) => s.physical.sessions)
  const weeklyTarget = useStore((s) => s.physical.weeklyTarget)
  const setWeeklyTarget = useStore((s) => s.setWeeklyTarget)
  const [tab, setTab] = useState<Tab>('workouts')

  const thisWeek = sessions.filter((s) => inThisWeek(s.date)).length
  const weeks = useMemo(() => weeklyCounts(sessions, (s) => s.date, 8), [sessions])
  const weeksHitting = weeks.filter((w) => w.value >= weeklyTarget).length

  return (
    <>
      <PageHeader eyebrow="Strength + consistency" title="Body" accent={C} />

      <Card className="hero" accent={C}>
        <div className="row">
          <div className="grow">
            <div className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
              This week
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>
              {thisWeek}
              <span className="dim" style={{ fontSize: 16 }}> / {weeklyTarget} sessions</span>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" onClick={() => setWeeklyTarget(Math.max(1, weeklyTarget - 1))}>
              −
            </button>
            <button className="btn sm ghost" onClick={() => setWeeklyTarget(Math.min(14, weeklyTarget + 1))}>
              +
            </button>
          </div>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          {Array.from({ length: weeklyTarget }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 26,
                height: 10,
                borderRadius: 6,
                background: i < thisWeek ? C : 'var(--track)',
              }}
            />
          ))}
        </div>
        <div className="dim" style={{ fontSize: 11, marginTop: 10 }}>
          {weeksHitting}/8 recent weeks hit target · framed around showing up, not calories
        </div>
      </Card>

      <div style={{ margin: '14px 0' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'workouts', label: 'Workouts' },
            { value: 'lifts', label: 'Lifts' },
            { value: 'measure', label: 'Measure' },
          ]}
        />
      </div>

      <div className="stack fadein" key={tab}>
        {tab === 'workouts' && <WorkoutsTab weeks={weeks} target={weeklyTarget} />}
        {tab === 'lifts' && <LiftsTab />}
        {tab === 'measure' && <MeasureTab />}
      </div>
    </>
  )
}

// ---------------- Workouts ----------------
function WorkoutsTab({ weeks, target }: { weeks: { date: string; value: number }[]; target: number }) {
  const sessions = useStore((s) => s.physical.sessions)
  const addSession = useStore((s) => s.addSession)
  const removeSession = useStore((s) => s.removeSession)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Consistency"
          sub="Sessions per week · last 8 weeks"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Session
            </button>
          }
        />
        {sessions.length === 0 ? (
          <Empty icon="🏋️" title="No workouts yet" sub="Log a session — consistency is the whole game." />
        ) : (
          <Bars data={weeks} color={C} target={target} />
        )}
      </Card>

      {sessions.length > 0 && (
        <Card>
          <SectionHeader title="Recent sessions" />
          <div className="list">
            {sessions.slice(0, 14).map((s) => (
              <div className="item" key={s.id}>
                <div className="grow">
                  <div className="t">{s.kind}</div>
                  <div className="s">
                    {relativeDay(s.date)}
                    {s.note ? ` · ${s.note}` : ''}
                  </div>
                </div>
                <button className="linkbtn danger" onClick={() => confirm('Delete session?') && removeSession(s.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SessionForm open={open} onClose={() => setOpen(false)} onSave={addSession} />
    </>
  )
}

function SessionForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: { date: string; kind: string; note?: string }) => void
}) {
  const [kind, setKind] = useState('Push')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Log a workout">
      <div className="stack">
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {SESSION_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="How it felt, what you hit" />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            onSave({ date, kind, note: note.trim() || undefined })
            setNote('')
            setDate(todayKey())
            onClose()
          }}
        >
          Save session
        </button>
      </div>
    </Modal>
  )
}

// ---------------- Lifts ----------------
function LiftsTab() {
  const lifts = useStore((s) => s.physical.lifts)
  const addLift = useStore((s) => s.addLift)
  const removeLift = useStore((s) => s.removeLift)
  const [open, setOpen] = useState(false)

  const liftNames = useMemo(() => [...new Set(lifts.map((l) => l.lift))], [lifts])
  const [selected, setSelected] = useState<string>('')
  const active = selected || liftNames[0] || ''

  // Best estimated 1RM per day for the selected lift.
  const series = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const l of lifts.filter((l) => l.lift === active)) {
      const e = est1RM(l.weight, l.reps)
      byDay.set(l.date, Math.max(byDay.get(l.date) ?? 0, e))
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value }))
  }, [lifts, active])

  const pr = series.length ? Math.max(...series.map((s) => s.value)) : 0

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Progressive overload"
          sub="Estimated 1RM trend (Epley)"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Lift
            </button>
          }
        />
        {lifts.length === 0 ? (
          <Empty icon="📈" title="No lifts logged" sub="Log weight × reps to watch your strength climb." />
        ) : (
          <>
            <div className="chips" style={{ marginBottom: 10 }}>
              {liftNames.map((n) => (
                <button key={n} className={`chip ${n === active ? 'on' : ''}`} onClick={() => setSelected(n)}>
                  {n}
                </button>
              ))}
            </div>
            {series.length >= 2 ? (
              <TrendLine data={series} color={C} unit="kg" />
            ) : (
              <p className="dim" style={{ fontSize: 12 }}>
                Log {active} at least twice to see the trend. Current est. 1RM:{' '}
                <b>{series[0]?.value ?? 0} kg</b>.
              </p>
            )}
            {pr > 0 && (
              <div style={{ marginTop: 8 }}>
                <Pill tone="good">Best est. 1RM · {pr} kg</Pill>
              </div>
            )}
          </>
        )}
      </Card>

      {lifts.length > 0 && (
        <Card>
          <SectionHeader title="Recent sets" />
          <div className="list">
            {lifts.slice(0, 16).map((l) => (
              <div className="item" key={l.id}>
                <div className="grow">
                  <div className="t">{l.lift}</div>
                  <div className="s">
                    {relativeDay(l.date)} · est 1RM {est1RM(l.weight, l.reps)}kg
                  </div>
                </div>
                <span className="amt mono">
                  {l.weight}kg × {l.reps}
                </span>
                <button className="linkbtn danger" onClick={() => confirm('Delete set?') && removeLift(l.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LiftForm open={open} onClose={() => setOpen(false)} onSave={addLift} known={liftNames} />
    </>
  )
}

function LiftForm({
  open,
  onClose,
  onSave,
  known,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: Omit<LiftEntry, 'id' | 'createdAt'>) => void
  known: string[]
}) {
  const [lift, setLift] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [date, setDate] = useState(todayKey())
  return (
    <Modal open={open} onClose={onClose} title="Log a lift">
      <div className="stack">
        <Field label="Lift">
          <TextInput value={lift} onChange={(e) => setLift(e.target.value)} placeholder="e.g. Bench press" list="known-lifts" autoFocus />
          <datalist id="known-lifts">
            {known.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </Field>
        <div className="grid2">
          <Field label="Weight (kg)">
            <TextInput type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="Reps">
            <TextInput type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
        </div>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            const w = parseFloat(weight)
            const r = parseInt(reps, 10)
            if (!lift.trim() || !Number.isFinite(w) || !Number.isFinite(r) || r <= 0) return
            onSave({ lift: lift.trim(), weight: w, reps: r, date })
            setWeight('')
            setReps('')
            onClose()
          }}
        >
          Save lift
        </button>
      </div>
    </Modal>
  )
}

// ---------------- Measure ----------------
function MeasureTab() {
  const measurements = useStore((s) => s.physical.measurements)
  const addMeasurement = useStore((s) => s.addMeasurement)
  const removeMeasurement = useStore((s) => s.removeMeasurement)
  const [open, setOpen] = useState(false)

  const weights = measurements
    .filter((m) => m.weight != null)
    .map((m) => ({ date: m.date, value: m.weight as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Weekly check-in"
          sub="A note (and optional weight) each week"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Note
            </button>
          }
        />
        {weights.length >= 2 && <TrendLine data={weights} color={C} unit="kg" height={150} />}
        {measurements.length === 0 ? (
          <Empty icon="📝" title="No check-ins yet" sub="Jot how training and the body feel each week." />
        ) : (
          <div className="list" style={{ marginTop: weights.length >= 2 ? 8 : 0 }}>
            {measurements.map((m) => (
              <div className="item" key={m.id} style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="t">
                    {prettyDate(m.date)}
                    {m.weight != null && <span className="tag" style={{ marginLeft: 6 }}>{fmtNum(m.weight)} kg</span>}
                  </div>
                  <div className="s" style={{ whiteSpace: 'normal' }}>
                    {m.note}
                  </div>
                </div>
                <button className="linkbtn danger" onClick={() => confirm('Delete note?') && removeMeasurement(m.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <MeasureForm open={open} onClose={() => setOpen(false)} onSave={addMeasurement} />
    </>
  )
}

function MeasureForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: { date: string; weight?: number; note: string }) => void
}) {
  const [note, setNote] = useState('')
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayKey())
  return (
    <Modal open={open} onClose={onClose} title="Weekly check-in">
      <div className="stack">
        <Field label="Note">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Strength up, sleep helped, etc." autoFocus />
        </Field>
        <div className="grid2">
          <Field label="Weight kg (optional)">
            <TextInput type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <button
          className="btn block"
          onClick={() => {
            if (!note.trim()) return
            onSave({ date, note: note.trim(), weight: weight ? parseFloat(weight) : undefined })
            setNote('')
            setWeight('')
            setDate(todayKey())
            onClose()
          }}
        >
          Save check-in
        </button>
      </div>
    </Modal>
  )
}
