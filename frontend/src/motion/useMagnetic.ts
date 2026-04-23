import { useCallback, useRef } from 'react'
import { useMotionValue, useReducedMotion, useSpring } from 'motion/react'

interface Options {
  /** Maximum offset (px) the element drifts toward the cursor. */
  strength?: number
  /** How much of the bounding box the cursor must enter before pull starts (0–1). */
  radius?: number
  /** Spring stiffness (passed through to useSpring). */
  stiffness?: number
  /** Spring damping (passed through to useSpring). */
  damping?: number
}

/**
 * Returns spring-driven motion values + handlers for a "magnetic" CTA.
 * Spread the result onto a `<motion.div|button|a>`:
 *
 *   const m = useMagnetic()
 *   <motion.button ref={m.ref} style={{ x: m.x, y: m.y }} onMouseMove={m.onMouseMove} onMouseLeave={m.onMouseLeave}>
 */
export function useMagnetic({
  strength = 14,
  radius = 1,
  stiffness = 220,
  damping = 18,
}: Options = {}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLElement | null>(null)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, { stiffness, damping, mass: 0.4 })
  const y = useSpring(rawY, { stiffness, damping, mass: 0.4 })

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (reduced) return
      const el = (ref.current ?? e.currentTarget) as HTMLElement
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (rect.width / 2)
      const dy = (e.clientY - cy) / (rect.height / 2)
      const mag = Math.hypot(dx, dy)
      if (mag > radius) return
      rawX.set(dx * strength)
      rawY.set(dy * strength)
    },
    [reduced, radius, strength, rawX, rawY],
  )

  const onMouseLeave = useCallback(() => {
    rawX.set(0)
    rawY.set(0)
  }, [rawX, rawY])

  return { ref, x, y, onMouseMove, onMouseLeave, reduced }
}
