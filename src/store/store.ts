import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppData,
  IncomeEntry,
  GameProject,
  ProjectStage,
  Holding,
  NetPositionSnapshot,
  StudyEntry,
  Deadline,
  Subject,
  SubjectId,
  WorkoutSession,
  LiftEntry,
  MeasurementNote,
  SleepEntry,
  MoodEntry,
  FocusEntry,
  DreamEntry,
  ThemePref,
} from './types'
import { emptyData, DATA_VERSION, IB_SUBJECTS } from './defaults'
import { uid, nowISO } from '../lib/id'

type New<T> = Omit<T, 'id' | 'createdAt'>

interface Actions {
  // financial — income
  addIncome(e: New<IncomeEntry>): void
  removeIncome(id: string): void
  setGoalTarget(v: number): void
  // financial — projects
  addProject(name: string, stage: ProjectStage, notes?: string): void
  updateProject(id: string, patch: Partial<GameProject>): void
  removeProject(id: string): void
  logProjectHours(id: string, date: string, hours: number, note?: string): void
  // financial — holdings
  addHolding(h: New<Holding>): void
  updateHolding(id: string, patch: Partial<Holding>): void
  removeHolding(id: string): void
  replaceHoldings(list: New<Holding>[]): void
  setHoldingsCsvUrl(url?: string): void
  // financial — net position
  addNetPosition(s: New<NetPositionSnapshot>): void
  removeNetPosition(id: string): void

  // education
  updateSubject(id: SubjectId, patch: Partial<Subject>): void
  addStudy(e: New<StudyEntry>): void
  removeStudy(id: string): void
  addDeadline(d: New<Deadline>): void
  updateDeadline(id: string, patch: Partial<Deadline>): void
  removeDeadline(id: string): void

  // physical
  setWeeklyTarget(v: number): void
  addSession(e: New<WorkoutSession>): void
  removeSession(id: string): void
  addLift(e: New<LiftEntry>): void
  removeLift(id: string): void
  addMeasurement(e: New<MeasurementNote>): void
  removeMeasurement(id: string): void

  // mental
  setSleepTarget(v: number): void
  addSleep(e: New<SleepEntry>): void
  removeSleep(id: string): void
  addMood(e: New<MoodEntry>): void
  removeMood(id: string): void
  addFocus(e: New<FocusEntry>): void
  removeFocus(id: string): void
  addDream(e: New<DreamEntry>): void
  updateDream(id: string, patch: Partial<DreamEntry>): void
  removeDream(id: string): void

  // settings + data
  setTheme(t: ThemePref): void
  setFinnhubKey(k?: string): void
  setCash(v?: number): void
  replaceAll(data: AppData): void
  resetAll(): void
}

export type Store = AppData & Actions

const stamp = <T>(e: T) => ({ ...e, id: uid(), createdAt: nowISO() })
const byDateDesc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : -1)

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...emptyData(),

      // ---------- income ----------
      addIncome: (e) =>
        set((s) => ({
          financial: { ...s.financial, income: [stamp(e), ...s.financial.income] },
        })),
      removeIncome: (id) =>
        set((s) => ({
          financial: { ...s.financial, income: s.financial.income.filter((x) => x.id !== id) },
        })),
      setGoalTarget: (v) =>
        set((s) => ({ financial: { ...s.financial, goalTarget: v } })),

      // ---------- projects ----------
      addProject: (name, stage, notes) =>
        set((s) => ({
          financial: {
            ...s.financial,
            projects: [stamp({ name, stage, notes, hours: [] }), ...s.financial.projects],
          },
        })),
      updateProject: (id, patch) =>
        set((s) => ({
          financial: {
            ...s.financial,
            projects: s.financial.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          },
        })),
      removeProject: (id) =>
        set((s) => ({
          financial: { ...s.financial, projects: s.financial.projects.filter((p) => p.id !== id) },
        })),
      logProjectHours: (id, date, hours, note) =>
        set((s) => ({
          financial: {
            ...s.financial,
            projects: s.financial.projects.map((p) =>
              p.id === id
                ? { ...p, hours: [{ id: uid(), date, hours, note }, ...p.hours] }
                : p,
            ),
          },
        })),

      // ---------- holdings ----------
      addHolding: (h) =>
        set((s) => ({
          financial: { ...s.financial, holdings: [stamp(h), ...s.financial.holdings] },
        })),
      updateHolding: (id, patch) =>
        set((s) => ({
          financial: {
            ...s.financial,
            holdings: s.financial.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)),
          },
        })),
      removeHolding: (id) =>
        set((s) => ({
          financial: { ...s.financial, holdings: s.financial.holdings.filter((h) => h.id !== id) },
        })),
      replaceHoldings: (list) =>
        set((s) => {
          // Preserve existing buy-reason notes when re-importing by ticker.
          const reasons = new Map(
            s.financial.holdings.map((h) => [h.ticker.toUpperCase(), h.buyReason]),
          )
          return {
            financial: {
              ...s.financial,
              holdings: list.map((h) => ({
                ...stamp(h),
                buyReason: h.buyReason ?? reasons.get(h.ticker.toUpperCase()),
              })),
            },
          }
        }),
      setHoldingsCsvUrl: (url) =>
        set((s) => ({ financial: { ...s.financial, holdingsCsvUrl: url } })),

      // ---------- net position ----------
      addNetPosition: (e) =>
        set((s) => ({
          financial: {
            ...s.financial,
            netPositions: [stamp(e), ...s.financial.netPositions].sort(byDateDesc),
          },
        })),
      removeNetPosition: (id) =>
        set((s) => ({
          financial: {
            ...s.financial,
            netPositions: s.financial.netPositions.filter((x) => x.id !== id),
          },
        })),

      // ---------- education ----------
      updateSubject: (id, patch) =>
        set((s) => ({
          education: {
            ...s.education,
            subjects: s.education.subjects.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          },
        })),
      addStudy: (e) =>
        set((s) => ({ education: { ...s.education, study: [stamp(e), ...s.education.study] } })),
      removeStudy: (id) =>
        set((s) => ({
          education: { ...s.education, study: s.education.study.filter((x) => x.id !== id) },
        })),
      addDeadline: (d) =>
        set((s) => ({
          education: {
            ...s.education,
            deadlines: [stamp(d), ...s.education.deadlines].sort(byDateDesc),
          },
        })),
      updateDeadline: (id, patch) =>
        set((s) => ({
          education: {
            ...s.education,
            deadlines: s.education.deadlines.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          },
        })),
      removeDeadline: (id) =>
        set((s) => ({
          education: { ...s.education, deadlines: s.education.deadlines.filter((x) => x.id !== id) },
        })),

      // ---------- physical ----------
      setWeeklyTarget: (v) => set((s) => ({ physical: { ...s.physical, weeklyTarget: v } })),
      addSession: (e) =>
        set((s) => ({ physical: { ...s.physical, sessions: [stamp(e), ...s.physical.sessions] } })),
      removeSession: (id) =>
        set((s) => ({
          physical: { ...s.physical, sessions: s.physical.sessions.filter((x) => x.id !== id) },
        })),
      addLift: (e) =>
        set((s) => ({ physical: { ...s.physical, lifts: [stamp(e), ...s.physical.lifts] } })),
      removeLift: (id) =>
        set((s) => ({
          physical: { ...s.physical, lifts: s.physical.lifts.filter((x) => x.id !== id) },
        })),
      addMeasurement: (e) =>
        set((s) => ({
          physical: { ...s.physical, measurements: [stamp(e), ...s.physical.measurements] },
        })),
      removeMeasurement: (id) =>
        set((s) => ({
          physical: {
            ...s.physical,
            measurements: s.physical.measurements.filter((x) => x.id !== id),
          },
        })),

      // ---------- mental ----------
      setSleepTarget: (v) => set((s) => ({ mental: { ...s.mental, sleepTarget: v } })),
      addSleep: (e) =>
        set((s) => ({ mental: { ...s.mental, sleep: [stamp(e), ...s.mental.sleep] } })),
      removeSleep: (id) =>
        set((s) => ({ mental: { ...s.mental, sleep: s.mental.sleep.filter((x) => x.id !== id) } })),
      addMood: (e) =>
        set((s) => ({ mental: { ...s.mental, moods: [stamp(e), ...s.mental.moods] } })),
      removeMood: (id) =>
        set((s) => ({ mental: { ...s.mental, moods: s.mental.moods.filter((x) => x.id !== id) } })),
      addFocus: (e) =>
        set((s) => ({ mental: { ...s.mental, focus: [stamp(e), ...s.mental.focus] } })),
      removeFocus: (id) =>
        set((s) => ({ mental: { ...s.mental, focus: s.mental.focus.filter((x) => x.id !== id) } })),
      addDream: (e) =>
        set((s) => ({ mental: { ...s.mental, dreams: [stamp(e), ...s.mental.dreams] } })),
      updateDream: (id, patch) =>
        set((s) => ({
          mental: {
            ...s.mental,
            dreams: s.mental.dreams.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          },
        })),
      removeDream: (id) =>
        set((s) => ({ mental: { ...s.mental, dreams: s.mental.dreams.filter((x) => x.id !== id) } })),

      // ---------- settings + data ----------
      setTheme: (t) => set((s) => ({ settings: { ...s.settings, theme: t } })),
      setFinnhubKey: (k) => set((s) => ({ settings: { ...s.settings, finnhubKey: k } })),
      setCash: (v) => set((s) => ({ financial: { ...s.financial, cash: v } })),
      replaceAll: (data) => set(() => ({ ...data })),
      resetAll: () => set(() => ({ ...emptyData() })),
    }),
    {
      name: 'momentum-data',
      version: DATA_VERSION,
      partialize: (s) => ({
        version: s.version,
        financial: s.financial,
        education: s.education,
        physical: s.physical,
        mental: s.mental,
        settings: s.settings,
      }),
      merge: (persisted, current) => {
        // Deep-ish merge so newly added fields/subjects survive upgrades.
        const p = (persisted ?? {}) as Partial<AppData>
        const base = emptyData()
        const subjects = p.education?.subjects?.length
          ? IB_SUBJECTS.map((def) => {
              const saved = p.education!.subjects.find((x) => x.id === def.id)
              return saved ? { ...def, ...saved } : def
            })
          : base.education.subjects
        return {
          ...current,
          ...base,
          ...p,
          financial: { ...base.financial, ...p.financial },
          education: { ...base.education, ...p.education, subjects },
          physical: { ...base.physical, ...p.physical },
          mental: { ...base.mental, ...p.mental },
          settings: { ...base.settings, ...p.settings },
        } as Store
      },
    },
  ),
)

export function exportData(): AppData {
  const s = useStore.getState()
  return {
    version: s.version,
    financial: s.financial,
    education: s.education,
    physical: s.physical,
    mental: s.mental,
    settings: s.settings,
  }
}
