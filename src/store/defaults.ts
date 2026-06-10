import type { AppData, Subject } from './types'

export const DATA_VERSION = 1

export const IB_SUBJECTS: Subject[] = [
  { id: 'math-ai-hl', name: 'Math AI', short: 'Math AI', level: 'HL', target: 6, predicted: 5 },
  { id: 'physics-sl', name: 'Physics', short: 'Physics', level: 'SL', target: 6, predicted: 5 },
  { id: 'economics-hl', name: 'Economics', short: 'Econ', level: 'HL', target: 6, predicted: 5 },
  { id: 'business-hl', name: 'Business Management', short: 'Business', level: 'HL', target: 6, predicted: 5 },
  { id: 'english-sl', name: 'English Lang & Lit', short: 'English', level: 'SL', target: 6, predicted: 5 },
  { id: 'french-ab', name: 'French ab initio', short: 'French', level: 'SL', target: 6, predicted: 5 },
  { id: 'tok', name: 'Theory of Knowledge', short: 'TOK', level: 'Core', target: 3, predicted: 2 },
]

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    financial: {
      income: [],
      goalTarget: 500,
      projects: [],
      holdings: [],
      holdingsCsvUrl: undefined,
      netPositions: [],
    },
    education: {
      subjects: IB_SUBJECTS.map((s) => ({ ...s })),
      study: [],
      deadlines: [],
    },
    physical: {
      weeklyTarget: 4,
      sessions: [],
      lifts: [],
      measurements: [],
    },
    mental: {
      sleepTarget: 8,
      sleep: [],
      moods: [],
      focus: [],
      dreams: [],
    },
    settings: {
      theme: 'system',
      currency: 'EUR',
    },
  }
}
