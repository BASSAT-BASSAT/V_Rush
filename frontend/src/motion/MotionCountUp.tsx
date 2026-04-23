import { useEffect, useRef, useState } from 'react'
import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'

interface Props {
  /** Target value to animate to. */
  to: number
  /** Starting value (default 0). */
  from?: number
  /** Spring/tween duration in seconds. */
  duration?: number
  /** Decimal places to display while counting. */
  decimals?: number
  /** Append a suffix to every render (e.g. `+`, `%`). */
  suffix?: string
  /** Prepend a prefix to every render. */
  prefix?: string
  /** Locale formatter. Defaults to the user's locale. */
  locale?: string
  /** Re-trigger the count-up every time the element re-enters the viewport. */
  repeat?: boolean
  /** Visible amount that triggers the run (0–1). */
  amount?: number
  className?: string
}

/**
 * Spring-driven count-up that triggers once it scrolls into view.
 *
 * Replaces the hand-rolled `useCountUp` hook + IntersectionObserver in
 * the landing/Matcher stat cards.
 */
export function MotionCountUp({
  to,
  from = 0,
  duration = 1.4,
  decimals = 0,
  suffix = '',
  prefix = '',
  locale,
  repeat = false,
  amount = 0.4,
  className,
}: Props) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: !repeat, amount })
  const value = useMotionValue(reduced ? to : from)
  const [display, setDisplay] = useState<string>(format(reduced ? to : from))

  function format(n: number) {
    const fixed = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString()
    const num = decimals > 0 ? Number.parseFloat(fixed) : Number.parseInt(fixed, 10)
    const formatted = Number.isFinite(num)
      ? num.toLocaleString(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : fixed
    return `${prefix}${formatted}${suffix}`
  }

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setDisplay(format(to))
      value.set(to)
      return
    }
    const controls = animate(value, to, {
      duration,
      ease: [0.16, 0.84, 0.32, 1],
      onUpdate: (latest) => setDisplay(format(latest)),
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, to, reduced])

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}
