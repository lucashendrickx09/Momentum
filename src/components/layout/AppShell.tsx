import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useStore } from '../../store/store'

export function AppShell() {
  const theme = useStore((s) => s.settings.theme)
  const { pathname } = useLocation()
  const [scrollPct, setScrollPct] = useState(0)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    window.scrollTo(0, 0)
    setScrollPct(0)
  }, [pathname])

  useEffect(() => {
    const update = () => {
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      setScrollPct(max > 0 ? el.scrollTop / max : 0)
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <div className="app">
      <div className="scroll-track" aria-hidden="true">
        <div className="scroll-fill" style={{ height: `${scrollPct * 100}%` }} />
      </div>
      <Outlet />
      <BottomNav />
    </div>
  )
}
