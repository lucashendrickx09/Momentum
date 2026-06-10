import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useStore } from '../../store/store'

export function AppShell() {
  const theme = useStore((s) => s.settings.theme)
  const { pathname } = useLocation()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <Outlet />
      <BottomNav />
    </div>
  )
}
