import { useRef } from 'react'
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import { MagneticLink } from './MagneticLink'

/** Big landing hero with gradient headline, tagline, dual CTA, and a faux pipeline preview. */
export function Hero() {
  const reduced = useReducedMotion()
  const heroRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const rawY = useTransform(scrollYProgress, [0, 1], [0, -90])
  const mockY = useSpring(rawY, { stiffness: 90, damping: 22, mass: 0.5 })
  const rawTilt = useTransform(scrollYProgress, [0, 1], [0, -2])
  const mockTilt = useSpring(rawTilt, { stiffness: 120, damping: 20 })

  return (
    <section className="landing-hero" ref={heroRef}>
      <div className="landing-hero__content">
        <span className="landing-hero__eyebrow">Classical · Deep · Matcher</span>
        <h1 className="landing-hero__title">
          The visual workbench for<br />
          <span className="landing-hero__grad landing-hero__grad--shimmer">computer vision pipelines.</span>
        </h1>
        <p className="landing-hero__lede">
          Stack OpenCV ops and run YOLO&nbsp;+&nbsp;MobileSAM in the Studio, or line up two
          images with SIFT&nbsp;/&nbsp;ORB&nbsp;/&nbsp;AKAZE&nbsp;/&nbsp;BRISK in the Matcher —
          never write an import. Upload, drag, watch the transform happen side-by-side, with
          live pixel-value histograms for every step.
        </p>
        <div className="landing-hero__cta-row">
          <MagneticLink to="/studio" className="btn btn--primary btn--lg">
            Open the Studio
          </MagneticLink>
          <MagneticLink to="/match" className="btn btn--ghost btn--lg">
            Try the Matcher
          </MagneticLink>
          <MagneticLink to="/reference" className="btn btn--ghost btn--lg">
            Browse operations
          </MagneticLink>
        </div>
        <ul className="landing-hero__chips" aria-label="Highlights">
          <li className="chip chip--accent">ONNX YOLOv26</li>
          <li className="chip chip--accent">MobileSAM prompts</li>
          <li className="chip chip--accent">SIFT · ORB · AKAZE · BRISK matchers</li>
          <li className="chip chip--accent">RANSAC homography</li>
          <li className="chip chip--accent">Live histograms</li>
        </ul>
      </div>

      <motion.div
        className="landing-hero__visual"
        aria-hidden
        style={reduced ? undefined : { y: mockY, rotate: mockTilt }}
      >
        <HeroMock />
      </motion.div>
    </section>
  )
}


/**
 * Inline SVG "app screenshot" — no binary assets required.
 * Mimics the Studio: left palette, center before/after, right histogram.
 */
function HeroMock() {
  return (
    <svg viewBox="0 0 560 360" xmlns="http://www.w3.org/2000/svg" className="landing-hero__svg">
      <defs>
        <linearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b1030" />
          <stop offset="1" stopColor="#0a0720" />
        </linearGradient>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="heroImg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset=".4" stopColor="#ec4899" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="heroImg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="560" height="360" rx="18" fill="url(#heroBg)" />
      <rect x="0" y="0" width="560" height="28" rx="18" fill="rgba(255,255,255,0.04)" />
      <circle cx="14" cy="14" r="4" fill="#ef4444" opacity="0.7" />
      <circle cx="28" cy="14" r="4" fill="#f59e0b" opacity="0.7" />
      <circle cx="42" cy="14" r="4" fill="#10b981" opacity="0.7" />

      <rect x="14" y="44" width="118" height="298" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <text x="26" y="62" fontFamily="Inter, system-ui" fontSize="9" fill="#a78bfa">PALETTE</text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x="24"
          y={74 + i * 32}
          width="98"
          height="22"
          rx="6"
          fill={i === 2 ? 'url(#heroGrad)' : 'rgba(255,255,255,0.05)'}
          stroke={i === 2 ? 'none' : 'rgba(255,255,255,0.08)'}
        />
      ))}

      <rect x="142" y="44" width="260" height="158" rx="10" fill="url(#heroImg)" />
      <rect x="142" y="44" width="260" height="158" rx="10" fill="rgba(0,0,0,0.2)" />
      <text x="154" y="62" fontFamily="Inter, system-ui" fontSize="9" fill="white" opacity="0.8">BEFORE</text>

      <rect x="142" y="214" width="260" height="128" rx="10" fill="url(#heroImg2)" />
      <rect x="142" y="214" width="260" height="128" rx="10" fill="rgba(0,0,0,0.1)" />
      <text x="154" y="232" fontFamily="Inter, system-ui" fontSize="9" fill="white" opacity="0.85">AFTER</text>
      <g opacity="0.85">
        <rect x="168" y="248" width="62" height="66" rx="4" stroke="white" strokeWidth="1.4" fill="none" />
        <text x="172" y="262" fontFamily="Inter, system-ui" fontSize="7.5" fill="white">cat · 0.92</text>
      </g>

      <rect x="412" y="44" width="132" height="298" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <text x="424" y="62" fontFamily="Inter, system-ui" fontSize="9" fill="#a78bfa">HISTOGRAM</text>
      {Array.from({ length: 24 }).map((_, i) => {
        const h = 8 + Math.abs(Math.sin(i * 0.5)) * 50
        return (
          <rect
            key={i}
            className="hero-hist-bar"
            style={{ ['--i' as string]: i }}
            x={424 + i * 4.5}
            y={230 - h}
            width="3.2"
            height={h}
            rx="1"
            fill="url(#heroGrad)"
            opacity={0.55 + (i % 4) * 0.1}
          />
        )
      })}
      <rect x="424" y="246" width="108" height="1" fill="rgba(255,255,255,0.2)" />
      {Array.from({ length: 24 }).map((_, i) => {
        const h = 6 + Math.abs(Math.cos(i * 0.4 + 1)) * 70
        return (
          <rect
            key={i}
            className="hero-hist-bar hero-hist-bar--alt"
            style={{ ['--i' as string]: i }}
            x={424 + i * 4.5}
            y={336 - h}
            width="3.2"
            height={h}
            rx="1"
            fill="#34d399"
            opacity={0.35 + (i % 3) * 0.12}
          />
        )
      })}
    </svg>
  )
}
