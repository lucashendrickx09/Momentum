import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function SectionHeader({
  title,
  sub,
  right,
}: {
  title: string
  sub?: string
  right?: ReactNode
}) {
  return (
    <div className="section-head">
      <span className="dot" />
      <div>
        <h2>{title}</h2>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <span className="spacer" />
      {right}
    </div>
  )
}

export function Card({
  children,
  className = '',
  accent,
}: {
  children: ReactNode
  className?: string
  accent?: string
}) {
  return (
    <div className={`card ${className}`} style={accent ? { ['--accent' as string]: accent } : undefined}>
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  unit,
  foot,
  accent = false,
}: {
  label: string
  value: ReactNode
  unit?: string
  foot?: ReactNode
  accent?: boolean
}) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {foot != null && <div className="foot">{foot}</div>}
    </div>
  )
}

export function Bar({ pct, tall = false }: { pct: number; tall?: boolean }) {
  const p = Math.max(0, Math.min(100, pct))
  return (
    <div className={`bar ${tall ? 'tall' : ''}`}>
      <span style={{ ['--p' as string]: `${p}%` }} />
    </div>
  )
}

export function Pill({
  children,
  tone,
}: {
  children: ReactNode
  tone?: 'good' | 'warn' | 'danger' | 'gray'
}) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>
}

export function Empty({ icon = '✨', title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <div className="t">{title}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          role="tab"
          aria-selected={o.value === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />
}

export function Rating({
  value,
  onChange,
  labels,
}: {
  value: number
  onChange: (v: number) => void
  labels?: string[]
}) {
  return (
    <div className="chips">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`chip ${value === n ? 'on' : ''}`}
          onClick={() => onChange(n)}
        >
          {labels ? labels[n - 1] : n}
        </button>
      ))}
    </div>
  )
}
