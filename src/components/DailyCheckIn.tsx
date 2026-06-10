import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { Card } from './ui/primitives'
import { todayKey } from '../lib/dates'
import { ACCENT } from '../lib/sections'
import type { SubjectId } from '../store/types'

// One card, four quick logs: sleep, mood/energy, workout, study.
// Each row shows ✓ when today is already logged; tapping an unlogged row
// expands inline one-tap controls — no modals, no navigation.

const MOOD_LABELS = ['😞', '😕', '😐', '🙂', '😄']
const ENERGY_LABELS = ['🪫', '🔅', '🔆', '⚡', '🚀']
const SLEEP_CHIPS = [6, 6.5, 7, 7.5, 8, 8.5, 9]
const WORKOUT_KINDS = ['Push', 'Pull', 'Legs', 'Upper', 'Cardio']
const STUDY_HOURS = [0.5, 1, 1.5, 2, 3]

type RowKey = 'sleep' | 'mood' | 'workout' | 'study'

export function DailyCheckIn() {
  const today = todayKey()
  const sleep = useStore((s) => s.mental.sleep)
  const moods = useStore((s) => s.mental.moods)
  const sessions = useStore((s) => s.physical.sessions)
  const study = useStore((s) => s.education.study)
  const subjects = useStore((s) => s.education.subjects)
  const addSleep = useStore((s) => s.addSleep)
  const addMood = useStore((s) => s.addMood)
  const addSession = useStore((s) => s.addSession)
  const addStudy = useStore((s) => s.addStudy)

  const done: Record<RowKey, boolean> = useMemo(
    () => ({
      sleep: sleep.some((e) => e.date === today),
      mood: moods.some((e) => e.date === today),
      workout: sessions.some((e) => e.date === today),
      study: study.some((e) => e.date === today),
    }),
    [sleep, moods, sessions, study, today],
  )

  const [open, setOpen] = useState<RowKey | null>(null)
  const [moodVal, setMoodVal] = useState<number | null>(null)
  const [studySubject, setStudySubject] = useState<SubjectId | null>(null)

  const doneCount = Object.values(done).filter(Boolean).length
  const allDone = doneCount === 4

  const toggle = (k: RowKey) => setOpen(open === k ? null : k)

  return (
    <Card className={allDone ? 'checkin done' : 'checkin'}>
      <div className="row" style={{ alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Daily check-in</div>
          <div className="dim" style={{ fontSize: 11.5 }}>
            {allDone ? 'All done today 🎉' : `${doneCount}/4 logged · tap to fill in`}
          </div>
        </div>
        <span className="spacer" />
        <div className="checkin-dots">
          {(['sleep', 'mood', 'workout', 'study'] as RowKey[]).map((k) => (
            <span key={k} className={done[k] ? 'dot on' : 'dot'} />
          ))}
        </div>
      </div>

      <div className="checkin-rows">
        {/* ---- Sleep ---- */}
        <CheckRow
          icon="😴"
          label="Sleep"
          accent={ACCENT.mental}
          done={done.sleep}
          open={open === 'sleep'}
          onTap={() => !done.sleep && toggle('sleep')}
        >
          <div className="chips">
            {SLEEP_CHIPS.map((h) => (
              <button
                key={h}
                className="chip"
                onClick={() => {
                  addSleep({ date: today, hours: h })
                  setOpen(null)
                }}
              >
                {h}h
              </button>
            ))}
          </div>
        </CheckRow>

        {/* ---- Mood + energy ---- */}
        <CheckRow
          icon="🌤️"
          label="Mood"
          accent={ACCENT.mental}
          done={done.mood}
          open={open === 'mood'}
          onTap={() => !done.mood && toggle('mood')}
        >
          <div className="dim" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            {moodVal == null ? 'How do you feel?' : 'And your energy?'}
          </div>
          <div className="chips">
            {(moodVal == null ? MOOD_LABELS : ENERGY_LABELS).map((emoji, i) => (
              <button
                key={emoji}
                className="chip emoji"
                onClick={() => {
                  if (moodVal == null) {
                    setMoodVal(i + 1)
                  } else {
                    addMood({ date: today, mood: moodVal, energy: i + 1 })
                    setMoodVal(null)
                    setOpen(null)
                  }
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </CheckRow>

        {/* ---- Workout ---- */}
        <CheckRow
          icon="🏋️"
          label="Workout"
          accent={ACCENT.physical}
          done={done.workout}
          open={open === 'workout'}
          onTap={() => !done.workout && toggle('workout')}
        >
          <div className="chips">
            {WORKOUT_KINDS.map((k) => (
              <button
                key={k}
                className="chip"
                onClick={() => {
                  addSession({ date: today, kind: k })
                  setOpen(null)
                }}
              >
                {k}
              </button>
            ))}
            <button className="chip" onClick={() => setOpen(null)}>
              Rest day
            </button>
          </div>
        </CheckRow>

        {/* ---- Study ---- */}
        <CheckRow
          icon="📚"
          label="Study"
          accent={ACCENT.education}
          done={done.study}
          open={open === 'study'}
          onTap={() => !done.study && toggle('study')}
        >
          {studySubject == null ? (
            <div className="chips">
              {subjects.map((s) => (
                <button key={s.id} className="chip" onClick={() => setStudySubject(s.id)}>
                  {s.short}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="dim" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                {subjects.find((s) => s.id === studySubject)?.name} — how long?
              </div>
              <div className="chips">
                {STUDY_HOURS.map((h) => (
                  <button
                    key={h}
                    className="chip"
                    onClick={() => {
                      addStudy({ subject: studySubject, date: today, hours: h })
                      setStudySubject(null)
                      setOpen(null)
                    }}
                  >
                    {h}h
                  </button>
                ))}
                <button className="chip" onClick={() => setStudySubject(null)}>
                  ‹ back
                </button>
              </div>
            </>
          )}
        </CheckRow>
      </div>
    </Card>
  )
}

function CheckRow({
  icon,
  label,
  accent,
  done,
  open,
  onTap,
  children,
}: {
  icon: string
  label: string
  accent: string
  done: boolean
  open: boolean
  onTap: () => void
  children: React.ReactNode
}) {
  return (
    <div className="checkrow-wrap">
      <button className={`checkrow ${done ? 'done' : ''}`} onClick={onTap}>
        <span className="ci">{icon}</span>
        <span className="cl">{label}</span>
        <span className="spacer" />
        {done ? (
          <span className="ck" style={{ color: accent }}>
            ✓
          </span>
        ) : (
          <span className="dim" style={{ fontSize: 16, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
            ›
          </span>
        )}
      </button>
      {open && !done && <div className="checkrow-body fadein">{children}</div>}
    </div>
  )
}
