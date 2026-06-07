export interface SectionMeta {
  key: string
  path: string
  label: string
  icon: string
  accent: string
}

export const SECTIONS: SectionMeta[] = [
  { key: 'dashboard', path: '/', label: 'Home', icon: '◎', accent: '#19c3c3' },
  { key: 'financial', path: '/financial', label: 'Money', icon: '€', accent: '#18b97a' },
  { key: 'education', path: '/education', label: 'Study', icon: '✎', accent: '#4f8cff' },
  { key: 'physical', path: '/physical', label: 'Body', icon: '⚡', accent: '#ff8a3d' },
  { key: 'mental', path: '/mental', label: 'Mind', icon: '☾', accent: '#a07bff' },
]

export const ACCENT = {
  dashboard: '#19c3c3',
  financial: '#18b97a',
  education: '#4f8cff',
  physical: '#ff8a3d',
  mental: '#a07bff',
}
