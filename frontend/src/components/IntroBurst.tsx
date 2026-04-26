import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'vrush-intro-seen'
const INTRO_RUNTIME_KEY = 'vrush-intro-running'
const TOTAL_MS = 2400

/** Read prefers-reduced-motion in a way that's safe during SSR. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Full-screen "logo explodes into the landing page" intro.
 * Plays on the user's first visit (`localStorage` flag), can be replayed with `?intro=1`,
 * respects `prefers-reduced-motion`, and is always skippable.
 */
export function IntroBurst() {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const force = params.get('intro') === '1'
    const inRuntime = (() => {
      try {
        return window.sessionStorage.getItem(INTRO_RUNTIME_KEY) === '1'
      } catch {
        return false
      }
    })()
    if (inRuntime && !force) return
    const seen = (() => {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === '1'
      } catch {
        return false
      }
    })()
    if (seen && !force) return
    if (prefersReducedMotion() && !force) {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        // ignore storage errors (private mode, etc)
      }
      return
    }
    const t0 = window.setTimeout(() => setVisible(true), 0)
    try {
      window.sessionStorage.setItem(INTRO_RUNTIME_KEY, '1')
    } catch {
      // ignore
    }
    const t1 = window.setTimeout(() => setLeaving(true), TOTAL_MS - 450)
    const t2 = window.setTimeout(() => {
      setVisible(false)
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
        window.sessionStorage.removeItem(INTRO_RUNTIME_KEY)
      } catch {
        // ignore
      }
    }, TOTAL_MS)
    timers.current.push(t0, t1, t2)
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current = []
      try {
        window.sessionStorage.removeItem(INTRO_RUNTIME_KEY)
      } catch {
        // ignore
      }
    }
  }, [])

  const skip = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    setLeaving(true)
    window.setTimeout(() => {
      setVisible(false)
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
        window.sessionStorage.removeItem(INTRO_RUNTIME_KEY)
      } catch {
        // ignore
      }
    }, 220)
  }

  if (!visible) return null

  const shards = 14

  return (
    <div
      className={`intro${leaving ? ' intro--leaving' : ''}`}
      role="dialog"
      aria-label="Intro animation"
      aria-live="polite"
    >
      <div className="intro__backdrop" aria-hidden />

      <button type="button" className="intro__skip" onClick={skip}>
        Skip
      </button>

      <div className="intro__stage" aria-hidden>
        <div className="intro__logo">
          <svg viewBox="0 0 80 80" className="intro__logo-svg">
            <defs>
              <linearGradient id="introGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c4b5fd" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <rect
              x="8"
              y="8"
              width="64"
              height="64"
              rx="18"
              fill="rgba(139,92,246,0.10)"
              stroke="url(#introGrad)"
              strokeWidth="3"
            />
            <path
              d="M22 40h12l8-16 8 32 8-16h12"
              stroke="url(#introGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <h2 className="intro__wordmark">
            <span>V</span>-<span>Rush</span>
          </h2>
        </div>

        <div className="intro__shards">
          {Array.from({ length: shards }).map((_, i) => {
            const angle = (i / shards) * Math.PI * 2
            const dx = Math.cos(angle) * 520
            const dy = Math.sin(angle) * 520
            const rot = (i % 2 === 0 ? 1 : -1) * (160 + i * 14)
            const style = {
              ['--dx' as string]: `${dx}px`,
              ['--dy' as string]: `${dy}px`,
              ['--rot' as string]: `${rot}deg`,
              ['--delay' as string]: `${i * 18}ms`,
            }
            return <span key={i} className="intro__shard" style={style} />
          })}
        </div>
      </div>
    </div>
  )
}
