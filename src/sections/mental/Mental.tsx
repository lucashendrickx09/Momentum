import { useEffect, useMemo, useRef, useState } from 'react'
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
import { todayKey, relativeDay, prettyDate } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import type { DreamEntry } from '../../store/types'

type Tab = 'sleep' | 'mood' | 'focus' | 'dreams'
const C = ACCENT.mental
const MOOD_LABELS = ['😞', '😕', '😐', '🙂', '😄']
const ENERGY_LABELS = ['🪫', '🔅', '🔆', '⚡', '🚀']

// ── Screen-time auto-tracker ─────────────────────────────────────────────────
// Tracks how long this PWA was visible today using the Page Visibility API.
// Stored in localStorage so it persists across reloads.

const SCREEN_TIME_KEY = 'momentum-screen-time'
const SLEEP_SUGGEST_KEY = 'momentum-sleep-suggest'

interface ScreenTimeDay {
  date: string
  minutes: number
}

function getScreenDays(): ScreenTimeDay[] {
  try {
    return JSON.parse(localStorage.getItem(SCREEN_TIME_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveScreenDays(days: ScreenTimeDay[]) {
  try {
    // Keep last 30 days
    const trimmed = days.slice(-30)
    localStorage.setItem(SCREEN_TIME_KEY, JSON.stringify(trimmed))
  } catch { /* ignore */ }
}

function addScreenMinutes(mins: number) {
  const today = todayKey()
  const days = getScreenDays()
  const idx = days.findIndex((d) => d.date === today)
  if (idx >= 0) {
    days[idx].minutes = (days[idx].minutes ?? 0) + mins
  } else {
    days.push({ date: today, minutes: mins })
  }
  saveScreenDays(days)
}

function getTodayScreenMinutes(): number {
  const today = todayKey()
  return getScreenDays().find((d) => d.date === today)?.minutes ?? 0
}

function useScreenTimeTracker() {
  const startRef = useRef<number | null>(null)
  const [todayMins, setTodayMins] = useState(getTodayScreenMinutes)

  useEffect(() => {
    if (document.visibilityState === 'visible') {
      startRef.current = Date.now()
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        if (startRef.current != null) {
          const mins = (Date.now() - startRef.current) / 60000
          addScreenMinutes(mins)
          startRef.current = null
          setTodayMins(getTodayScreenMinutes())
        }
      } else {
        startRef.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      // Flush remaining time when component unmounts
      if (startRef.current != null) {
        const mins = (Date.now() - startRef.current) / 60000
        addScreenMinutes(mins)
        startRef.current = null
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { todayMins: round(todayMins, 1) }
}

// ── Sleep auto-detect ─────────────────────────────────────────────────────────
// When the app is hidden between 9pm–3am, records a "potential sleep start".
// When the app is shown between 4am–11am, computes elapsed time as suggested sleep.

interface SleepSuggest {
  hiddenAt: string  // ISO
  shownAt?: string  // ISO
  hours?: number
  date: string      // YYYY-MM-DD of the morning (the "night of" key)
}

function useSleepAutoDetect() {
  const [suggest, setSuggest] = useState<SleepSuggest | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(SLEEP_SUGGEST_KEY) ?? 'null')
    } catch {
      return null
    }
  })

  useEffect(() => {
    function onVisibility() {
      const now = new Date()
      const hour = now.getHours()

      if (document.visibilityState === 'hidden') {
        // User leaves app — if evening/night, record as potential sleep start
        if (hour >= 21 || hour < 3) {
          const pending: SleepSuggest = { hiddenAt: now.toISOString(), date: todayKey() }
          try { localStorage.setItem(SLEEP_SUGGEST_KEY, JSON.stringify(pending)) } catch { /* ignore */ }
        }
      } else {
        // User returns — check if there's a pending sleep start from the night
        if (hour >= 4 && hour < 12) {
          try {
            const stored = JSON.parse(localStorage.getItem(SLEEP_SUGGEST_KEY) ?? 'null') as SleepSuggest | null
            if (stored && !stored.shownAt) {
              const hiddenTime = new Date(stored.hiddenAt).getTime()
              const elapsed = (now.getTime() - hiddenTime) / 3600000
              if (elapsed >= 3 && elapsed <= 14) {
                const shownAt = now.toISOString()
                const hours = round(elapsed, 1)
                const updated: SleepSuggest = { ...stored, shownAt, hours }
                localStorage.setItem(SLEEP_SUGGEST_KEY, JSON.stringify(updated))
                setSuggest(updated)
              }
            }
          } catch { /* ignore */ }
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  function dismissSuggest() {
    try { localStorage.removeItem(SLEEP_SUGGEST_KEY) } catch { /* ignore */ }
    setSuggest(null)
  }

  return { suggest, dismissSuggest }
}

export function Mental() {
  const sleep = useStore((s) => s.mental.sleep)
  const sleepTarget = useStore((s) => s.mental.sleepTarget)
  const setSleepTarget = useStore((s) => s.setSleepTarget)
  const addSleep = useStore((s) => s.addSleep)
  const [tab, setTab] = useState<Tab>('sleep')

  const last7 = within(sleep, (e) => e.date, 7)
  const avg7 = round(avg(last7.map((e) => e.hours)), 1)
  const lastNight = [...sleep].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const streak = currentStreak(activeDays(sleep, (e) => e.date))

  const { suggest, dismissSuggest } = useSleepAutoDetect()

  // Check if today's sleep is already logged
  const todayAlreadyLogged = sleep.some((e) => e.date === todayKey())

  return (
    <>
      <PageHeader eyebrow="Recovery first" title="Mind" accent={C} />

      {/* Auto-sleep suggestion banner */}
      {suggest?.hours != null && !todayAlreadyLogged && (
        <Card accent={C}>
          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🌙</span>
            <div className="grow">
              <div style={{ fontSize: 13, fontWeight: 700 }}>Sleep detected — ~{suggest.hours}h</div>
              <div className="dim" style={{ fontSize: 11 }}>Based on when you last closed the app. Log it?</div>
            </div>
            <button
              className="btn sm"
              onClick={() => {
                addSleep({ date: suggest.date, hours: suggest.hours! })
                dismissSuggest()
              }}
            >
              Log {suggest.hours}h
            </button>
            <button className="linkbtn" onClick={dismissSuggest} style={{ fontSize: 18 }}>✕</button>
          </div>
        </Card>
      )}

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
            { value: 'dreams', label: 'Dreams' },
          ]}
        />
      </div>

      <div className="stack fadein" key={tab}>
        {tab === 'sleep' && <SleepTab target={sleepTarget} />}
        {tab === 'mood' && <MoodTab />}
        {tab === 'focus' && <FocusTab />}
        {tab === 'dreams' && <DreamsTab />}
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

      <Card>
        <p className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>
          <b>Auto-detect:</b> The app tracks when you stop using it at night and when you return in the morning.
          If the gap looks like sleep (3–14h), you'll see a suggestion above. For full phone screen time,
          check <b>iOS Screen Time</b> or <b>Android Digital Wellbeing</b>.
        </p>
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

  const { todayMins } = useScreenTimeTracker()

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
      {/* Auto-tracked app time */}
      <Card accent={C}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div>
            <div className="dim" style={{ fontSize: 11, fontWeight: 600 }}>Momentum app open today</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {todayMins < 1 ? '<1' : round(todayMins, 0)}
              <span className="dim" style={{ fontSize: 14 }}> min</span>
            </div>
          </div>
          <span className="spacer" />
          <div className="dim" style={{ fontSize: 11, textAlign: 'right', maxWidth: 140, lineHeight: 1.4 }}>
            For full phone screen time, check iOS Screen Time or Android Digital Wellbeing
          </div>
        </div>
      </Card>

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

      <FocusForm open={open} onClose={() => setOpen(false)} onSave={addFocus} defaultScreenMins={Math.round(todayMins)} />
    </>
  )
}

function FocusForm({
  open,
  onClose,
  onSave,
  defaultScreenMins,
}: {
  open: boolean
  onClose: () => void
  onSave: (e: { date: string; screenMinutes?: number; focusBlocks?: number; note?: string }) => void
  defaultScreenMins: number
}) {
  const [screenH, setScreenH] = useState('')
  const [blocks, setBlocks] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Log focus">
      <div className="stack">
        <div className="grid2">
          <Field label="Screen time (hrs)" hint={defaultScreenMins > 0 ? `App tracked ${defaultScreenMins}m today` : undefined}>
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

// ---------------- Dreams ----------------
function DreamsTab() {
  const dreams = useStore((s) => s.mental.dreams)
  const addDream = useStore((s) => s.addDream)
  const updateDream = useStore((s) => s.updateDream)
  const removeDream = useStore((s) => s.removeDream)
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<DreamEntry | null>(null)
  const [editing, setEditing] = useState<DreamEntry | null>(null)
  const [search, setSearch] = useState('')

  const sorted = useMemo(
    () => [...dreams].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [dreams],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q) ||
        (d.tags ?? '').toLowerCase().includes(q) ||
        d.date.includes(q),
    )
  }, [sorted, search])

  return (
    <>
      <Card accent={C}>
        <SectionHeader
          title="Dream catalog"
          sub="Write down and revisit your dreams"
          right={
            <button className="btn sm" onClick={() => setOpen(true)}>
              + Dream
            </button>
          }
        />
        {dreams.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dreams…"
            />
          </div>
        )}
        {dreams.length === 0 ? (
          <Empty icon="🌙" title="No dreams recorded" sub="Write down your dreams while they're fresh — date, story, feeling." />
        ) : filtered.length === 0 ? (
          <p className="dim" style={{ fontSize: 13 }}>No dreams match "{search}".</p>
        ) : (
          <div className="list">
            {filtered.map((d) => (
              <div
                className="item"
                key={d.id}
                style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                onClick={() => setViewing(d)}
              >
                <div className="grow">
                  <div className="t" style={{ fontWeight: 700 }}>
                    {d.lucid && <span style={{ color: C, marginRight: 4 }}>✦</span>}
                    {d.title}
                  </div>
                  <div className="s">
                    {prettyDate(d.date)}
                    {d.mood != null ? ` · ${['😞','😕','😐','🙂','😄'][d.mood - 1]}` : ''}
                    {d.tags ? ` · ${d.tags}` : ''}
                  </div>
                  <div className="s" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                    {d.content.slice(0, 80)}{d.content.length > 80 ? '…' : ''}
                  </div>
                </div>
                <button
                  className="linkbtn danger"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    confirm('Delete this dream?') && removeDream(d.id)
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add dream */}
      <DreamForm
        open={open}
        onClose={() => setOpen(false)}
        onSave={addDream}
      />

      {/* View dream modal */}
      {viewing && (
        <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing.title}>
          <div className="stack">
            <div className="dim" style={{ fontSize: 12 }}>
              {prettyDate(viewing.date)}
              {viewing.lucid ? '  ✦ Lucid' : ''}
              {viewing.mood != null ? `  ·  ${['😞','😕','😐','🙂','😄'][viewing.mood - 1]}` : ''}
            </div>
            {viewing.tags && (
              <div className="dim" style={{ fontSize: 11 }}>Tags: {viewing.tags}</div>
            )}
            <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
              {viewing.content}
            </p>
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <button
                className="btn sm ghost"
                onClick={() => {
                  setEditing(viewing)
                  setViewing(null)
                }}
              >
                Edit
              </button>
              <button
                className="btn sm ghost danger"
                onClick={() => {
                  if (confirm('Delete this dream?')) {
                    removeDream(viewing.id)
                    setViewing(null)
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit dream */}
      {editing && (
        <DreamForm
          open={!!editing}
          onClose={() => setEditing(null)}
          initial={editing}
          onSave={(patch) => {
            updateDream(editing.id, patch)
            setEditing(null)
          }}
          saveLabel="Save changes"
        />
      )}
    </>
  )
}

function DreamForm({
  open,
  onClose,
  onSave,
  initial,
  saveLabel = 'Save dream',
}: {
  open: boolean
  onClose: () => void
  onSave: (e: Omit<DreamEntry, 'id' | 'createdAt'>) => void
  initial?: DreamEntry
  saveLabel?: string
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [date, setDate] = useState(initial?.date ?? todayKey())
  const [lucid, setLucid] = useState(initial?.lucid ?? false)
  const [mood, setMood] = useState<number | undefined>(initial?.mood)
  const [tags, setTags] = useState(initial?.tags ?? '')

  // Reset when modal opens with new initial data
  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '')
      setContent(initial?.content ?? '')
      setDate(initial?.date ?? todayKey())
      setLucid(initial?.lucid ?? false)
      setMood(initial?.mood)
      setTags(initial?.tags ?? '')
    }
  }, [open, initial?.id])

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit dream' : 'Record a dream'}>
      <div className="stack">
        <Field label="Title">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Flying over the city"
            autoFocus
          />
        </Field>
        <Field label="Dream (write it all down)">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe what happened — people, places, feelings, strange details…"
            rows={6}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </Field>
        <div className="grid2">
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Tags (optional)">
            <TextInput value={tags} onChange={(e) => setTags(e.target.value)} placeholder="flying, chase…" />
          </Field>
        </div>
        <Field label="How did it feel?">
          <Rating value={mood ?? 3} onChange={setMood} labels={MOOD_LABELS} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lucid}
            onChange={(e) => setLucid(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Lucid dream (I knew I was dreaming)
        </label>
        <button
          className="btn block"
          onClick={() => {
            if (!title.trim() || !content.trim()) return
            onSave({
              date,
              title: title.trim(),
              content: content.trim(),
              lucid: lucid || undefined,
              mood,
              tags: tags.trim() || undefined,
            })
            setTitle('')
            setContent('')
            setDate(todayKey())
            setLucid(false)
            setMood(undefined)
            setTags('')
            onClose()
          }}
        >
          {saveLabel}
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
