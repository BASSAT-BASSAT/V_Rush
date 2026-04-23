import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABELS } from '../../cv/categoryLabels'
import { useCountUp } from '../../hooks/useCountUp'

interface Props {
  /** Total op count from the backend (optional — used when ops are loaded). */
  opCount?: number
}

/** A short numbers strip to anchor the page and broadcast breadth of the toolkit. */
export function StatsStrip({ opCount }: Props) {
  const categoryCount = Object.keys(CATEGORY_LABELS).length
  const sectionRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('is-in')
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.25, rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const opsTarget = opCount ?? 40
  const opsValue = useCountUp(opsTarget, { enabled: visible, duration: 1400 })
  const categoryValue = useCountUp(categoryCount, { enabled: visible, duration: 1200 })
  const matchersValue = useCountUp(4, { enabled: visible, duration: 900 })

  const stats = [
    { key: 'ops', value: `${opsValue}+`, label: 'Operations', sub: 'OpenCV · ONNX · SAM' },
    {
      key: 'cats',
      value: String(categoryValue),
      label: 'Categories',
      sub: 'Color, intensity, edges, morphology, texture, denoise, geometric, Fourier, segmentation…',
    },
    {
      key: 'match',
      value: String(matchersValue),
      label: 'Matchers',
      sub: 'SIFT · ORB · AKAZE · BRISK + RANSAC',
    },
    { key: 'runs', value: '1-click', label: 'Runs', sub: 'Same pipeline, any image' },
    { key: 'setup', value: '0', label: 'Setup', sub: 'Nothing to install, ever' },
  ]

  return (
    <section ref={sectionRef} className="landing-stats reveal reveal--up" aria-label="By the numbers">
      {stats.map((s, i) => (
        <div
          key={s.key}
          className="landing-stats__cell reveal reveal--up"
          style={{ ['--reveal-delay' as string]: `${i * 80}ms` }}
        >
          <span className="landing-stats__value">{s.value}</span>
          <span className="landing-stats__label">{s.label}</span>
          <span className="landing-stats__sub">{s.sub}</span>
        </div>
      ))}
    </section>
  )
}
