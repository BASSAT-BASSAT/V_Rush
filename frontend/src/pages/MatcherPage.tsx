import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import { base64ToFile, fetchMatcherCapabilities, matchImages } from '../api/cv'
import { FileDrop } from '../components/FileDrop'
import type {
  MatchOptions,
  MatchResponse,
  MatcherAlgo,
  MatcherAlgoInfo,
  MatcherCapabilities,
  MatcherKind,
  PreloadedImageState,
  PreloadedPairState,
} from '../types/cv'
import type { AppLayoutOutlet } from '../types/layout'

const FALLBACK_ALGOS: MatcherAlgoInfo[] = [
  {
    id: 'sift',
    label: 'SIFT',
    kind: 'classical',
    descriptor: 'float (128-d)',
    sub: 'Scale-Invariant Feature Transform — gold standard, robust to scale and rotation.',
  },
  {
    id: 'orb',
    label: 'ORB',
    kind: 'classical',
    descriptor: 'binary (256-bit)',
    sub: 'Oriented FAST + rotated BRIEF — extremely fast, weaker under big scale changes.',
  },
  {
    id: 'akaze',
    label: 'AKAZE',
    kind: 'classical',
    descriptor: 'float (M-LDB)',
    sub: 'Accelerated KAZE in nonlinear scale space — sharper on edges than SIFT.',
  },
  {
    id: 'brisk',
    label: 'BRISK',
    kind: 'classical',
    descriptor: 'binary (512-bit)',
    sub: 'Multi-scale FAST corners with rotation-invariant binary descriptor.',
  },
  {
    id: 'disk',
    label: 'DISK',
    kind: 'deep',
    descriptor: 'float (128-d, learned)',
    sub: 'Learned local features — strong under heavy viewpoint / illumination change.',
  },
  {
    id: 'aliked',
    label: 'ALIKED',
    kind: 'deep',
    descriptor: 'float (128-d, learned)',
    sub: 'Lighter deep detector with deformable descriptors, fast on CPU.',
  },
]

const MATCHERS: { id: MatcherKind; label: string; sub: string }[] = [
  { id: 'bf', label: 'Brute Force', sub: 'Exact nearest neighbour search' },
  { id: 'flann', label: 'FLANN', sub: 'Approximate — KDTree (float) or LSH (binary)' },
]

const PARAM_HELP: Record<string, { title: string; body: string }> = {
  algorithm: {
    title: 'Algorithm',
    body:
      'How keypoints are detected and described. Float descriptors (SIFT, AKAZE, DISK, ALIKED) compare with L2 distance; binary descriptors (ORB, BRISK) compare with Hamming distance. Deep methods need the kornia + torch optional install.',
  },
  matcher: {
    title: 'Matcher',
    body:
      'Brute Force checks every descriptor pair (slow but exact). FLANN uses an index — KDTree for float, LSH for binary — so it is much faster on big descriptor sets at the cost of a few approximate matches.',
  },
  ratio: {
    title: "Lowe's ratio test",
    body:
      'Drop a match unless the best neighbour is clearly better than the second-best (distance₁ < ratio · distance₂). Lower ratio = stricter (fewer but cleaner matches). 0.7–0.8 is the classic SIFT range.',
  },
  top_n: {
    title: 'Top matches drawn',
    body:
      'Only the N strongest match lines are rendered to keep the picture readable. Stats below still count every kept match.',
  },
  max_features: {
    title: 'Max features per image',
    body:
      'Cap on how many keypoints each detector returns. Higher = more potential matches, slower runtime. Has no effect for AKAZE/BRISK (those use built-in thresholds).',
  },
  ransac: {
    title: 'RANSAC homography',
    body:
      'Fit the best 3×3 perspective transform that maps keypoints in A onto keypoints in B, while rejecting outliers. The reprojection slider is the maximum pixel error allowed for a match to count as an inlier.',
  },
  overlay: {
    title: 'Warped overlay',
    body:
      'Once a homography is found, warp image A onto image B and alpha-blend them. A clean overlay = a clean estimate. Needs RANSAC enabled and at least 4 inlier matches.',
  },
}

const RESULT_HELP: { key: string; title: string; body: string }[] = [
  {
    key: 'kp',
    title: 'Keypoints A / B',
    body:
      "How many distinctive points the detector found in each image. Detail-poor images (sky, blank walls) usually produce far fewer points.",
  },
  {
    key: 'raw',
    title: 'Raw pairs',
    body:
      'Total nearest-neighbour candidates returned by the matcher, before any filtering. This is mostly noise on its own.',
  },
  {
    key: 'good',
    title: 'Good matches',
    body:
      "Pairs that survived Lowe's ratio test (when enabled). These are the visually plausible correspondences fed into RANSAC.",
  },
  {
    key: 'inliers',
    title: 'RANSAC inliers',
    body:
      'Among the good matches, how many actually agree with a single perspective transform. The percentage is a quick "did the geometry lock in?" gauge — anything above ~30% is usually a strong match.',
  },
  {
    key: 'avg',
    title: 'Avg distance',
    body:
      'Mean descriptor distance over the kept matches. Lower = more confident matches. Units depend on the descriptor: L2 norm for float, Hamming bits for binary.',
  },
  {
    key: 'time',
    title: 'Compute time',
    body:
      'Server time for detection + matching + RANSAC. Deep detectors (DISK, ALIKED) are noticeably slower than ORB/BRISK on CPU.',
  },
  {
    key: 'H',
    title: 'Homography matrix',
    body:
      "The 3×3 transform that maps A's pixel coordinates onto B's. Multiply it by a homogeneous point [x, y, 1]ᵀ and divide by the third element to project A → B.",
  },
]

const DEFAULT_OPTS: MatchOptions = {
  algo: 'sift',
  matcher: 'bf',
  use_ratio_test: true,
  ratio: 0.75,
  top_n: 50,
  max_features: 2000,
  estimate_homography: true,
  ransac_thresh: 4.0,
  overlay: false,
  overlay_alpha: 0.5,
}

type Slot = 'A' | 'B'
type ResultTab = 'matches' | 'overlay'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="matcher__stat">
      <span className="matcher__stat-label">{label}</span>
      <span className="matcher__stat-value">{value}</span>
      {hint && <span className="matcher__stat-hint">{hint}</span>}
    </div>
  )
}

/** Tiny inline disclosure that explains a control or a result stat. */
function HelpTip({ label = 'Help', body }: { label?: string; body: string }) {
  return (
    <details className="matcher__help">
      <summary className="matcher__help-summary">
        <span className="matcher__help-icon" aria-hidden>
          ?
        </span>
        <span>{label}</span>
      </summary>
      <p className="matcher__help-body">{body}</p>
    </details>
  )
}

export function MatcherPage() {
  const { accessToken } = useOutletContext<AppLayoutOutlet>()
  const location = useLocation()

  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [previewA, setPreviewA] = useState<string | null>(null)
  const [previewB, setPreviewB] = useState<string | null>(null)

  const [opts, setOpts] = useState<MatchOptions>(DEFAULT_OPTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MatchResponse | null>(null)
  const [tab, setTab] = useState<ResultTab>('matches')
  const [animKey, setAnimKey] = useState(0)
  const lastDropTarget = useRef<Slot | null>(null)

  // ----- backend capabilities (which detectors are actually live) ---------
  const [caps, setCaps] = useState<MatcherCapabilities | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchMatcherCapabilities(accessToken)
      .then((c) => {
        if (!cancelled) setCaps(c)
      })
      .catch(() => {
        // fall back to the static catalog (e.g. while offline)
        if (!cancelled) {
          setCaps({ algos: FALLBACK_ALGOS, deep_available: false, deep_reason: '' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const algos = caps?.algos ?? FALLBACK_ALGOS
  const deepAvailable = caps?.deep_available ?? false
  const deepReason = caps?.deep_reason ?? ''
  const selectedAlgo = useMemo(
    () => algos.find((a) => a.id === opts.algo) ?? algos[0],
    [algos, opts.algo],
  )

  // ----- preloaded image(s) (from Datasets / cross-page hand-off) ----------
  useEffect(() => {
    const state = location.state as
      | (PreloadedImageState & Partial<PreloadedPairState>)
      | PreloadedPairState
      | null
    if (!state) return

    const pair = state as PreloadedPairState
    if (pair.a && pair.b) {
      setFileA(base64ToFile(pair.a.base64, pair.a.filename, pair.a.mime || 'image/png'))
      setFileB(base64ToFile(pair.b.base64, pair.b.filename, pair.b.mime || 'image/png'))
      window.history.replaceState({}, '')
      return
    }

    const single = state as PreloadedImageState
    if (single.base64 && single.filename) {
      const file = base64ToFile(
        single.base64,
        single.filename,
        single.mime || 'image/png',
      )
      if (single.slot === 'B') setFileB(file)
      else setFileA(file)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  // ----- preview URL lifecycle --------------------------------------------
  useEffect(() => {
    if (!fileA) {
      setPreviewA(null)
      return
    }
    const u = URL.createObjectURL(fileA)
    setPreviewA(u)
    return () => URL.revokeObjectURL(u)
  }, [fileA])

  useEffect(() => {
    if (!fileB) {
      setPreviewB(null)
      return
    }
    const u = URL.createObjectURL(fileB)
    setPreviewB(u)
    return () => URL.revokeObjectURL(u)
  }, [fileB])

  // ----- run matcher ------------------------------------------------------
  const run = useCallback(async () => {
    if (!fileA || !fileB) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await matchImages(fileA, fileB, opts, accessToken)
      setResult(res)
      setTab(opts.overlay && res.overlay_image_base64 ? 'matches' : 'matches')
      setAnimKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Match failed')
    } finally {
      setLoading(false)
    }
  }, [fileA, fileB, opts, accessToken])

  const matchSrc = useMemo(
    () => (result?.match_image_base64 ? `data:${result.mime};base64,${result.match_image_base64}` : null),
    [result],
  )
  const overlaySrc = useMemo(
    () =>
      result?.overlay_image_base64
        ? `data:${result.mime};base64,${result.overlay_image_base64}`
        : null,
    [result],
  )

  const update = <K extends keyof MatchOptions>(key: K, value: MatchOptions[K]) =>
    setOpts((o) => ({ ...o, [key]: value }))

  const algoIsBinary = opts.algo === 'orb' || opts.algo === 'brisk'

  const downloadMatch = useCallback(() => {
    if (!matchSrc) return
    const a = document.createElement('a')
    a.href = matchSrc
    a.download = `v-rush-matches-${opts.algo}-${opts.matcher}.png`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [matchSrc, opts.algo, opts.matcher])

  const onDrop = (slot: Slot) => (file: File) => {
    lastDropTarget.current = slot
    if (slot === 'A') setFileA(file)
    else setFileB(file)
  }

  return (
    <div className="matcher">
      <header className="matcher__hero">
        <span className="matcher__eyebrow">Local feature matchers</span>
        <h1 className="matcher__title">
          See how <span className="matcher__title-accent">two images line up</span>
        </h1>
        <p className="matcher__lede">
          Drop two pictures. Pick a detector — SIFT, ORB, AKAZE, BRISK — then watch their
          keypoints find each other across both frames. Run RANSAC to keep only the
          geometrically consistent matches and warp one image onto the other.
        </p>
      </header>

      <section className="matcher__sources">
        <div className="matcher__slot">
          <div className="matcher__slot-head">
            <span className="matcher__slot-tag matcher__slot-tag--a">A</span>
            <p className="matcher__slot-name">Image A</p>
          </div>
          {previewA ? (
            <div className="matcher__preview">
              <img src={previewA} alt="Source A" />
              <button
                type="button"
                className="btn btn--ghost btn--sm matcher__preview-clear"
                onClick={() => setFileA(null)}
              >
                Replace
              </button>
            </div>
          ) : (
            <FileDrop onFile={onDrop('A')} disabled={loading} />
          )}
        </div>

        <div className="matcher__slot">
          <div className="matcher__slot-head">
            <span className="matcher__slot-tag matcher__slot-tag--b">B</span>
            <p className="matcher__slot-name">Image B</p>
          </div>
          {previewB ? (
            <div className="matcher__preview">
              <img src={previewB} alt="Source B" />
              <button
                type="button"
                className="btn btn--ghost btn--sm matcher__preview-clear"
                onClick={() => setFileB(null)}
              >
                Replace
              </button>
            </div>
          ) : (
            <FileDrop onFile={onDrop('B')} disabled={loading} />
          )}
        </div>
      </section>

      <section className="matcher__controls dock-panel">
        <h2 className="dock-panel__title">
          <span className="dock-panel__dot dock-panel__dot--violet" />
          Detector & matcher
        </h2>

        <div className="matcher__group">
          <div className="matcher__group-row">
            <p className="matcher__group-label">Algorithm</p>
            <HelpTip label="What is this?" body={PARAM_HELP.algorithm.body} />
          </div>
          <div className="matcher__pills">
            {algos.map((a) => {
              const isDeep = a.kind === 'deep'
              const disabled = loading || (isDeep && !deepAvailable)
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`matcher__pill${opts.algo === a.id ? ' matcher__pill--on' : ''}${isDeep ? ' matcher__pill--deep' : ''}`}
                  onClick={() => update('algo', a.id)}
                  disabled={disabled}
                  title={isDeep && !deepAvailable ? deepReason : a.sub}
                >
                  <span className="matcher__pill-row">
                    <span className="matcher__pill-name">{a.label}</span>
                    <span className={`matcher__pill-badge matcher__pill-badge--${a.kind}`}>
                      {a.kind === 'deep' ? 'deep' : 'classical'}
                    </span>
                  </span>
                  <span className="matcher__pill-sub">{a.sub}</span>
                  <span className="matcher__pill-meta">{a.descriptor}</span>
                </button>
              )
            })}
          </div>
          {!deepAvailable && (
            <p className="matcher__group-hint matcher__group-hint--warn">
              DISK and ALIKED are deep-learning matchers and need
              <code> kornia + torch </code>
              installed on the server. The rest still work.
            </p>
          )}
        </div>

        <div className="matcher__group">
          <div className="matcher__group-row">
            <p className="matcher__group-label">Matcher</p>
            <HelpTip label="What is this?" body={PARAM_HELP.matcher.body} />
          </div>
          <div className="matcher__pills matcher__pills--two">
            {MATCHERS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`matcher__pill${opts.matcher === m.id ? ' matcher__pill--on' : ''}`}
                onClick={() => update('matcher', m.id)}
                disabled={loading}
              >
                <span className="matcher__pill-name">{m.label}</span>
                <span className="matcher__pill-sub">{m.sub}</span>
              </button>
            ))}
          </div>
          <p className="matcher__group-hint">
            {selectedAlgo?.label}: {selectedAlgo?.descriptor} ·{' '}
            {algoIsBinary
              ? 'Hamming distance · LSH index when FLANN is selected.'
              : 'L2 distance · KDTree index when FLANN is selected.'}
          </p>
        </div>

        <div className="matcher__sliders">
          <div className="matcher__slider">
            <label>
              <span className="matcher__slider-head">
                <span>Lowe's ratio test</span>
                <input
                  type="checkbox"
                  checked={opts.use_ratio_test}
                  onChange={(e) => update('use_ratio_test', e.target.checked)}
                  disabled={loading}
                />
              </span>
              <input
                type="range"
                min={0.5}
                max={0.95}
                step={0.01}
                value={opts.ratio}
                onChange={(e) => update('ratio', Number.parseFloat(e.target.value))}
                disabled={loading || !opts.use_ratio_test}
              />
              <span className="matcher__slider-value">ratio &lt; {opts.ratio.toFixed(2)}</span>
            </label>
            <HelpTip body={PARAM_HELP.ratio.body} />
          </div>

          <div className="matcher__slider">
            <label>
              <span className="matcher__slider-head">
                <span>Top matches drawn</span>
              </span>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={opts.top_n}
                onChange={(e) => update('top_n', Number.parseInt(e.target.value, 10))}
                disabled={loading}
              />
              <span className="matcher__slider-value">{opts.top_n} lines</span>
            </label>
            <HelpTip body={PARAM_HELP.top_n.body} />
          </div>

          <div className="matcher__slider">
            <label>
              <span className="matcher__slider-head">
                <span>Max features per image</span>
              </span>
              <input
                type="range"
                min={500}
                max={10000}
                step={100}
                value={opts.max_features}
                onChange={(e) => update('max_features', Number.parseInt(e.target.value, 10))}
                disabled={loading}
              />
              <span className="matcher__slider-value">{opts.max_features.toLocaleString()}</span>
            </label>
            <HelpTip body={PARAM_HELP.max_features.body} />
          </div>

          <div className="matcher__slider">
            <label>
              <span className="matcher__slider-head">
                <span>RANSAC homography</span>
                <input
                  type="checkbox"
                  checked={opts.estimate_homography}
                  onChange={(e) => update('estimate_homography', e.target.checked)}
                  disabled={loading}
                />
              </span>
              <input
                type="range"
                min={0.5}
                max={20}
                step={0.5}
                value={opts.ransac_thresh}
                onChange={(e) => update('ransac_thresh', Number.parseFloat(e.target.value))}
                disabled={loading || !opts.estimate_homography}
              />
              <span className="matcher__slider-value">
                reproj &le; {opts.ransac_thresh.toFixed(1)} px
              </span>
            </label>
            <HelpTip body={PARAM_HELP.ransac.body} />
          </div>

          <div className="matcher__slider">
            <label>
              <span className="matcher__slider-head">
                <span>Warped overlay</span>
                <input
                  type="checkbox"
                  checked={opts.overlay}
                  onChange={(e) => update('overlay', e.target.checked)}
                  disabled={loading || !opts.estimate_homography}
                />
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={opts.overlay_alpha}
                onChange={(e) => update('overlay_alpha', Number.parseFloat(e.target.value))}
                disabled={loading || !opts.overlay}
              />
              <span className="matcher__slider-value">A blend {Math.round(opts.overlay_alpha * 100)}%</span>
            </label>
            <HelpTip body={PARAM_HELP.overlay.body} />
          </div>
        </div>

        <div className="matcher__actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={!fileA || !fileB || loading}
            onClick={() => void run()}
          >
            {loading ? 'Matching…' : 'Run matcher'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={() => {
              setResult(null)
              setError(null)
              setOpts(DEFAULT_OPTS)
            }}
          >
            Reset
          </button>
        </div>
      </section>

      {error && <div className="banner banner--error matcher__banner">{error}</div>}
      {result && result.warnings.length > 0 && (
        <div className="banner banner--warn matcher__banner">
          <strong>Heads up</strong>
          <ul>
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <section className="matcher__result dock-panel">
          <div className="matcher__result-head">
            <h2 className="dock-panel__title dock-panel__title--center">
              <span className="dock-panel__dot dock-panel__dot--cyan" />
              Matches
            </h2>
            {overlaySrc && (
              <div className="matcher__tabs">
                <button
                  type="button"
                  className={`matcher__tab${tab === 'matches' ? ' matcher__tab--on' : ''}`}
                  onClick={() => setTab('matches')}
                >
                  Side-by-side
                </button>
                <button
                  type="button"
                  className={`matcher__tab${tab === 'overlay' ? ' matcher__tab--on' : ''}`}
                  onClick={() => setTab('overlay')}
                >
                  Warped overlay
                </button>
              </div>
            )}
          </div>

          <div className="matcher__canvas" key={animKey}>
            {tab === 'matches' && matchSrc && (
              <>
                <img src={matchSrc} alt="Matches" className="matcher__canvas-img" />
                <span className="matcher__sweep" aria-hidden />
              </>
            )}
            {tab === 'overlay' && overlaySrc && (
              <img src={overlaySrc} alt="Warped overlay" className="matcher__canvas-img" />
            )}
          </div>

          <div className="matcher__stats">
            <StatCard
              label="Keypoints A"
              value={result.stats.keypoints_a.toLocaleString()}
              hint={`Algo · ${result.stats.algo.toUpperCase()}`}
            />
            <StatCard label="Keypoints B" value={result.stats.keypoints_b.toLocaleString()} />
            <StatCard label="Raw pairs" value={result.stats.raw_matches.toLocaleString()} />
            <StatCard
              label="Good matches"
              value={result.stats.good_matches.toLocaleString()}
              hint={`Matcher · ${result.stats.matcher.toUpperCase()}`}
            />
            <StatCard
              label="RANSAC inliers"
              value={`${result.stats.inliers.toLocaleString()}`}
              hint={`${(result.stats.inlier_ratio * 100).toFixed(1)}% of good`}
            />
            <StatCard
              label="Avg distance"
              value={result.stats.avg_distance.toFixed(2)}
              hint={algoIsBinary ? 'Hamming bits' : 'L2 norm'}
            />
            <StatCard label="Compute time" value={`${result.stats.elapsed_ms.toFixed(1)} ms`} />
          </div>

          {result.homography && (
            <details className="matcher__h-panel">
              <summary>Homography matrix (3×3)</summary>
              <pre className="matcher__h-grid">
                {result.homography
                  .map((row) => row.map((v) => v.toFixed(4).padStart(10, ' ')).join('  '))
                  .join('\n')}
              </pre>
            </details>
          )}

          <details className="matcher__legend">
            <summary>What do these results mean?</summary>
            <div className="matcher__legend-grid">
              {RESULT_HELP.map((r) => (
                <div key={r.key} className="matcher__legend-item">
                  <p className="matcher__legend-title">{r.title}</p>
                  <p className="matcher__legend-body">{r.body}</p>
                </div>
              ))}
            </div>
          </details>

          <div className="matcher__actions matcher__actions--end">
            {matchSrc && (
              <button type="button" className="btn btn--ghost" onClick={downloadMatch}>
                Download PNG
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
