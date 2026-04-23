import { useCallback, useEffect, useRef } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Cap on zoom factor. */
  maxScale?: number
  /** Smallest allowed zoom factor. */
  minScale?: number
  /** Step size per wheel-tick (multiplicative). */
  wheelStep?: number
  className?: string
  /** Force-disable interactivity (e.g. when SAM prompting owns the pointer). */
  disabled?: boolean
}

/**
 * Drag-to-pan + wheel-to-zoom wrapper around an image preview. Includes a
 * floating "Reset view" button that springs everything back to identity.
 *
 * Pinch-to-zoom on touch is intentionally out of scope here — it would need
 * native pointer-event coalescing that motion's `drag` doesn't expose; the
 * wheel + drag combo covers desktop, which is the studio's primary surface.
 */
export function ZoomableFrame({
  children,
  maxScale = 4,
  minScale = 1,
  wheelStep = 1.15,
  className,
  disabled,
}: Props) {
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)

  const reset = useCallback(() => {
    if (reduced) {
      x.set(0)
      y.set(0)
      scale.set(1)
      return
    }
    animate(x, 0, { type: 'spring', stiffness: 220, damping: 22 })
    animate(y, 0, { type: 'spring', stiffness: 220, damping: 22 })
    animate(scale, 1, { type: 'spring', stiffness: 220, damping: 22 })
  }, [reduced, x, y, scale])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || disabled) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 6) return
      e.preventDefault()
      const cur = scale.get()
      const dir = e.deltaY < 0 ? wheelStep : 1 / wheelStep
      const next = Math.min(maxScale, Math.max(minScale, cur * dir))
      if (next === cur) return
      // Zoom around the pointer.
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left - rect.width / 2
      const py = e.clientY - rect.top - rect.height / 2
      const ratio = next / cur
      x.set(x.get() - px * (ratio - 1))
      y.set(y.get() - py * (ratio - 1))
      scale.set(next)
    }

    const onDouble = () => reset()

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('dblclick', onDouble)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('dblclick', onDouble)
    }
  }, [disabled, maxScale, minScale, wheelStep, x, y, scale, reset])

  if (disabled) {
    return <div className={`zoom-frame zoom-frame--off${className ? ` ${className}` : ''}`}>{children}</div>
  }

  return (
    <div
      ref={wrapRef}
      className={`zoom-frame${className ? ` ${className}` : ''}`}
    >
      <motion.div
        className="zoom-frame__inner"
        drag
        dragMomentum={false}
        dragElastic={0.08}
        style={{ x, y, scale }}
      >
        {children}
      </motion.div>
      <button
        type="button"
        className="zoom-frame__reset"
        onClick={reset}
        title="Reset view (or double-click)"
      >
        Reset view
      </button>
    </div>
  )
}
