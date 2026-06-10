import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/store'
import { Card, SectionHeader, Segmented, Field, Select, TextInput, Pill } from '../../components/ui/primitives'
import { ACCENT } from '../../lib/sections'
import { downloadBackup, parseBackup, readFileText } from '../../lib/backup'
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
