import type { ReactElement, ReactNode } from 'react'

interface ShowcaseItem {
  label: string
  op: string
  before: ReactElement
  after: ReactElement
}

/** Before/after gallery illustrated entirely with SVG gradients & filters — zero binary assets. */
export function ShowcaseGallery() {
  const items: ShowcaseItem[] = [
    {
      label: 'Canny edges',
      op: 'canny',
      before: <Portrait />,
      after: <PortraitEdges />,
    },
    {
      label: 'K-Means quantization',
      op: 'kmeans',
      before: <SunsetScene />,
      after: <SunsetSceneKMeans />,
    },
    {
      label: 'MobileSAM cutout',
      op: 'mobile_sam',
      before: <Subject />,
      after: <SubjectCutout />,
    },
    {
      label: 'YOLO26 detection',
      op: 'yolo26_detect',
      before: <StreetScene />,
      after: <StreetSceneBoxes />,
    },
  ]

  return (
    <section className="landing-showcase" aria-labelledby="show-h">
      <h2 id="show-h" className="landing-section-title">
        See the operations in action.
      </h2>
      <p className="landing-section-sub">
        Every op ships with a live preview and the exact OpenCV or ONNX call underneath.
      </p>

      <div className="landing-showcase__grid">
        {items.map((it) => (
          <article key={it.op} className="landing-showcase__card">
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
          </article>
        ))}
      </div>
    </section>
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
