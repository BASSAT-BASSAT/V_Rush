import { CATEGORY_LABELS } from '../../cv/categoryLabels'

interface Props {
  /** Total op count from the backend (optional — used when ops are loaded). */
  opCount?: number
}

/** A short numbers strip to anchor the page and broadcast breadth of the toolkit. */
export function StatsStrip({ opCount }: Props) {
  const categoryCount = Object.keys(CATEGORY_LABELS).length

  const stats = [
    { value: opCount ? `${opCount}+` : '40+', label: 'Operations', sub: 'OpenCV · ONNX · SAM' },
    {
      value: String(categoryCount),
      label: 'Categories',
      sub: 'Color, intensity, edges, morphology, texture, denoise, geometric, Fourier, segmentation…',
    },
    { value: '1-click', label: 'Runs', sub: 'Same pipeline, any image' },
    { value: '0', label: 'Setup', sub: 'Nothing to install, ever' },
  ]

  return (
    <section className="landing-stats" aria-label="By the numbers">
      {stats.map((s) => (
        <div key={s.label} className="landing-stats__cell">
          <span className="landing-stats__value">{s.value}</span>
          <span className="landing-stats__label">{s.label}</span>
          <span className="landing-stats__sub">{s.sub}</span>
        </div>
      ))}
    </section>
  )
}
