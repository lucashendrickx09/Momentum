import type { AppData } from '../store/types'
import { exportData } from '../store/store'
import { DATA_VERSION } from '../store/defaults'
import { todayKey } from './dates'

export function downloadBackup() {
  const data = exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `momentum-backup-${todayKey()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function parseBackup(text: string): AppData {
  const data = JSON.parse(text) as AppData
  if (typeof data !== 'object' || data === null) throw new Error('Not a valid backup file.')
  if (!('financial' in data) || !('education' in data)) {
    throw new Error('This file does not look like a Momentum backup.')
  }
  if (typeof data.version !== 'number') data.version = DATA_VERSION
  return data
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}
