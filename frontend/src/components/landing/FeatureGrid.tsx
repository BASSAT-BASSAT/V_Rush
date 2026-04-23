import type { MouseEvent, ReactElement } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const PARENT_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
}

const CHILD_VARIANTS = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 0.84, 0.32, 1] as [number, number, number, number] },
  },
}

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
      title: 'Local feature matchers',
      body:
        'Drop two images, pick SIFT, ORB, AKAZE or BRISK, BF or FLANN matching with Lowe\u2019s ratio test, then watch RANSAC keep only the geometrically consistent inliers.',
      accent: '#22d3ee',
      icon: <IconLink />,
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

  const reduced = useReducedMotion()

  const handleMove = (e: MouseEvent<HTMLElement>) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    card.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <motion.section
      className="landing-features"
      aria-labelledby="feat-h"
      variants={reduced ? undefined : PARENT_VARIANTS}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.18 }}
    >
      <motion.h2
        id="feat-h"
        className="landing-section-title"
        variants={reduced ? undefined : CHILD_VARIANTS}
      >
        Every op a CV engineer reaches for, in one workbench.
      </motion.h2>
      <motion.p
        className="landing-section-sub"
        variants={reduced ? undefined : CHILD_VARIANTS}
      >
        From pixel-level filters to foundation-model cutouts — skip the boilerplate and keep the
        experiments tactile, reproducible, and ready to ship.
      </motion.p>

      <div className="landing-features__grid">
        {features.map((f) => (
          <motion.article
            key={f.title}
            className="landing-feature"
            style={{ ['--accent' as string]: f.accent }}
            onMouseMove={handleMove}
            variants={reduced ? undefined : CHILD_VARIANTS}
            whileHover={reduced ? undefined : { y: -4 }}
          >
            <span className="landing-feature__spotlight" aria-hidden />
            <div className="landing-feature__icon">{f.icon}</div>
            <h3 className="landing-feature__title">{f.title}</h3>
            <p className="landing-feature__body">{f.body}</p>
          </motion.article>
        ))}
      </div>
    </motion.section>
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
function IconLink() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <circle cx="6.5" cy="7" r="1.6" fill="currentColor" />
      <circle cx="6.5" cy="17" r="1.6" fill="currentColor" />
      <circle cx="17.5" cy="6" r="1.6" fill="currentColor" />
      <circle cx="17.5" cy="13" r="1.6" fill="currentColor" />
      <circle cx="17.5" cy="19" r="1.6" fill="currentColor" />
      <path
        d="M6.5 7 17.5 13M6.5 17 17.5 6M6.5 17 17.5 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
