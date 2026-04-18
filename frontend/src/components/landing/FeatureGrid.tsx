import type { ReactElement } from 'react'

interface Feature {
  title: string
  body: string
  accent: string
  icon: ReactElement
}

/** Four capability cards. Icons are inline SVG, no external assets. */
export function FeatureGrid() {
  const features: Feature[] = [
    {
      title: 'Classical operations',
      body:
        'Blur, sharpen, histogram equalization, morphology, Canny, Sobel, Fourier — the OpenCV textbook, point-and-click.',
      accent: '#a78bfa',
      icon: <IconLayers />,
    },
    {
      title: 'Detection & segmentation',
      body:
        'YOLOv26 boxes, MobileSAM cutouts, K-Means, Watershed, GrabCut, and connected components — all deployable on Vercel.',
      accent: '#f472b6',
      icon: <IconTarget />,
    },
    {
      title: 'Live pixel insights',
      body:
        'Before/after histograms for luma and each RGB channel, plus mean, std, and extrema. See what every operation actually did.',
      accent: '#34d399',
      icon: <IconSpark />,
    },
    {
      title: 'Pipeline as code',
      body:
        'Export your stack as ready-to-run Python with OpenCV, NumPy, and ONNX Runtime calls — or share a JSON recipe.',
      accent: '#60a5fa',
      icon: <IconCode />,
    },
  ]

  return (
    <section className="landing-features" aria-labelledby="feat-h">
      <h2 id="feat-h" className="landing-section-title">
        Everything a vision course teaches, on one page.
      </h2>
      <p className="landing-section-sub">
        From pixel-level filters to foundation-model cutouts — V-Rush keeps the workflow fast,
        tactile, and transparent.
      </p>

      <div className="landing-features__grid">
        {features.map((f) => (
          <article key={f.title} className="landing-feature" style={{ ['--accent' as string]: f.accent }}>
            <div className="landing-feature__icon">{f.icon}</div>
            <h3 className="landing-feature__title">{f.title}</h3>
            <p className="landing-feature__body">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <path d="M12 3 4 7l8 4 8-4-8-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m4 12 8 4 8-4M4 17l8 4 8-4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}
function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <path
        d="M4 20V8m5 12v-6m5 6V4m5 16v-9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconCode() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <path
        d="m8 8-5 4 5 4m8-8 5 4-5 4m-2-12-4 16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
