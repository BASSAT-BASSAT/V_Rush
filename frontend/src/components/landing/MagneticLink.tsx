import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useMagnetic } from '../../motion'

interface Props {
  to: string
  children: ReactNode
  className?: string
}

const MotionLink = motion.create(Link)

/** A `react-router-dom` <Link> that drifts a few pixels toward the cursor. */
export function MagneticLink({ to, children, className }: Props) {
  const m = useMagnetic({ strength: 12, radius: 1.4, stiffness: 240, damping: 18 })

  return (
    <MotionLink
      to={to}
      className={className}
      ref={m.ref as React.RefObject<HTMLAnchorElement>}
      style={{ x: m.x, y: m.y, display: 'inline-flex' }}
      onMouseMove={m.onMouseMove}
      onMouseLeave={m.onMouseLeave}
      whileHover={m.reduced ? undefined : { scale: 1.03 }}
      whileTap={m.reduced ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
    >
      {children}
    </MotionLink>
  )
}
