import { useEffect, useMemo, useState } from 'react'
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
  Bar,
  Pill,
} from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'
import { TrendArea } from '../../components/charts/Charts'
import { sum, fmtNum, dailySeries, within } from '../../lib/stats'
import { todayKey, prettyDate, daysUntil, inThisWeek } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import type { Deadline, SubjectId } from '../../store/types'

type Tab = 'study' | 'grades' | 'deadlines'
const C = ACCENT.education

export function Education() {
  const study = useStore((s) => s.education.study)
  const deadlines = useStore((s) => s.education.deadlines)
  const [tab, setTab] = useState<Tab>('study')

  const weekHours = sum(study.filter((e) => inThisWeek(e.date)).map((e) => e.hours))
  const nextDeadline = [...deadlines]
    .filter((d) => !d.done && daysUntil(d.date) >= 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0]

  return (
    <>
      <PageHeader eyebrow="IB Diploma" title="Study" accent={C} />

      <Card className="hero" accent={C}>
        <div className="grid2">
          <div>
            <div className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
              This week
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>
              {fmtNum(weekHours)}
              <span className="dim" style={{ fontSize: 15 }}> hrs studied</span>
            </div>
          </div>
          <div>
            <div className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
              Next deadline
            </div>
            {nextDeadline ? (
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C }}>
                  {daysUntil(nextDeadline.date)}d
                </div>
                <div className="dim" style={{ fontSize: 12 }}>
                  {nextDeadline.title}
                </div>
              </div>
            ) : (
              <div className="dim" style={{ marginTop: 6, fontSize: 13 }}>
                None scheduled
              </div>
            )}
          </div>
        </div>
      </Card>

      <div style={{ margin: '14px 0' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'study', label: 'Study' },
            { value: 'grades', label: 'Grades' },
            { value: 'deadlines', label: 'Deadlines' },
          ]}
        />
      </div>

      <div className="stack fadein" key={tab}>
        {tab === 'study' && <StudyTab />}
        {tab === 'grades' && <GradesTab />}
        {tab === 'deadlines' && <DeadlinesTab />}
      </div>
    </>
  )
}

// ---------------- Study timer ----------------
// Start/stop timer that logs straight into study history — more accurate
// and lower friction than estimating hours after the fact. The active
// timer survives reloads via localStorage.

const TIMER_KEY = 'momentum-study-timer'

interface ActiveTimer {
  subject: SubjectId
  startedAt: number // epoch ms
}

function loadTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as ActiveTimer
    // Discard absurd leftovers (> 16h means a forgotten timer).
    if (Date.now() - t.startedAt > 16 * 3600000) {
      localStorage.removeItem(TIMER_KEY)
      return null
    }
    return t
  } catch {
    return null
  }
}

function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function StudyTimer() {
  const subjects = useStore((s) => s.education.subjects)
  const addStudy = useStore((s) => s.addStudy)
  const [active, setActive] = useState<ActiveTimer | null>(loadTimer)
  const [subject, setSubject] = useState<SubjectId>(subjects[0]?.id ?? 'math-ai-hl')
  const [, forceTick] = useState(0)

  // Tick every second while running so the elapsed display updates.
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => forceTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [active])

  const start = () => {
    const t: ActiveTimer = { subject, startedAt: Date.now() }
    try { localStorage.setItem(TIMER_KEY, JSON.stringify(t)) } catch { /* ignore */ }
    setActive(t)
  }

  const stop = () => {
    if (!active) return
    const elapsed = Date.now() - active.startedAt
    const hours = Math.round((elapsed / 3600000) * 100) / 100
    if (hours >= 0.02) {
      addStudy({ subject: active.subject, date: todayKey(), hours, note: 'Timed session' })
    }
    try { localStorage.removeItem(TIMER_KEY) } catch { /* ignore */ }
    setActive(null)
  }

  const discard = () => {
    if (!confirm('Discard this timed session without logging?')) return
    try { localStorage.removeItem(TIMER_KEY) } catch { /* ignore */ }
    setActive(null)
  }

  if (active) {
    const subj = subjects.find((s) => s.id === active.subject)
    return (
      <Card className="hero" accent={C}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="grow">
            <div className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
              Studying {subj?.name ?? active.subject}
            </div>
            <div className="mono" style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.01em', marginTop: 2 }}>
              {fmtElapsed(Date.now() - active.startedAt)}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={stop}>
              ■ Stop & log
            </button>
            <button className="linkbtn danger" onClick={discard}>
              ✕
            </button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card accent={C}>
      <SectionHeader title="Study timer" sub="Start when you sit down — it logs itself" />
      <div className="chips" style={{ marginBottom: 10 }}>
        {subjects.map((s) => (
          <button
            key={s.id}
            className={`chip ${subject === s.id ? 'on' : ''}`}
            onClick={() => setSubject(s.id)}
          >
            {s.short}
          </button>
        ))}
      </div>
      <button className="btn block" onClick={start}>
        ▶ Start studying
      </button>
    </Card>
  )
}

// ---------------- Study ----------------
function StudyTab() {
  const subjects = useStore((s) => s.education.subjects)
  const study = useStore((s) => s.education.study)
  const addStudy = useStore((s) => s.addStudy)
  const removeStudy = useStore((s) => s.removeStudy)
  const [open, setOpen] = useState(false)

  const series = useMemo(() => dailySeries(study, (e) => e.date, (e) => e.hours, 14), [study])

  // Per-subject hours in the last 7 days.
  const last7 = within(study, (e) => e.date, 7)
  const perSubject = subjects
    .map((s) => ({
      subject: s,
      hours: sum(last7.filter((e) => e.subject === s.id).map((e) => e.hours)),
    }))
    .sort((a, b) => b.hours - a.hours)
  const maxH = Math.max(1, ...perSubject.map((p) => p.hours))

  return (
    <>
      <StudyTimer />

      <Card accent={C}>
        <SectionHeader
          title="Study hours"
          sub="Last 14 days"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Log
            </button>
          }
        />
        {study.length === 0 ? (
          <Empty icon="📚" title="No study logged" sub="Track hours per subject to see momentum build." />
        ) : (
          <TrendArea data={series} color={C} unit="h" />
        )}
      </Card>

      <Card>
        <SectionHeader title="By subject" sub="Hours in the last 7 days" />
        <div className="stack" style={{ gap: 12 }}>
          {perSubject.map(({ subject, hours }) => (
            <div key={subject.id}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {subject.name} <span className="tag">{subject.level}</span>
                </span>
                <span className="mono dim" style={{ fontSize: 13 }}>
                  {fmtNum(hours)}h
                </span>
              </div>
              <Bar pct={(hours / maxH) * 100} />
            </div>
          ))}
        </div>
      </Card>

      {study.length > 0 && (
        <Card>
          <SectionHeader title="Recent sessions" />
          <div className="list">
            {study.slice(0, 12).map((e) => {
              const subj = subjects.find((s) => s.id === e.subject)
              return (
                <div className="item" key={e.id}>
                  <div className="grow">
                    <div className="t">{subj?.name ?? e.subject}</div>
                    <div className="s">
                      {prettyDate(e.date)}
                      {e.note ? ` · ${e.note}` : ''}
                    </div>
                  </div>
                  <span className="amt mono">{fmtNum(e.hours)}h</span>
                  <button className="linkbtn danger" onClick={() => confirm('Delete session?') && removeStudy(e.id)}>
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <StudyForm open={open} onClose={() => setOpen(false)} onSave={addStudy} />
    </>
  )
}

function StudyForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: { subject: SubjectId; date: string; hours: number; note?: string }) => void
}) {
  const subjects = useStore((s) => s.education.subjects)
  const [subject, setSubject] = useState<SubjectId>(subjects[0]?.id ?? 'math-ai-hl')
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Log study time">
      <div className="stack">
        <Field label="Subject">
          <Select value={subject} onChange={(e) => setSubject(e.target.value as SubjectId)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.level})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid2">
          <Field label="Hours">
            <TextInput type="number" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1.5" autoFocus />
          </Field>
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Topic / note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. IA draft, past paper" />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            const h = parseFloat(hours)
            if (!Number.isFinite(h) || h <= 0) return
            onSave({ subject, date, hours: h, note: note.trim() || undefined })
            setHours('')
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

// ---------------- Grades ----------------
function GradesTab() {
  const subjects = useStore((s) => s.education.subjects)
  const updateSubject = useStore((s) => s.updateSubject)

  return (
    <Card accent={C}>
      <SectionHeader title="Predicted vs target" sub="Tap +/− to adjust each subject" />
      <div className="stack" style={{ gap: 14 }}>
        {subjects.map((s) => {
          const max = s.id === 'tok' ? 3 : 7
          const gap = s.predicted - s.target
          return (
            <div key={s.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {s.name} <span className="tag">{s.level}</span>
                </span>
                {gap >= 0 ? (
                  <Pill tone="good">on track</Pill>
                ) : (
                  <Pill tone="warn">{gap} to target</Pill>
                )}
              </div>
              <div className="row" style={{ marginTop: 8, gap: 16 }}>
                <Stepper
                  label="Predicted"
                  value={s.predicted}
                  max={max}
                  onChange={(v) => updateSubject(s.id, { predicted: v })}
                />
                <Stepper
                  label="Target"
                  value={s.target}
                  max={max}
                  onChange={(v) => updateSubject(s.id, { target: v })}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <Bar pct={(s.predicted / max) * 100} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ flex: 1 }}>
      <div className="dim" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm ghost" onClick={() => onChange(Math.max(1, value - 1))}>
          −
        </button>
        <span style={{ fontWeight: 800, fontSize: 18, minWidth: 22, textAlign: 'center' }}>{value}</span>
        <button className="btn sm ghost" onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
      </div>
    </div>
  )
}

// ---------------- Deadlines ----------------
const KINDS: Deadline['kind'][] = ['IA', 'EE', 'TOK', 'IO', 'Other']
const KIND_LABEL: Record<Deadline['kind'], string> = {
  IA: 'Internal Assessment',
  EE: 'Extended Essay',
  TOK: 'TOK Exhibition / Essay',
  IO: 'Individual Oral',
  Other: 'Other',
}

function DeadlinesTab() {
  const deadlines = useStore((s) => s.education.deadlines)
  const addDeadline = useStore((s) => s.addDeadline)
  const updateDeadline = useStore((s) => s.updateDeadline)
  const removeDeadline = useStore((s) => s.removeDeadline)
  const [open, setOpen] = useState(false)

  const sorted = [...deadlines].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1
    return a.date < b.date ? -1 : 1
  })

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Deadline countdowns"
          sub="IA · EE · TOK · Individual Oral"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Add
            </button>
          }
        />
        {deadlines.length === 0 ? (
          <Empty icon="⏳" title="No deadlines yet" sub="Add your IA / EE / TOK / IO dates to start the countdown." />
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {sorted.map((d) => {
              const days = daysUntil(d.date)
              const tone = d.done ? 'gray' : days < 0 ? 'danger' : days <= 7 ? 'warn' : 'good'
              return (
                <div className="countdown" key={d.id} style={{ opacity: d.done ? 0.55 : 1 }}>
                  <div className="days" style={{ color: d.done ? 'var(--text-3)' : `var(--${tone === 'gray' ? 'text-3' : tone})` }}>
                    {d.done ? '✓' : days < 0 ? `${Math.abs(days)}` : days}
                    <small>{d.done ? 'done' : days < 0 ? 'days ago' : 'days left'}</small>
                  </div>
                  <div className="grow">
                    <div className="t">{d.title}</div>
                    <div className="s">
                      <span className="tag">{d.kind}</span> {prettyDate(d.date)}
                    </div>
                  </div>
                  <button className="linkbtn" onClick={() => updateDeadline(d.id, { done: !d.done })} aria-label="Toggle done">
                    {d.done ? '↺' : '✓'}
                  </button>
                  <button className="linkbtn danger" onClick={() => confirm('Delete deadline?') && removeDeadline(d.id)}>
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <DeadlineForm open={open} onClose={() => setOpen(false)} onSave={addDeadline} />
    </>
  )
}

function DeadlineForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (d: { title: string; kind: Deadline['kind']; date: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<Deadline['kind']>('IA')
  const [date, setDate] = useState(todayKey())
  return (
    <Modal open={open} onClose={onClose} title="Add deadline">
      <div className="stack">
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as Deadline['kind'])}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k} — {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Physics IA final draft" autoFocus />
        </Field>
        <Field label="Due date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            if (!title.trim()) return
            onSave({ title: title.trim(), kind, date })
            setTitle('')
            setKind('IA')
            setDate(todayKey())
            onClose()
          }}
        >
          Add deadline
        </button>
      </div>
    </Modal>
  )
}
