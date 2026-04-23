import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

export interface FlyToStackHandle {
  fly: (args: {
    sourceRect: DOMRect
    label: string
    onArrive: () => void
    /** Optional override target. Defaults to the pipeline stack root. */
    targetSelector?: string
  }) => void
}

interface Ghost {
  id: number
  label: string
  from: { left: number; top: number; width: number; height: number }
  to: { left: number; top: number; width: number; height: number }
  onArrive: () => void
}

const DEFAULT_TARGET_SELECTORS = [
  '[data-stack="root"] .pipeline-stack__list',
  '.workspace-tabs__btn--on',
  '[data-stack="root"]',
  '.app__col--pipeline',
]

function findTargetRect(selector?: string): DOMRect | null {
  const candidates = selector ? [selector, ...DEFAULT_TARGET_SELECTORS] : DEFAULT_TARGET_SELECTORS
  for (const sel of candidates) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) return rect
    }
  }
  return null
}

/**
 * Imperative portal that animates a "ghost" of the just-clicked op from the
 * palette button down to the pipeline stack. On arrival it fires `onArrive`,
 * which is what actually appends the step (so the real flash + spring entrance
 * lines up with the ghost's landing).
 */
export const FlyToStack = forwardRef<FlyToStackHandle, object>(function FlyToStack(_, ref) {
  const reduced = useReducedMotion()
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const idRef = useRef(0)
  // Tracks ghosts whose `onArrive` has already fired. `onAnimationComplete`
  // fires twice per ghost (once for the forward tween, once for the
  // AnimatePresence exit tween) so without this the pipeline step would be
  // appended twice on a single click.
  const announcedRef = useRef<Set<number>>(new Set())

  const remove = useCallback((id: number) => {
    setGhosts((prev) => prev.filter((g) => g.id !== id))
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      fly: ({ sourceRect, label, onArrive, targetSelector }) => {
        if (reduced) {
          onArrive()
          return
        }
        const target = findTargetRect(targetSelector)
        if (!target) {
          onArrive()
          return
        }
        const id = ++idRef.current
        // Land near the bottom of the stack list — that's where the new step
        // will spring into place.
        const dropWidth = Math.min(sourceRect.width, target.width - 16)
        const ghost: Ghost = {
          id,
          label,
          from: {
            left: sourceRect.left,
            top: sourceRect.top,
            width: sourceRect.width,
            height: sourceRect.height,
          },
          to: {
            left: target.left + (target.width - dropWidth) / 2,
            top: target.bottom - sourceRect.height - 12,
            width: dropWidth,
            height: sourceRect.height,
          },
          onArrive,
        }
        setGhosts((prev) => [...prev, ghost])
      },
    }),
    [reduced],
  )

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fly-to-stack" aria-hidden>
      <AnimatePresence>
        {ghosts.map((g) => (
          <motion.div
            key={g.id}
            className="fly-to-stack__ghost"
            initial={{
              left: g.from.left,
              top: g.from.top,
              width: g.from.width,
              height: g.from.height,
              opacity: 0.95,
              scale: 1,
            }}
            animate={{
              left: g.to.left,
              top: g.to.top,
              width: g.to.width,
              height: g.to.height,
              opacity: [0.95, 1, 0.85],
              scale: [1, 1.05, 0.96],
            }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{
              duration: 0.55,
              ease: [0.16, 0.84, 0.32, 1],
              opacity: { times: [0, 0.5, 1] },
              scale: { times: [0, 0.6, 1] },
            }}
            onAnimationComplete={() => {
              if (announcedRef.current.has(g.id)) return
              announcedRef.current.add(g.id)
              g.onArrive()
              remove(g.id)
            }}
          >
            <span className="fly-to-stack__label">{g.label}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
})
