import { useEffect, useRef, useState } from 'react'

interface Options {
  /** Duration of the count-up in ms. */
  duration?: number
  /** Don't start until this is true (e.g. when the row becomes visible). */
  enabled?: boolean
  /** Optional starting value (default 0). */
  from?: number
}

/**
 * Smoothly animates a number from `from` to `to` once `enabled` flips true.
 * Uses requestAnimationFrame and an ease-out curve for a classic "count up" feel.
 * Respects prefers-reduced-motion (snaps to the final value).
 */
export function useCountUp(to: number, { duration = 1200, enabled = true, from = 0 }: Options = {}) {
  const [value, setValue] = useState(from)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setValue(to)
      return
    }

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      startRef.current = null
    }
  }, [to, duration, enabled, from])

  return value
}
