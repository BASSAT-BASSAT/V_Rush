import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { categoryLabel } from '../cv/categoryLabels'
import type { OpInfo } from '../types/cv'
import type { AppLayoutOutlet } from '../types/layout'

function groupByCategory(ops: OpInfo[]) {
  const m = new Map<string, OpInfo[]>()
  for (const o of ops) {
    const list = m.get(o.category) ?? []
    list.push(o)
    m.set(o.category, list)
  }
  return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b))
}

// =============================================================================
// LOCAL FEATURE MATCHER REFERENCE
// =============================================================================
// These don't live in /api/ops (they aren't pipeline operations) so we render
// them from this static catalog. Keep in sync with backend/app/api/match_routes
// _ALGO_CATALOG and frontend/src/pages/MatcherPage.tsx PARAM_HELP.

interface MatcherDoc {
  id: string
  label: string
  kind: 'classical' | 'deep'
  descriptor: string
  one_liner: string
  paragraphs: string[]
  strengths: string[]
  weaknesses: string[]
  /** Year + paper name for credibility / further reading. */
  origin: string
}

const MATCHER_DOCS: MatcherDoc[] = [
  {
    id: 'sift',
    label: 'SIFT',
    kind: 'classical',
    descriptor: 'float · 128-d',
    one_liner: 'Scale-Invariant Feature Transform — the historical gold standard.',
    paragraphs: [
      'Builds a Gaussian scale pyramid, finds extrema in the difference-of-Gaussians, then describes each keypoint with a 128-dimensional histogram of oriented gradients in a 16×16 patch around the point.',
      'Matches across image pairs are typically compared with L2 distance and filtered with Lowe\'s ratio test. SIFT is patented-free since 2020 and ships with stock OpenCV.',
    ],
    strengths: [
      'Robust to scale, rotation and modest illumination change',
      'Highly distinctive — fewer false matches at the same threshold',
      'Well-studied; works on almost everything you throw at it',
    ],
    weaknesses: [
      'Slow — float descriptors and many octaves',
      'Struggles on blurry / low-texture imagery',
    ],
    origin: 'Lowe, "Distinctive Image Features from Scale-Invariant Keypoints" (IJCV 2004).',
  },
  {
    id: 'orb',
    label: 'ORB',
    kind: 'classical',
    descriptor: 'binary · 256-bit',
    one_liner: 'Oriented FAST + rotated BRIEF — built for real-time SLAM.',
    paragraphs: [
      'ORB picks corners with an oriented FAST detector and describes them with a steered BRIEF binary string. Because descriptors are bits, matching is an extremely fast Hamming distance — perfect for FLANN with an LSH index.',
      'It is the default detector in many real-time SLAM and AR systems precisely because the whole pipeline can run in milliseconds on CPU.',
    ],
    strengths: [
      'Extremely fast both at detection and matching',
      'Free, no patent encumbrance',
      'Rotation invariant',
    ],
    weaknesses: [
      'Not truly scale invariant on big zoom changes',
      'Less distinctive than float descriptors — more false matches under hard transforms',
    ],
    origin: 'Rublee et al., "ORB: An efficient alternative to SIFT or SURF" (ICCV 2011).',
  },
  {
    id: 'akaze',
    label: 'AKAZE',
    kind: 'classical',
    descriptor: 'float · M-LDB',
    one_liner: 'Accelerated KAZE — keypoints in nonlinear scale space.',
    paragraphs: [
      'Where SIFT blurs the image with a Gaussian pyramid, KAZE / AKAZE diffuse it nonlinearly so edges and corners stay sharp at coarse scales. The result is keypoints that sit precisely on object boundaries.',
      'AKAZE describes those points with the Modified-LDB binary descriptor (compared with Hamming) by default — but OpenCV will also expose them as floats if you ask. Typically it matches SIFT on accuracy while being a bit faster.',
    ],
    strengths: [
      'Better localization on edges than SIFT',
      'Reasonably fast with binary descriptors',
      'Free + in OpenCV',
    ],
    weaknesses: [
      'Slower than ORB',
      'No `nfeatures` cap — you get whatever the thresholds give you',
    ],
    origin: 'Alcantarilla et al., "Fast Explicit Diffusion for Accelerated Features in Nonlinear Scale Spaces" (BMVC 2013).',
  },
  {
    id: 'brisk',
    label: 'BRISK',
    kind: 'classical',
    descriptor: 'binary · 512-bit',
    one_liner: 'Multi-scale FAST corners with a rotation-invariant binary descriptor.',
    paragraphs: [
      'BRISK builds a scale-space pyramid and runs FAST on each level, then samples a hand-designed concentric pattern around each keypoint to build a 512-bit binary string. The longer descriptor trades a little speed for noticeably better distinctiveness vs ORB.',
      'It pairs naturally with the LSH FLANN index or BFMatcher with NORM_HAMMING.',
    ],
    strengths: [
      'Multi-scale (more robust to zoom than plain ORB)',
      'Free, in OpenCV out of the box',
      'Rotation invariant',
    ],
    weaknesses: [
      'Slower than ORB — bigger descriptors',
      'Still not as distinctive as deep features under big viewpoint change',
    ],
    origin: 'Leutenegger et al., "BRISK: Binary Robust Invariant Scalable Keypoints" (ICCV 2011).',
  },
  {
    id: 'disk',
    label: 'DISK',
    kind: 'deep',
    descriptor: 'float · 128-d learned',
    one_liner: 'Differentiable, end-to-end learned local features.',
    paragraphs: [
      'DISK trains the entire detect + describe pipeline jointly with a reinforcement-learning style reward, so the network learns which keypoints will actually match well downstream. The output looks just like SIFT — keypoints + 128-d float descriptors — but is dramatically more robust under hard viewpoint, season and illumination changes.',
      'In V-Rush we expose DISK through kornia (which bundles the published weights). The optional `kornia` + `torch` install on the server unlocks it; without those packages the matcher window will fall back to a polite 503.',
    ],
    strengths: [
      'State-of-the-art accuracy on hard image pairs',
      'Drop-in replacement for SIFT — same descriptor shape',
    ],
    weaknesses: [
      'Heavier than classical detectors — needs torch on the server',
      'Slower than ORB / BRISK on CPU',
    ],
    origin: 'Tyszkiewicz, Fua & Trulls, "DISK: Learning Local Features with Policy Gradient" (NeurIPS 2020).',
  },
  {
    id: 'aliked',
    label: 'ALIKED',
    kind: 'deep',
    descriptor: 'float · 128-d learned',
    one_liner: 'Lightweight deep detector with deformable descriptors.',
    paragraphs: [
      'ALIKED ("A Lighter Keypoint and Descriptor Extraction network with Deformable transformation") replaces conventional convolutions with deformable ones so descriptors adapt to local geometry. The N16 variant we ship is intentionally tiny and fast on CPU.',
      'Like DISK, ALIKED runs through kornia in V-Rush. If you self-host with `pip install kornia torch torchvision` it shows up in the matcher window with a "deep" badge.',
    ],
    strengths: [
      'Very small model — fast on CPU',
      'Strong under viewpoint change thanks to deformable kernels',
    ],
    weaknesses: [
      'Still needs torch on the server',
      'Slightly behind DISK on hardest pairs',
    ],
    origin: 'Zhao et al., "ALIKED: A Lighter Keypoint and Descriptor Extraction Network via Deformable Transformation" (T-IM 2023).',
  },
]

const MATCHER_PARAM_DOCS: { key: string; title: string; body: string }[] = [
  {
    key: 'algorithm',
    title: 'Algorithm',
    body: 'Which detector + descriptor to use. Float descriptors (SIFT, AKAZE, DISK, ALIKED) are matched with L2 distance; binary descriptors (ORB, BRISK) use Hamming distance.',
  },
  {
    key: 'matcher',
    title: 'Matcher (BF vs FLANN)',
    body: 'Brute Force checks every descriptor pair (slow but exact). FLANN uses an index — KDTree for float, LSH for binary — much faster on big descriptor sets, with a small approximation cost.',
  },
  {
    key: 'ratio',
    title: "Lowe's ratio test",
    body: "Drop a match unless distance₁ < ratio · distance₂ (best vs second-best neighbour). Lower = stricter / fewer matches. 0.7–0.8 is the classical SIFT range.",
  },
  {
    key: 'top_n',
    title: 'Top matches drawn',
    body: 'Only the N strongest match lines are rendered to keep the picture readable. Stats below still count every kept match.',
  },
  {
    key: 'max_features',
    title: 'Max features per image',
    body: 'Cap on how many keypoints each detector returns. Higher = more potential matches but slower runtime. Has no effect for AKAZE / BRISK (those use built-in thresholds).',
  },
  {
    key: 'ransac',
    title: 'RANSAC homography',
    body: "Fits the best 3×3 perspective transform mapping keypoints in A onto keypoints in B, while rejecting outliers. The reprojection slider is the maximum pixel error allowed for a match to count as an inlier.",
  },
  {
    key: 'overlay',
    title: 'Warped overlay',
    body: 'Once a homography is found, warp image A onto image B and alpha-blend them. A clean overlay = a clean estimate. Needs RANSAC enabled with at least 4 inlier matches.',
  },
]

const MATCHER_RESULT_DOCS: { key: string; title: string; body: string }[] = [
  { key: 'kp', title: 'Keypoints A / B', body: "How many distinctive points the detector found in each image. Detail-poor images (sky, blank walls) usually produce far fewer points." },
  { key: 'raw', title: 'Raw pairs', body: 'Total nearest-neighbour candidates returned by the matcher, before any filtering. Mostly noise on its own.' },
  { key: 'good', title: 'Good matches', body: "Pairs that survived Lowe's ratio test (when enabled). These are the visually plausible correspondences fed into RANSAC." },
  { key: 'inliers', title: 'RANSAC inliers', body: 'Among the good matches, how many actually agree with a single perspective transform. Anything above ~30% usually means a strong match.' },
  { key: 'avg', title: 'Avg distance', body: 'Mean descriptor distance over the kept matches. Lower = more confident matches. Units depend on the descriptor: L2 norm for float, Hamming bits for binary.' },
  { key: 'time', title: 'Compute time', body: 'Server time for detection + matching + RANSAC. Deep detectors are noticeably slower than ORB / BRISK on CPU.' },
  { key: 'H', title: 'Homography matrix', body: "The 3×3 transform mapping A's pixel coordinates onto B's. Multiply by [x, y, 1]ᵀ and divide by the third element to project A → B." },
]

function MatcherReferenceSection() {
  return (
    <section className="ref-page__cat ref-page__cat--matchers">
      <h3 className="ref-page__cat-title">
        Local feature matchers
        <span className="ref-page__cat-sub">
          Used in the <Link to="/match">Matcher</Link> window — not part of the pipeline.
        </span>
      </h3>

      <ul className="ref-page__cards">
        {MATCHER_DOCS.map((m) => (
          <li key={m.id} className="ref-card">
            <div className="ref-card__head">
              <span className="ref-card__label">{m.label}</span>
              <span className={`ref-card__kind ref-card__kind--${m.kind}`}>{m.kind}</span>
            </div>
            <p className="ref-card__id">
              <code>{m.id}</code> · {m.descriptor}
            </p>
            <p className="ref-card__one-liner">{m.one_liner}</p>
            <div className="ref-card__doc">
              {m.paragraphs.map((p, i) => (
                <p key={i} className="ref-card__para">
                  {p}
                </p>
              ))}
            </div>
            <details className="ref-card__details" open={false}>
              <summary>Strengths &amp; weaknesses</summary>
              <div className="ref-card__pros-cons">
                <div>
                  <p className="ref-card__pros-title">Strengths</p>
                  <ul>
                    {m.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="ref-card__cons-title">Weaknesses</p>
                  <ul>
                    {m.weaknesses.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="ref-card__origin">{m.origin}</p>
            </details>
          </li>
        ))}
      </ul>

      <div className="ref-page__matcher-extras">
        <article className="ref-card ref-card--wide">
          <h4 className="ref-card__sub-title">Parameters in the matcher window</h4>
          <dl className="ref-card__param-dl">
            {MATCHER_PARAM_DOCS.map((p) => (
              <div key={p.key}>
                <dt>{p.title}</dt>
                <dd>{p.body}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="ref-card ref-card--wide">
          <h4 className="ref-card__sub-title">What the result stats mean</h4>
          <dl className="ref-card__param-dl">
            {MATCHER_RESULT_DOCS.map((p) => (
              <div key={p.key}>
                <dt>{p.title}</dt>
                <dd>{p.body}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  )
}

export function ReferencePage() {
  const { ops, opsError } = useOutletContext<AppLayoutOutlet>()
  const grouped = useMemo(() => groupByCategory(ops), [ops])

  return (
    <div className="ref-page">
      {opsError && <div className="banner banner--error">{opsError}</div>}

      <section className="ref-page__intro dock-panel">
        <h2 className="ref-page__title">Operation reference</h2>
        <p className="ref-page__lead">
          Each pipeline step maps to a classical OpenCV-style operation on the server. Short labels appear in the palette; here you
          get the full <strong>detail</strong> text, per-parameter hints (same as the pipeline sidebar), and whether the result is a
          normal BGR image (<code>spatial</code>) or a spectrum-style view (<code>spectrum</code>). After you tune JSON in the
          pipeline, use <strong>Copy Python</strong> or <strong>Download .py</strong> on the main page for an OpenCV + NumPy script
          from <code>img</code> to <code>out</code>.
        </p>
        <p className="ref-page__lead">
          Looking for the two-image matcher? Jump to{' '}
          <a href="#local-matchers" className="ref-page__jump">
            Local feature matchers
          </a>{' '}
          for full explanations of SIFT, ORB, AKAZE, BRISK, DISK and ALIKED — plus what every slider and stat in the matcher window
          means.
        </p>
      </section>

      <div className="ref-page__sections">
        <div id="local-matchers">
          <MatcherReferenceSection />
        </div>

        {grouped.map(([cat, list]) => (
          <section key={cat} className="ref-page__cat">
            <h3 className="ref-page__cat-title">{categoryLabel(cat)}</h3>
            <ul className="ref-page__cards">
              {list.map((op) => (
                <li key={op.id} className="ref-card">
                  <div className="ref-card__head">
                    <span className="ref-card__label">{op.label}</span>
                    <span className="ref-card__kind">{op.output_kind}</span>
                  </div>
                  <p className="ref-card__id">
                    <code>{op.id}</code>
                  </p>
                  <div className="ref-card__doc">
                    {op.detail_doc.split(/\n\n+/).map((para, i) => (
                      <p key={i} className="ref-card__para">
                        {para}
                      </p>
                    ))}
                  </div>
                  {Object.keys(op.param_help).length > 0 && (
                    <details className="ref-card__details">
                      <summary>Parameter hints</summary>
                      <dl className="ref-card__param-dl">
                        {Object.entries(op.param_help).map(([k, text]) => (
                          <div key={k}>
                            <dt>
                              <code>{k}</code>
                            </dt>
                            <dd>{text}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
