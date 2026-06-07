import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({
  eyebrow,
  title,
  accent,
  right,
}: {
  eyebrow: string
  title: string
  accent: string
  right?: ReactNode
}) {
  return (
    <header className="appbar" style={{ ['--accent' as string]: accent }}>
      <div className="title">
        <span className="eyebrow" style={{ color: accent }}>
          {eyebrow}
        </span>
        <h1>{title}</h1>
      </div>
      <span className="spacer" />
      {right}
      <Link to="/settings" className="iconbtn" aria-label="Settings">
        ⚙
      </Link>
    </header>
  )
}
