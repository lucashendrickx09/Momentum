import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { Card, SectionHeader, Segmented, Field, Select, TextInput, Pill } from '../../components/ui/primitives'
import { ACCENT } from '../../lib/sections'
import { downloadBackup, parseBackup, readFileText } from '../../lib/backup'
import { notifSupported, requestPermission, hasPermission } from '../../lib/notifications'
import { loadLatestSnapshot } from '../../lib/autobackup'
import type { ThemePref } from '../../store/types'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'TWD', 'JPY']

export function Settings() {
  const navigate = useNavigate()
  const theme = useStore((s) => s.settings.theme)
  const currency = useStore((s) => s.settings.currency)
  const setTheme = useStore((s) => s.setTheme)
  const replaceAll = useStore((s) => s.replaceAll)
  const resetAll = useStore((s) => s.resetAll)
  const setCurrency = (c: string) =>
    useStore.setState((s) => ({ settings: { ...s.settings, currency: c } }))

  const finnhubKey = useStore((s) => s.settings.finnhubKey)
  const setFinnhubKey = useStore((s) => s.setFinnhubKey)
  const [keyDraft, setKeyDraft] = useState(finnhubKey ?? '')

  const notifPrefs = useStore((s) => s.settings.notifications)
  const setNotifications = useStore((s) => s.setNotifications)
  const autoBackup = useStore((s) => s.settings.autoBackup)
  const setAutoBackup = useStore((s) => s.setAutoBackup)
  const [notifPerm, setNotifPerm] = useState<boolean>(hasPermission)
  const [reminderDraft, setReminderDraft] = useState(notifPrefs?.reminderTime ?? '21:00')
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const onImport = async (file: File) => {
    try {
      const data = parseBackup(await readFileText(file))
      if (!confirm('Importing will replace all current data on this device. Continue?')) return
      replaceAll(data)
      setMsg({ ok: true, text: 'Backup restored.' })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
  }

  return (
    <>
      <header className="appbar">
        <div className="title">
          <span className="eyebrow">Preferences</span>
          <h1>Settings</h1>
        </div>
        <span className="spacer" />
        <button className="iconbtn" onClick={() => navigate(-1)} aria-label="Back">
          ✕
        </button>
      </header>

      <div className="stack">
        <Card>
          <SectionHeader title="Appearance" />
          <Field label="Theme">
            <Segmented<ThemePref>
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Currency" hint="Used across the Money section.">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Card>
          <SectionHeader
            title="Live prices"
            sub="Optional — without a key, prices refresh hourly during US market hours."
          />
          <Field
            label="Finnhub API key"
            hint="Free at finnhub.io/register (2 min). With a key set, the Invest page shows real-time quotes that refresh every minute while the app is open."
          >
            <TextInput
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="e.g. c0abcd123…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button
              className="btn sm"
              onClick={() => {
                setFinnhubKey(keyDraft.trim() || undefined)
                setMsg({ ok: true, text: keyDraft.trim() ? 'Live prices enabled.' : 'Live prices disabled.' })
              }}
            >
              Save key
            </button>
            {finnhubKey && <Pill tone="good">● Live quotes on</Pill>}
          </div>
        </Card>

        {/* ---- Notifications ---- */}
        {notifSupported() && (
          <Card>
            <SectionHeader
              title="Notifications"
              sub="Daily check-in reminder and deadline alerts."
            />
            <div className="stack" style={{ gap: 14 }}>
              <div className="row" style={{ gap: 12 }}>
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Daily reminder</div>
                  <div className="dim" style={{ fontSize: 12 }}>Reminds you to complete your daily check-in</div>
                </div>
                <button
                  className={`btn sm ${notifPrefs?.enabled ? '' : 'ghost'}`}
                  onClick={async () => {
                    if (!notifPerm) {
                      const granted = await requestPermission()
                      setNotifPerm(granted)
                      if (!granted) { setMsg({ ok: false, text: 'Permission denied. Enable notifications in browser settings.' }); return }
                    }
                    const current = notifPrefs ?? { enabled: false, reminderTime: reminderDraft, deadlineAlerts: true }
                    setNotifications({ ...current, enabled: !current.enabled, reminderTime: reminderDraft })
                    setMsg({ ok: true, text: !current.enabled ? 'Reminder enabled.' : 'Reminder disabled.' })
                  }}
                >
                  {notifPrefs?.enabled ? '● On' : 'Off'}
                </button>
              </div>
              {notifPrefs?.enabled && (
                <Field label="Reminder time">
                  <input
                    type="time"
                    className="input"
                    value={reminderDraft}
                    onChange={(e) => {
                      setReminderDraft(e.target.value)
                      if (notifPrefs) setNotifications({ ...notifPrefs, reminderTime: e.target.value })
                    }}
                  />
                </Field>
              )}
              <div className="row" style={{ gap: 12 }}>
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Deadline alerts</div>
                  <div className="dim" style={{ fontSize: 12 }}>Alert when a deadline is within 3 days</div>
                </div>
                <button
                  className={`btn sm ${notifPrefs?.deadlineAlerts ? '' : 'ghost'}`}
                  onClick={async () => {
                    if (!notifPerm) {
                      const granted = await requestPermission()
                      setNotifPerm(granted)
                      if (!granted) return
                    }
                    const current = notifPrefs ?? { enabled: true, reminderTime: reminderDraft, deadlineAlerts: false }
                    setNotifications({ ...current, deadlineAlerts: !current.deadlineAlerts })
                  }}
                >
                  {notifPrefs?.deadlineAlerts ? '● On' : 'Off'}
                </button>
              </div>
              {!notifPerm && (
                <div className="dim" style={{ fontSize: 12 }}>
                  ℹ Browser permission required — tap a toggle above to prompt for access.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ---- Auto-backup ---- */}
        <Card>
          <SectionHeader title="Auto-backup" sub="Silently saves a snapshot to your browser every 7 days." />
          <div className="stack" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 12 }}>
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 14 }}>Enable auto-backup</div>
                <div className="dim" style={{ fontSize: 12 }}>Stores a local copy in your browser — survives app updates</div>
              </div>
              <button
                className={`btn sm ${autoBackup ? '' : 'ghost'}`}
                onClick={() => setAutoBackup(!autoBackup)}
              >
                {autoBackup ? '● On' : 'Off'}
              </button>
            </div>
            <button
              className="btn sm ghost"
              onClick={async () => {
                const snap = await loadLatestSnapshot()
                setLastAutoBackup(snap ? snap.savedAt : null)
                setMsg(snap
                  ? { ok: true, text: `Latest auto-save: ${new Date(snap.savedAt).toLocaleDateString()} — your data is safe.` }
                  : { ok: false, text: 'No auto-save found yet. Enable auto-backup and it will save on next app open.' })
              }}
            >
              Check last auto-save
            </button>
            {lastAutoBackup && (
              <div className="dim" style={{ fontSize: 12 }}>Last save: {new Date(lastAutoBackup).toLocaleString()}</div>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Backup & restore" sub="Your data never leaves the device unless you export it." />
          <div className="stack">
            <button className="btn block" onClick={downloadBackup} style={{ ['--accent' as string]: ACCENT.financial }}>
              ⬇ Export backup (.json)
            </button>
            <button className="btn ghost block" onClick={() => fileRef.current?.click()}>
              ⬆ Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImport(f)
                e.target.value = ''
              }}
            />
            {msg && (
              <div style={{ fontSize: 13 }}>
                <Pill tone={msg.ok ? 'good' : 'danger'}>{msg.ok ? 'OK' : 'Error'}</Pill>{' '}
                <span className="muted">{msg.text}</span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Danger zone" />
          <button
            className="btn danger block"
            onClick={() => {
              if (confirm('Erase ALL data on this device? Export a backup first if unsure.')) {
                resetAll()
                setMsg({ ok: true, text: 'All data cleared.' })
              }
            }}
          >
            Reset everything
          </button>
        </Card>

        <Card>
          <SectionHeader title="About" />
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <b>Momentum</b> — a private, offline-first tracker for investing, IB studies, training and
            wellbeing. Install it to your home screen for an app-like experience. All personal data
            stays on this device; only market prices are fetched from the network.
          </p>
        </Card>
      </div>
    </>
  )
}
