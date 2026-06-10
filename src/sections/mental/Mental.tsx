import { useEffect, useMemo, useState } from 'react'
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
import { TrendArea } from '../../components/charts/Charts'
import { avg, round, dailySeries, within, activeDays, currentStreak } from '../../lib/stats'
import { todayKey, relativeDay, prettyDate } from '../../lib/dates'
import { ACCENT } from '../../lib/sections'
import type { DreamEntry } from '../../store/types'

type Tab = 'sleep' | 'mood' | 'dreams'
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
            { value: 'dreams', label: 'Dreams' },
          ]}
        />
      </div>

      <div className="stack fadein" key={tab}>
        {tab === 'sleep' && <SleepTab target={sleepTarget} />}
        {tab === 'mood' && <MoodTab />}
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
          <Empty icon="😴" title="No sleep logged" sub="Log each morning from the daily check-in on Home — this is the keystone metric." />
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
  const removeMood = useStore((s) => s.removeMood)

  const moodSeries = useMemo(() => seriesFromAvg(moods, (e) => e.mood), [moods])
  const energySeries = useMemo(() => seriesFromAvg(moods, (e) => e.energy), [moods])
  const last7 = within(moods, (e) => e.date, 7)

  return (
    <>
      <Card accent={C}>
        <SectionHeader title="Mood & energy" sub="Logged from the daily check-in on Home" />
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
          <Empty icon="🌤️" title="No mood logged" sub="Use the daily check-in on the Home screen — two taps a day." />
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
    </>
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
                    {d.mood != null ? ` · ${MOOD_LABELS[d.mood - 1]}` : ''}
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
              {viewing.mood != null ? `  ·  ${MOOD_LABELS[viewing.mood - 1]}` : ''}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            className="input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe what happened — people, places, feelings, strange details…"
            rows={6}
            style={{ lineHeight: 1.6 }}
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
