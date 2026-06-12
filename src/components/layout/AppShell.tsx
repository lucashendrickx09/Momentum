import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { useStore } from '../../store/store'
import { recordHidden, detectSleepGap, markAutoLogged, dismissSleepGap, type SleepGap } from '../../lib/sleepDetect'

export function AppShell() {
  const theme    = useStore((s) => s.settings.theme)
  const { pathname } = useLocation()
  const addSleep = useStore((s) => s.addSleep)
  const sleep    = useStore((s) => s.mental.sleep)

  const [sleepPrompt, setSleepPrompt] = useState<SleepGap | null>(null)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Visibility-based sleep detection.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        recordHidden()
        setSleepPrompt(null)
      } else {
        const gap = detectSleepGap()
        if (gap) setSleepPrompt(gap)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    // Also check immediately on first mount (cold open after sleeping).
    const gap = detectSleepGap()
    if (gap) setSleepPrompt(gap)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alreadyLoggedToday = sleepPrompt
    ? sleep.some((e) => e.date === sleepPrompt.sleepDate)
    : false

  const handleLog = () => {
    if (!sleepPrompt) return
    addSleep({ date: sleepPrompt.sleepDate, hours: sleepPrompt.hours, note: 'Auto-detected' })
    markAutoLogged()
    setSleepPrompt(null)
  }

  const handleDismiss = () => {
    dismissSleepGap()
    setSleepPrompt(null)
  }

  return (
    <div className="app">
      {sleepPrompt && !alreadyLoggedToday && (
        <div className="sleep-banner">
          <span className="sleep-banner-ic">☾</span>
          <div className="sleep-banner-body">
            <span className="sleep-banner-main">
              Slept ~{sleepPrompt.hours}h
            </span>
            <span className="sleep-banner-sub">
              {sleepPrompt.hiddenAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {sleepPrompt.wokeAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button className="btn sm" onClick={handleLog}>
            Log it
          </button>
          <button className="linkbtn" onClick={handleDismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      <Outlet />
      <BottomNav />
    </div>
  )
}
