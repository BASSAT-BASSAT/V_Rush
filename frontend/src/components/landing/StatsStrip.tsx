import { motion, useReducedMotion } from 'motion/react'
import { CATEGORY_LABELS } from '../../cv/categoryLabels'
import { MotionCountUp } from '../../motion'

interface Props {
  /** Total op count from the backend (optional — used when ops are loaded). */
  opCount?: number
}

interface StatDef {
  key: string
  /** Animated number target — when set, drives a count-up. */
  target?: number
  suffix?: string
  /** Pre-formatted display value (used when there's no number to count). */
  display?: string
  label: string
  sub: string
}

const PARENT_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const CHILD_VARIANTS = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 0.84, 0.32, 1] as [number, number, number, number] },
  },
}

/** A short numbers strip to anchor the page and broadcast breadth of the toolkit. */
export function StatsStrip({ opCount }: Props) {
  const reduced = useReducedMotion()
  const categoryCount = Object.keys(CATEGORY_LABELS).length
  const opsTarget = opCount ?? 40

  const stats: StatDef[] = [
    {
      key: 'ops',
      target: opsTarget,
      suffix: '+',
      label: 'Operations',
      sub: 'OpenCV · ONNX · SAM',
    },
    {
      key: 'cats',
      target: categoryCount,
      label: 'Categories',
      sub: 'Color, intensity, edges, morphology, texture, denoise, geometric, Fourier, segmentation…',
    },
    {
      key: 'match',
      target: 4,
      label: 'Matchers',
      sub: 'SIFT · ORB · AKAZE · BRISK + RANSAC',
    },
    { key: 'runs', display: '1-click', label: 'Runs', sub: 'Same pipeline, any image' },
    { key: 'setup', display: '0', label: 'Setup', sub: 'Nothing to install, ever' },
  ]

  return (
    <motion.section
      className="landing-stats"
      aria-label="By the numbers"
      variants={reduced ? undefined : PARENT_VARIANTS}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      {stats.map((s) => (
        <motion.div
          key={s.key}
          className="landing-stats__cell"
          variants={reduced ? undefined : CHILD_VARIANTS}
        >
          <span className="landing-stats__value">
            {s.target !== undefined ? (
              <MotionCountUp to={s.target} suffix={s.suffix} duration={1.4} />
            ) : (
              s.display
            )}
          </span>
          <span className="landing-stats__label">{s.label}</span>
          <span className="landing-stats__sub">{s.sub}</span>
        </motion.div>
      ))}
    </motion.section>
  )
}
