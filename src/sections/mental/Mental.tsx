import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  Card,
  SectionHeader,
  Segmented,
  Field,
  TextInput,
  Empty,
  Rating,
  Pill,
} from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'
import { TrendArea, Bars } from '../../components/charts/Charts'
import { avg, sum, round, dailySeries, within, activeDays, currentStreak } from '../../lib/stats'
import { todayKey, relativeDay } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'

type Tab = 'sleep' | 'mood' | 'focus'
const C = ACCENT.mental
const MOOD_LABELS = ['😞', '😕', '😐', '🙂', '😄']
const ENERGY_LABELS = ['🪫', '🔅', '🔆', '⚡', '🚀']

export function Mental() {
  const sleep = useStore((s) => s.mental.sleep)
  const sleepTarget = useStore((s) => s.mental.sleepTarget)
  const setSleepTarget = useStore((s) => s.setSleepTarget)
  const [tab, setTab] = useState<Tab>('sleep')

  const last7 = within(sleep, (e) => e.date, 7)
  const avg7 = round(avg(last7.map((e) => e.hours)), 1)
  const lastNight = [...sleep].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const streak = currentStreak(activeDays(sleep, (e) => e.date))

  return (
    <>
      <PageHeader eyebrow="Recovery first" title="Mind" accent={C} />

      {/* Sleep — front and centre */}
      <Card className="hero" accent={C}>
        <div className="row">
          <div className="grow">
            <div className="dim" style={{ fontSize: 12, fontWeight: 600 }}>
              Last night
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>
              {lastNight ? lastNight.hours : '—'}
              <span className="dim" style={{ fontSize: 16, fontWeight: 600 }}> hrs</span>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" onClick={() => setSleepTarget(Math.max(4, round(sleepTarget - 0.5, 1)))}>
              −
            </button>
            <div className="stat" style={{ padding: '6px 10px', minWidth: 64 }}>
              <div className="label">Target</div>
              <div className="value" style={{ fontSize: 16 }}>
                {sleepTarget}h
              </div>
            </div>
            <button className="btn sm ghost" onClick={() => setSleepTarget(Math.min(12, round(sleepTarget + 0.5, 1)))}>
              +
            </button>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <Pill tone={avg7 >= sleepTarget ? 'good' : 'warn'}>7-day avg {avg7}h</Pill>
          {streak > 0 && <Pill>🔥 {streak}-day log streak</Pill>}
        </div>
      </Card>

      <div style={{ margin: '14px 0' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sleep', label: 'Sleep' },
            { value: 'mood', label: 'Mood' },
            { value: 'focus', label: 'Focus' },
          ]}
        />
      </div>

      <div className="stack fadein" key={tab}>
        {tab === 'sleep' && <SleepTab target={sleepTarget} />}
        {tab === 'mood' && <MoodTab />}
        {tab === 'focus' && <FocusTab />}
      </div>
    </>
  )
}

// ---------------- Sleep ----------------
function SleepTab({ target }: { target: number }) {
  const sleep = useStore((s) => s.mental.sleep)
  const addSleep = useStore((s) => s.addSleep)
  const removeSleep = useStore((s) => s.removeSleep)
  const [open, setOpen] = useState(false)

  const series = useMemo(() => {
    const map = new Map(sleep.map((e) => [e.date, e.hours]))
    return dailySeries(sleep, (e) => e.date, (e) => e.hours, 14).map((p) => ({
      date: p.date,
      value: map.get(p.date) ?? 0,
    }))
  }, [sleep])

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Sleep hours"
          sub={`Last 14 nights · target ${target}h`}
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Log
            </button>
          }
        />
        {sleep.length === 0 ? (
          <Empty icon="😴" title="No sleep logged" sub="Track hours each morning — this is the keystone metric." />
        ) : (
          <TrendArea data={series} color={C} unit="h" yDomain={[0, 12]} />
        )}
      </Card>

      {sleep.length > 0 && (
        <Card>
          <SectionHeader title="Recent nights" />
          <div className="list">
            {[...sleep]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .slice(0, 12)
              .map((e) => (
                <div className="item" key={e.id}>
                  <div className="grow">
                    <div className="t">{relativeDay(e.date)}</div>
                    {e.note && <div className="s">{e.note}</div>}
                  </div>
                  <span className="amt mono" style={{ color: e.hours >= target ? 'var(--good)' : 'var(--text)' }}>
                    {e.hours}h
                  </span>
                  <button className="linkbtn danger" onClick={() => confirm('Delete entry?') && removeSleep(e.id)}>
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </Card>
      )}

      <SleepForm open={open} onClose={() => setOpen(false)} onSave={addSleep} />
    </>
  )
}

function SleepForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: { date: string; hours: number; note?: string }) => void
}) {
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Log sleep">
      <div className="stack">
        <Field label="Hours slept">
          <TextInput type="number" inputMode="decimal" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="7.5" autoFocus />
        </Field>
        <div className="chips">
          {[6, 6.5, 7, 7.5, 8, 8.5, 9].map((h) => (
            <button key={h} className={`chip ${Number(hours) === h ? 'on' : ''}`} onClick={() => setHours(String(h))}>
              {h}h
            </button>
          ))}
        </div>
        <Field label="Night of">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Woke up rested? Late night?" />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            const h = parseFloat(hours)
            if (!Number.isFinite(h) || h <= 0) return
            onSave({ date, hours: h, note: note.trim() || undefined })
            setHours('')
            setNote('')
            setDate(todayKey())
            onClose()
          }}
        >
          Save sleep
        </button>
      </div>
    </Modal>
  )
}

// ---------------- Mood ----------------
function MoodTab() {
  const moods = useStore((s) => s.mental.moods)
  const addMood = useStore((s) => s.addMood)
  const removeMood = useStore((s) => s.removeMood)
  const [open, setOpen] = useState(false)

  const moodSeries = useMemo(() => seriesFromAvg(moods, (e) => e.mood), [moods])
  const energySeries = useMemo(() => seriesFromAvg(moods, (e) => e.energy), [moods])
  const last7 = within(moods, (e) => e.date, 7)

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Mood & energy"
          sub="Daily 1–5"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Log
            </button>
          }
        />
        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="stat accent">
            <div className="label">Avg mood (7d)</div>
            <div className="value">
              {last7.length ? round(avg(last7.map((e) => e.mood)), 1) : '—'}
              <small>/5</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">Avg energy (7d)</div>
            <div className="value">
              {last7.length ? round(avg(last7.map((e) => e.energy)), 1) : '—'}
              <small>/5</small>
            </div>
          </div>
        </div>
        {moods.length === 0 ? (
          <Empty icon="🌤️" title="No mood logged" sub="A quick daily check keeps the trend honest." />
        ) : (
          <>
            <div className="dim" style={{ fontSize: 11, fontWeight: 600 }}>
              Mood
            </div>
            <TrendArea data={moodSeries} color={C} unit="" yDomain={[1, 5]} height={120} />
            <div className="dim" style={{ fontSize: 11, fontWeight: 600, marginTop: 6 }}>
              Energy
            </div>
            <TrendArea data={energySeries} color="#5fc9d6" unit="" yDomain={[1, 5]} height={120} />
          </>
        )}
      </Card>

      {moods.length > 0 && (
        <Card>
          <SectionHeader title="Recent" />
          <div className="list">
            {moods.slice(0, 12).map((e) => (
              <div className="item" key={e.id}>
                <div className="grow">
                  <div className="t">
                    {MOOD_LABELS[e.mood - 1]} mood · {ENERGY_LABELS[e.energy - 1]} energy
                  </div>
                  <div className="s">
                    {relativeDay(e.date)}
                    {e.note ? ` · ${e.note}` : ''}
                  </div>
                </div>
                <button className="linkbtn danger" onClick={() => confirm('Delete entry?') && removeMood(e.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <MoodForm open={open} onClose={() => setOpen(false)} onSave={addMood} />
    </>
  )
}

function MoodForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: { date: string; mood: number; energy: number; note?: string }) => void
}) {
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="How are you today?">
      <div className="stack">
        <Field label="Mood">
          <Rating value={mood} onChange={setMood} labels={MOOD_LABELS} />
        </Field>
        <Field label="Energy">
          <Rating value={energy} onChange={setEnergy} labels={ENERGY_LABELS} />
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
            onSave({ date, mood, energy, note: note.trim() || undefined })
            setNote('')
            setMood(3)
            setEnergy(3)
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

// ---------------- Focus ----------------
function FocusTab() {
  const focus = useStore((s) => s.mental.focus)
  const addFocus = useStore((s) => s.addFocus)
  const removeFocus = useStore((s) => s.removeFocus)
  const [open, setOpen] = useState(false)

  const screenSeries = useMemo(
    () =>
      dailySeries(
        focus.filter((f) => f.screenMinutes != null),
        (e) => e.date,
        (e) => round((e.screenMinutes ?? 0) / 60, 1),
        14,
      ),
    [focus],
  )
  const last7 = within(focus, (e) => e.date, 7)
  const avgScreen = last7.length
    ? round(avg(last7.filter((f) => f.screenMinutes != null).map((f) => (f.screenMinutes ?? 0) / 60)), 1)
    : 0
  const focusBlocks7 = sum(last7.map((f) => f.focusBlocks ?? 0))

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Screen time & focus"
          sub="Phone hours vs deep-focus blocks"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Log
            </button>
          }
        />
        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="stat">
            <div className="label">Avg screen (7d)</div>
            <div className="value">
              {avgScreen}
              <small>h/day</small>
            </div>
          </div>
          <div className="stat accent">
            <div className="label">Focus blocks (7d)</div>
            <div className="value">{focusBlocks7}</div>
          </div>
        </div>
        {focus.length === 0 ? (
          <Empty icon="🎯" title="No focus logs" sub="Track screen time and deep-work blocks to spot the trade-off." />
        ) : (
          <Bars data={screenSeries} color={C} unit="h" />
        )}
      </Card>

      {focus.length > 0 && (
        <Card>
          <SectionHeader title="Recent" />
          <div className="list">
            {focus.slice(0, 12).map((f) => (
              <div className="item" key={f.id}>
                <div className="grow">
                  <div className="t">
                    {f.screenMinutes != null ? `${round(f.screenMinutes / 60, 1)}h screen` : ''}
                    {f.screenMinutes != null && f.focusBlocks != null ? ' · ' : ''}
                    {f.focusBlocks != null ? `${f.focusBlocks} focus blocks` : ''}
                  </div>
                  <div className="s">
                    {relativeDay(f.date)}
                    {f.note ? ` · ${f.note}` : ''}
                  </div>
                </div>
                <button className="linkbtn danger" onClick={() => confirm('Delete entry?') && removeFocus(f.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <FocusForm open={open} onClose={() => setOpen(false)} onSave={addFocus} />
    </>
  )
}

function FocusForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: { date: string; screenMinutes?: number; focusBlocks?: number; note?: string }) => void
}) {
  const [screenH, setScreenH] = useState('')
  const [blocks, setBlocks] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Log focus">
      <div className="stack">
        <div className="grid2">
          <Field label="Screen time (hrs)">
            <TextInput type="number" inputMode="decimal" value={screenH} onChange={(e) => setScreenH(e.target.value)} placeholder="e.g. 4.5" autoFocus />
          </Field>
          <Field label="Focus blocks">
            <TextInput type="number" inputMode="numeric" value={blocks} onChange={(e) => setBlocks(e.target.value)} placeholder="e.g. 3" />
          </Field>
        </div>
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button
          className="btn block"
          onClick={() => {
            const sH = screenH ? parseFloat(screenH) : undefined
            const b = blocks ? parseInt(blocks, 10) : undefined
            if (sH == null && b == null) return
            onSave({
              date,
              screenMinutes: sH != null ? Math.round(sH * 60) : undefined,
              focusBlocks: b,
              note: note.trim() || undefined,
            })
            setScreenH('')
            setBlocks('')
            setNote('')
            setDate(todayKey())
            onClose()
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  )
}

// Average a 1–5 metric per day across the last 14 days (gaps -> null line break).
function seriesFromAvg<T extends { date: string }>(items: T[], get: (t: T) => number) {
  const byDay = new Map<string, number[]>()
  for (const it of items) {
    const arr = byDay.get(it.date) ?? []
    arr.push(get(it))
    byDay.set(it.date, arr)
  }
  return dailySeries(items, (e) => e.date, () => 0, 14).map((p) => {
    const vals = byDay.get(p.date)
    return { date: p.date, value: vals ? round(avg(vals), 1) : (null as unknown as number) }
  })
}
