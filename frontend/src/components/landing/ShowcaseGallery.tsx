import { useState, type ReactElement, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { MotionReveal } from '../../motion'
import { ShowcaseDetail } from './ShowcaseDetail'

export interface ShowcaseItem {
  label: string
  op: string
  before: ReactElement
  after: ReactElement
  /** Plain-text description shown in the expansion modal. */
  detail?: string
}

/** Before/after gallery illustrated entirely with SVG gradients & filters — zero binary assets. */
export function ShowcaseGallery() {
  const items: ShowcaseItem[] = [
    {
      label: 'Canny edges',
      op: 'canny',
      before: <Portrait />,
      after: <PortraitEdges />,
      detail:
        'Canny chains a Gaussian blur, two Sobel gradients, non-maximum suppression, and hysteresis thresholding into a clean one-pixel edge map. Use it to feed contour detectors or to highlight structure in noisy frames.',
    },
    {
      label: 'K-Means quantization',
      op: 'kmeans',
      before: <SunsetScene />,
      after: <SunsetSceneKMeans />,
      detail:
        'Cluster every pixel into K colour bins and repaint the image with the cluster centroids. Great for posterisation, palette extraction, or as a fast pre-segmentation before edge / region ops.',
    },
    {
      label: 'MobileSAM cutout',
      op: 'mobile_sam',
      before: <Subject />,
      after: <SubjectCutout />,
      detail:
        'Tap a foreground point or drag a box and MobileSAM hands you a binary mask, a cut-out PNG, or a coloured overlay. Runs end-to-end in the browser with ONNX Runtime — no GPU required.',
    },
    {
      label: 'YOLO26 detection',
      op: 'yolo26_detect',
      before: <StreetScene />,
      after: <StreetSceneBoxes />,
      detail:
        'YOLOv26 returns class labels, confidence scores, and pixel-space bounding boxes for the 80 COCO categories. One click in Studio appends a crop step using the box you pick.',
    },
    {
      label: 'SIFT feature matcher',
      op: 'matcher.sift',
      before: <PairLeft />,
      after: <PairMatched />,
      detail:
        'SIFT detects scale-invariant keypoints and produces 128-dim float descriptors. Pair it with brute-force / FLANN matching, Lowe\u2019s ratio test, and RANSAC homography for robust image alignment.',
    },
  ]

  const [active, setActive] = useState<ShowcaseItem | null>(null)

  const renderCard = (it: ShowcaseItem, key: string, interactive: boolean) => {
    const layoutId = interactive ? `showcase-${it.op}` : undefined
    const handle = () => interactive && setActive(it)
    return (
      <motion.article
        key={key}
        className="landing-showcase__card"
        layoutId={layoutId}
        onClick={handle}
        whileHover={interactive ? { y: -4 } : undefined}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : -1}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handle()
                }
              }
            : undefined
        }
        aria-label={interactive ? `Open ${it.label} detail` : undefined}
      >
        <div className="landing-showcase__pair">
          <div className="landing-showcase__img landing-showcase__img--before">
            {it.before}
            <span className="landing-showcase__tag">Before</span>
          </div>
          <div className="landing-showcase__img landing-showcase__img--after">
            {it.after}
            <span className="landing-showcase__tag landing-showcase__tag--after">After</span>
          </div>
        </div>
        <div className="landing-showcase__meta">
          <span className="landing-showcase__label">{it.label}</span>
          <code className="landing-showcase__op">{it.op}</code>
        </div>
      </motion.article>
    )
  }

  return (
    <MotionReveal
      as="section"
      className="landing-showcase"
      ariaLabelledBy="show-h"
      amount={0.15}
    >
      <h2 id="show-h" className="landing-section-title landing-showcase__title">
        Every op. <span className="landing-showcase__title-accent">One rush.</span>
      </h2>

      <div
        className="landing-showcase__marquee"
        role="region"
        aria-label="Vision operations carousel"
      >
        <div className="landing-showcase__marquee-fade landing-showcase__marquee-fade--left" aria-hidden />
        <div className="landing-showcase__marquee-fade landing-showcase__marquee-fade--right" aria-hidden />

        <div className="landing-showcase__track">
          <div className="landing-showcase__set">
            {items.map((it) => renderCard(it, it.op, true))}
          </div>
          <div className="landing-showcase__set" aria-hidden="true">
            {items.map((it) => renderCard(it, `${it.op}-dup`, false))}
          </div>
        </div>
      </div>

      <ShowcaseDetail item={active} onClose={() => setActive(null)} />
    </MotionReveal>
  )
}

function Frame({ children, bg }: { children: ReactNode; bg: string }) {
  return (
    <svg viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" className="landing-showcase__svg">
      <rect width="200" height="140" fill={bg} />
      {children}
    </svg>
  )
}

function Portrait() {
  return (
    <Frame bg="#0f172a">
      <defs>
        <radialGradient id="skin" cx="0.5" cy="0.42" r="0.55">
          <stop offset="0" stopColor="#fde3cf" />
          <stop offset="1" stopColor="#b68166" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="58" r="34" fill="url(#skin)" />
      <ellipse cx="100" cy="130" rx="52" ry="28" fill="#3b2e6b" />
      <circle cx="89" cy="56" r="2.5" fill="#1e1b4b" />
      <circle cx="111" cy="56" r="2.5" fill="#1e1b4b" />
    </Frame>
  )
}
function PortraitEdges() {
  return (
    <Frame bg="#000000">
      <g fill="none" stroke="#f8fafc" strokeWidth="1.3" strokeLinejoin="round">
        <circle cx="100" cy="58" r="34" />
        <ellipse cx="100" cy="130" rx="52" ry="28" />
        <circle cx="89" cy="56" r="3" />
        <circle cx="111" cy="56" r="3" />
        <path d="M86 70c6 4 22 4 28 0" />
      </g>
    </Frame>
  )
}
function SunsetScene() {
  return (
    <Frame bg="#1a0b2e">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d28d9" />
          <stop offset=".5" stopColor="#f97316" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <rect width="200" height="96" fill="url(#sky)" />
      <circle cx="150" cy="70" r="18" fill="#fef3c7" />
      <rect y="96" width="200" height="44" fill="#4c1d95" />
      <polygon points="0,96 50,60 90,96" fill="#3b0764" />
      <polygon points="80,96 130,50 180,96" fill="#1e1b4b" />
    </Frame>
  )
}
function SunsetSceneKMeans() {
  return (
    <Frame bg="#1a0b2e">
      <rect width="200" height="40" fill="#6d28d9" />
      <rect y="40" width="200" height="30" fill="#ec4899" />
      <rect y="70" width="200" height="26" fill="#f59e0b" />
      <rect y="96" width="200" height="44" fill="#3b0764" />
      <circle cx="150" cy="70" r="18" fill="#fde68a" />
    </Frame>
  )
}
function Subject() {
  return (
    <Frame bg="#e2e8f0">
      <rect width="200" height="140" fill="#94a3b8" />
      <circle cx="100" cy="70" r="40" fill="#f43f5e" />
      <rect x="70" y="98" width="60" height="36" rx="8" fill="#be123c" />
    </Frame>
  )
}
function SubjectCutout() {
  return (
    <Frame bg="#0f172a">
      <defs>
        <pattern id="checker" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#1f2937" />
          <rect width="5" height="5" fill="#0f172a" />
          <rect x="5" y="5" width="5" height="5" fill="#0f172a" />
        </pattern>
      </defs>
      <rect width="200" height="140" fill="url(#checker)" />
      <circle cx="100" cy="70" r="40" fill="#f43f5e" />
      <rect x="70" y="98" width="60" height="36" rx="8" fill="#be123c" />
    </Frame>
  )
}
function StreetScene() {
  return (
    <Frame bg="#1e293b">
      <rect y="0" width="200" height="82" fill="#334155" />
      <rect y="82" width="200" height="58" fill="#1e293b" />
      <rect x="20" y="54" width="52" height="28" rx="4" fill="#fb7185" />
      <circle cx="30" cy="86" r="4" fill="#0f172a" />
      <circle cx="62" cy="86" r="4" fill="#0f172a" />
      <rect x="120" y="40" width="60" height="46" rx="6" fill="#38bdf8" />
      <circle cx="132" cy="90" r="5" fill="#0f172a" />
      <circle cx="168" cy="90" r="5" fill="#0f172a" />
    </Frame>
  )
}
function StreetSceneBoxes() {
  return (
    <Frame bg="#1e293b">
      <rect y="0" width="200" height="82" fill="#334155" />
      <rect y="82" width="200" height="58" fill="#1e293b" />
      <rect x="20" y="54" width="52" height="28" rx="4" fill="#fb7185" />
      <circle cx="30" cy="86" r="4" fill="#0f172a" />
      <circle cx="62" cy="86" r="4" fill="#0f172a" />
      <rect x="120" y="40" width="60" height="46" rx="6" fill="#38bdf8" />
      <circle cx="132" cy="90" r="5" fill="#0f172a" />
      <circle cx="168" cy="90" r="5" fill="#0f172a" />
      <rect
        x="16"
        y="50"
        width="60"
        height="42"
        fill="none"
        stroke="#34d399"
        strokeWidth="1.8"
        strokeDasharray="4 2"
      />
      <rect x="16" y="40" width="52" height="12" fill="#34d399" />
      <text x="20" y="50" fontFamily="Inter" fontSize="8" fill="#0f172a">
        car 0.91
      </text>
      <rect
        x="116"
        y="36"
        width="68"
        height="58"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="1.8"
        strokeDasharray="4 2"
      />
      <rect x="116" y="26" width="68" height="12" fill="#60a5fa" />
      <text x="120" y="36" fontFamily="Inter" fontSize="8" fill="#0f172a">
        truck 0.84
      </text>
    </Frame>
  )
}

/** Two side-by-side patches with sparse keypoint markers — pre-match. */
function PairLeft() {
  return (
    <Frame bg="#0b1220">
      <defs>
        <linearGradient id="pairA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#312e81" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="pairB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect x="6" y="14" width="90" height="112" rx="6" fill="url(#pairA)" />
      <rect x="104" y="14" width="90" height="112" rx="6" fill="url(#pairB)" />
      <text x="10" y="11" fontFamily="Inter" fontSize="7" fill="#94a3b8">A</text>
      <text x="108" y="11" fontFamily="Inter" fontSize="7" fill="#94a3b8">B</text>
      {/* simple "scene": triangle + circle on both, slightly translated/rotated */}
      <polygon points="32,86 60,42 80,86" fill="#fbbf24" opacity="0.85" />
      <circle cx="50" cy="58" r="9" fill="#f472b6" opacity="0.85" />
      <polygon points="138,82 168,46 184,90" fill="#fbbf24" opacity="0.85" />
      <circle cx="152" cy="60" r="9" fill="#f472b6" opacity="0.85" />
      {/* keypoint dots */}
      {[
        [32, 86],
        [80, 86],
        [60, 42],
        [50, 58],
        [44, 70],
        [70, 70],
      ].map((p, i) => (
        <circle key={`la${i}`} cx={p[0]} cy={p[1]} r="2.2" fill="none" stroke="#22d3ee" strokeWidth="1" />
      ))}
      {[
        [138, 82],
        [184, 90],
        [168, 46],
        [152, 60],
        [146, 72],
        [172, 72],
      ].map((p, i) => (
        <circle key={`lb${i}`} cx={p[0]} cy={p[1]} r="2.2" fill="none" stroke="#22d3ee" strokeWidth="1" />
      ))}
    </Frame>
  )
}

/** Same patches, with match lines + "sift inliers" tag. */
function PairMatched() {
  const left: [number, number][] = [
    [32, 86],
    [80, 86],
    [60, 42],
    [50, 58],
    [44, 70],
    [70, 70],
  ]
  const right: [number, number][] = [
    [138, 82],
    [184, 90],
    [168, 46],
    [152, 60],
    [146, 72],
    [172, 72],
  ]
  const colors = ['#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#60a5fa']
  return (
    <Frame bg="#050810">
      <rect x="6" y="14" width="90" height="112" rx="6" fill="#0f172a" />
      <rect x="104" y="14" width="90" height="112" rx="6" fill="#111827" />
      <polygon points="32,86 60,42 80,86" fill="none" stroke="#fbbf24" strokeWidth="1.2" opacity="0.55" />
      <circle cx="50" cy="58" r="9" fill="none" stroke="#f472b6" strokeWidth="1.2" opacity="0.55" />
      <polygon points="138,82 168,46 184,90" fill="none" stroke="#fbbf24" strokeWidth="1.2" opacity="0.55" />
      <circle cx="152" cy="60" r="9" fill="none" stroke="#f472b6" strokeWidth="1.2" opacity="0.55" />
      {left.map((p, i) => (
        <g key={`m${i}`}>
          <line
            x1={p[0]}
            y1={p[1]}
            x2={right[i][0]}
            y2={right[i][1]}
            stroke={colors[i]}
            strokeWidth="1"
            opacity="0.95"
          />
          <circle cx={p[0]} cy={p[1]} r="2.5" fill={colors[i]} />
          <circle cx={right[i][0]} cy={right[i][1]} r="2.5" fill={colors[i]} />
        </g>
      ))}
      <rect x="6" y="2" width="60" height="11" rx="3" fill="#0ea5e9" opacity="0.85" />
      <text x="10" y="10" fontFamily="Inter" fontSize="7" fill="#0b1220" fontWeight="700">
        SIFT · 6 inliers
      </text>
    </Frame>
  )
}

