import { useState, useEffect, useRef, type ReactNode, createElement } from 'react'

// Smooth count-up from current displayed value to `target`.
// On first render: 0 → target. On subsequent changes: old → new.
export function useCountUp(target: number, duration = 1300): number {
  const displayedRef = useRef(0)
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = displayedRef.current
    startRef.current = null
    cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now
      const t = Math.min((now - startRef.current) / duration, 1)
      const eased = 1 - (1 - t) ** 4
      const v = fromRef.current + (target - fromRef.current) * eased
      displayedRef.current = v
      setDisplayed(v)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return displayed
}

// Fade + rise on scroll. Already-visible elements appear immediately.
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }

    // Already in viewport → show immediately, no animation.
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.98) { setVisible(true); return }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) { setVisible(true); obs.disconnect() }
      },
      { threshold: 0.04 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return createElement(
    'div',
    {
      ref,
      className: `reveal-wrap${visible ? ' revealed' : ''}${className ? ` ${className}` : ''}`,
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  )
}
