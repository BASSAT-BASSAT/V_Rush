import type { CSSProperties, ElementType, ReactNode } from 'react'
import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'motion/react'

interface Props {
  children: ReactNode
  /** HTML tag rendered for the wrapper. Defaults to a div. */
  as?: ElementType
  /** Distance (px) the element rises from while fading in. */
  y?: number
  /** Tween duration in seconds. */
  duration?: number
  /** Initial delay before this element starts. Useful for one-off staggers. */
  delay?: number
  /** When true, makes this a parent that staggers its motion children. */
  stagger?: boolean
  /** Time between staggered children, seconds. */
  staggerChildren?: number
  /** Optional initial offset for the stagger sequence. */
  delayChildren?: number
  /** How much of the element must be visible before triggering (0–1). */
  amount?: number
  /** Replay every time the element re-enters the viewport. */
  repeat?: boolean
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  ariaLabelledBy?: string
  id?: string
  role?: string
}

/**
 * A small Motion replacement for the legacy `useReveal` hook.
 *
 * Usage:
 *   <MotionReveal stagger>
 *     <MotionReveal>card 1</MotionReveal>
 *     <MotionReveal>card 2</MotionReveal>
 *   </MotionReveal>
 */
export function MotionReveal({
  children,
  as = 'div',
  y = 18,
  duration = 0.55,
  delay = 0,
  stagger = false,
  staggerChildren = 0.08,
  delayChildren = 0.05,
  amount = 0.2,
  repeat = false,
  className,
  style,
  ariaLabel,
  ariaLabelledBy,
  id,
  role,
}: Props) {
  const reduced = useReducedMotion()
  const MotionTag = motion(as) as ReturnType<typeof motion>

  const variants: Variants = stagger
    ? {
        hidden: {},
        show: {
          transition: reduced
            ? { duration: 0 }
            : { staggerChildren, delayChildren },
        },
      }
    : {
        hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: reduced
            ? { duration: 0 }
            : { duration, delay, ease: [0.16, 0.84, 0.32, 1] },
        },
      }

  const motionProps: HTMLMotionProps<'div'> = {
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: !repeat, amount },
    variants,
    className,
    style,
    id,
    role,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  }

  return <MotionTag {...motionProps}>{children}</MotionTag>
}
