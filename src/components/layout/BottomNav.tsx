import { NavLink } from 'react-router-dom'
import { SECTIONS } from '../../lib/sections'

export function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Sections">
      {SECTIONS.map((s) => (
        <NavLink
          key={s.key}
          to={s.path}
          end={s.path === '/'}
          className={({ isActive }) => `navitem ${isActive ? 'active' : ''}`}
          style={{ ['--nav-accent' as string]: s.accent }}
        >
          <span className="ic" aria-hidden>
            {s.icon}
          </span>
          {s.label}
        </NavLink>
      ))}
    </nav>
  )
}
