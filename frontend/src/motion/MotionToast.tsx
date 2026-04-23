import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export type ToastKind = 'ok' | 'error' | 'warn' | 'info'

interface Props {
  /** Render the toast when truthy. */
  show: boolean
  kind?: ToastKind
  children: ReactNode
  /** Extra class names appended after `banner banner--<kind>`. */
  className?: string
  role?: string
  /** When true, the toast is positioned exactly where it appears in flow. */
  inline?: boolean
}

/**
 * Drop-in animated wrapper around the existing `.banner` markup, so we get
 * mount/unmount animations without rewriting every banner in the app.
 */
export function MotionToast({
  show,
  kind = 'info',
  children,
  className = '',
  role = 'status',
  inline = true,
}: Props) {
  const reduced = useReducedMotion()
  const variantClass = kind === 'info' ? '' : ` banner--${kind}`
  const finalClass = `banner${variantClass}${className ? ` ${className}` : ''}`

  return (
    <AnimatePresence initial={false} mode="wait">
      {show && (
        <motion.div
          key={kind}
          role={role}
          className={finalClass}
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.98 }}
          animate={
            reduced
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, y: -6, scale: 0.98 }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.28, ease: [0.16, 0.84, 0.32, 1] }
          }
          style={inline ? undefined : { position: 'absolute' }}
          layout
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
