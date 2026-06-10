// Auto-backup helpers.
// Strategy:
//   1. Save a JSON snapshot to IndexedDB every 7 days (silent, in-browser fallback).
//   2. Provide a one-click export trigger so callers can auto-prompt a file download.

import type { AppData } from '../store/types'
import { exportData } from '../store/store'
import { todayKey } from './dates'

const DB_NAME = 'momentum-autobackup'
const STORE_NAME = 'snapshots'
const AUTO_KEY = 'momentum-auto-backup-date'
const AUTO_INTERVAL_DAYS = 7

// ---- IndexedDB helpers ----

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveSnapshotToDB(data: AppData): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ data, savedAt: new Date().toISOString() }, 'latest')
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    localStorage.setItem(AUTO_KEY, todayKey())
  } catch { /* non-critical */ }
}

export async function loadLatestSnapshot(): Promise<{ data: AppData; savedAt: string } | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get('latest')
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

// ---- Auto-save check (call once on app open) ----

export function shouldAutoSave(): boolean {
  const last = localStorage.getItem(AUTO_KEY)
  if (!last) return true
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
  return days >= AUTO_INTERVAL_DAYS
}

export async function autoSaveIfDue(): Promise<boolean> {
  if (!shouldAutoSave()) return false
  const data = exportData()
  await saveSnapshotToDB(data)
  return true
}

// ---- File download (requires user gesture when called from a click handler) ----

export function downloadBackupFile() {
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
  try { localStorage.setItem('momentum-last-backup', new Date().toISOString()) } catch { /* ignore */ }
}
