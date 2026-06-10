// ============================================================
// Domain types for all four sections. Everything is stored
// locally (see store.ts) and round-trips through JSON export.
// Dates are ISO strings; "day" fields are 'YYYY-MM-DD'.
// ============================================================

export type ID = string

export interface Identified {
  id: ID
  createdAt: string // ISO timestamp — full history is timestamped
}

// ---------- Financial ----------
export interface IncomeEntry extends Identified {
  amount: number // EUR
  source: string
  date: string // YYYY-MM-DD
  note?: string
}

export type ProjectStage = 'idea' | 'building' | 'shipped' | 'monetizing'

export interface HourLog {
  id: ID
  date: string
  hours: number
  note?: string
}

export interface GameProject extends Identified {
  name: string
  stage: ProjectStage
  notes?: string
  hours: HourLog[]
}

export interface Holding extends Identified {
  ticker: string
  name?: string
  quantity: number
  costBasis?: number // total EUR paid (optional)
  buyReason?: string
}

export interface NetPositionSnapshot extends Identified {
  date: string
  amount: number // total net position / savings in EUR
  note?: string
}

export interface FinancialState {
  // income/goalTarget/projects are legacy — kept so old data survives
  // updates and backups round-trip, but no longer shown in the UI.
  income: IncomeEntry[]
  goalTarget: number
  projects: GameProject[]
  holdings: Holding[]
  holdingsCsvUrl?: string // published Google Sheet CSV URL
  netPositions: NetPositionSnapshot[]
  cash?: number // uninvested cash, added to holdings value for net worth
}

// ---------- Educational (IB) ----------
export type SubjectId =
  | 'math-ai-hl'
  | 'physics-sl'
  | 'economics-hl'
  | 'business-hl'
  | 'english-sl'
  | 'french-ab'
  | 'tok'

export interface Subject {
  id: SubjectId
  name: string
  short: string
  level: string // HL / SL / etc.
  target: number // 1–7
  predicted: number // 1–7
}

export interface StudyEntry extends Identified {
  subject: SubjectId
  date: string
  hours: number
  note?: string
}

export interface Deadline extends Identified {
  title: string
  kind: 'IA' | 'EE' | 'TOK' | 'IO' | 'Other'
  date: string // YYYY-MM-DD
  done?: boolean
}

export interface EducationState {
  subjects: Subject[]
  study: StudyEntry[]
  deadlines: Deadline[]
}

// ---------- Physical ----------
export interface WorkoutSession extends Identified {
  date: string
  kind: string // e.g. Push / Pull / Legs / Cardio
  note?: string
}

export interface LiftEntry extends Identified {
  lift: string
  date: string
  weight: number // kg
  reps: number
  sets?: number
}

export interface MeasurementNote extends Identified {
  date: string
  weight?: number // kg, optional
  bodyFat?: number // % body fat, optional
  note: string
}

export interface PhysicalState {
  weeklyTarget: number // target sessions / week
  sessions: WorkoutSession[]
  lifts: LiftEntry[]
  measurements: MeasurementNote[]
}

// ---------- Dreams ----------
export interface DreamEntry extends Identified {
  date: string
  title: string
  content: string
  lucid?: boolean
  mood?: number // 1–5 how dream felt
  tags?: string // comma-separated
}

// ---------- Mental ----------
export interface SleepEntry extends Identified {
  date: string
  hours: number
  note?: string
}

export interface MoodEntry extends Identified {
  date: string
  mood: number // 1–5
  energy: number // 1–5
  note?: string
}

export interface FocusEntry extends Identified {
  date: string
  screenMinutes?: number
  focusBlocks?: number // deep-focus sessions
  note?: string
}

export interface MentalState {
  sleepTarget: number // target hours
  sleep: SleepEntry[]
  moods: MoodEntry[]
  focus: FocusEntry[]
  dreams: DreamEntry[]
}

// ---------- Root ----------
export type ThemePref = 'system' | 'light' | 'dark'

export interface AppData {
  version: number
  financial: FinancialState
  education: EducationState
  physical: PhysicalState
  mental: MentalState
  settings: {
    theme: ThemePref
    currency: string
    finnhubKey?: string // optional API key for live quotes
  }
}
