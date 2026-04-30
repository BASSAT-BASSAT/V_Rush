import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { base64ToFile, processImage } from '../api/cv'
import type { PreloadedImageState } from '../types/cv'
import { isMlOp } from '../cv/mlOps'
import { bboxToCropFraction } from '../lib/bboxCrop'
import { copyTextToClipboard } from '../lib/clipboard'
import { pipelineToPython } from '../lib/pipelineToPython'
import { recordCodeExport, recordStudioImageUpload } from '../lib/recordCodeExport'
import { parseSamParamsJson } from '../lib/samParams'
import { dataUrlToVrushDownloadFile } from '../lib/samMaskCompose'
import { BeforeAfter } from '../components/BeforeAfter'
import { DatasetTray } from '../components/DatasetTray'
import { FileDrop } from '../components/FileDrop'
import { FlyToStack, type FlyToStackHandle } from '../components/FlyToStack'
import { HistogramPanel } from '../components/HistogramPanel'
import { OpPalette } from '../components/OpPalette'
import { PipelineStack } from '../components/PipelineStack'
import { computeImageStats } from '../lib/imageStats'
import { MotionToast } from '../motion'
import type { DetectionItem, ImageStats, OpInfo, PipelineStepUI, ProcessResponse } from '../types/cv'
import type { AppLayoutOutlet } from '../types/layout'

function newKey() {
  return crypto.randomUUID()
}

/** Suggested download filename: extension matches API ``mime`` (same family as uploaded image when possible). */
function downloadNameForProcessedOutput(file: File | null, mime: string): string {
  const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png'
  if (file?.name) {
    const stem = file.name.replace(/\.[^/.]+$/, '')
    if (stem.length > 0) return `${stem}-v-rush${ext}`
  }
  return `v-rush-output${ext}`
}

type WorkspaceTab = 'ops' | 'pipeline'

/**
 * Single persistent shell for /studio and /lab so uploads, pipeline, and results
 * survive switching between Classical and Deep Learning tabs.
 */
export function PipelineWorkspaceLayout() {
  const { ops, opsError, accessToken } = useOutletContext<AppLayoutOutlet>()
  const location = useLocation()
  const mode: 'classical' | 'ml' = location.pathname.startsWith('/lab') ? 'ml' : 'classical'

  const [file, setFile] = useState<File | null>(null)
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null)
  const [steps, setSteps] = useState<PipelineStepUI[]>([])
  const [loadingRun, setLoadingRun] = useState(false)
  const [procError, setProcError] = useState<string | null>(null)
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [afterSrc, setAfterSrc] = useState<string | null>(null)
  /** Composed MobileSAM preview after mask brush / cut — same pixels as the After pane; null when not refining. */
  const [refinedAfterDataUrl, setRefinedAfterDataUrl] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('ops')
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [runningIdx, setRunningIdx] = useState<number | null>(null)
  const flyRef = useRef<FlyToStackHandle | null>(null)
  const [clientBeforeStats, setClientBeforeStats] = useState<ImageStats | null>(null)
  const [histogramOpen, setHistogramOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('vrush-hist-open') !== '0'
    } catch {
      return true
    }
  })
  const [mathOpen, setMathOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('vrush-math-open') === '1'
    } catch {
      return false
    }
  })

  /** Ops shown in the palette for the current route (classical vs ML). */
  const visibleOps = useMemo(
    () => (mode === 'ml' ? ops.filter((o) => isMlOp(o.id)) : ops.filter((o) => !isMlOp(o.id))),
    [ops, mode],
  )

  const opsById = useMemo(() => new Map(ops.map((o) => [o.id, o])), [ops])

  const hasYoloStep = useMemo(() => steps.some((s) => s.op === 'yolo26_detect'), [steps])

  const samStepHandle = useMemo(() => {
    const idx = steps.findIndex((s) => s.op === 'mobile_sam')
    if (idx < 0) return null
    return {
      stepIndex: idx + 1,
      paramsJson: steps[idx].paramsJson,
      key: steps[idx].key,
    }
  }, [steps])

  const samOutputMode = useMemo(() => {
    if (!samStepHandle) return null
    return parseSamParamsJson(samStepHandle.paramsJson).output
  }, [samStepHandle])

  const onChangeSamParams = useCallback(
    (json: string) => {
      if (!samStepHandle) return
      setSteps((prev) =>
        prev.map((s) => (s.key === samStepHandle.key ? { ...s, paramsJson: json } : s)),
      )
    },
    [samStepHandle],
  )

  const assignStudioFile = useCallback(
    (next: File | null) => {
      setFile(next)
      if (next) void recordStudioImageUpload(accessToken)
    },
    [accessToken],
  )

  useEffect(() => {
    const state = location.state as PreloadedImageState | null
    if (!state || !state.base64 || !state.filename) return
    const f = base64ToFile(state.base64, state.filename, state.mime || 'image/png')
    assignStudioFile(f)
    window.history.replaceState({}, '')
  }, [location.state, assignStudioFile])

  useEffect(() => {
    setResult(null)
    setAfterSrc(null)
    setProcError(null)
    setCopyNotice(null)

    if (!file) {
      setBeforeUrl(null)
      setClientBeforeStats(null)
      return
    }
    const u = URL.createObjectURL(file)
    setBeforeUrl(u)
    let cancelled = false
    computeImageStats(file)
      .then((stats) => {
        if (!cancelled) setClientBeforeStats(stats)
      })
      .catch(() => {
        if (!cancelled) setClientBeforeStats(null)
      })
    return () => {
      cancelled = true
      URL.revokeObjectURL(u)
    }
  }, [file])

  useEffect(() => {
    if (!result?.image_base64) {
      setAfterSrc(null)
      setRefinedAfterDataUrl(null)
      return
    }
    const mime = result.mime || 'image/png'
    setAfterSrc(`data:${mime};base64,${result.image_base64}`)
  }, [result])

  useEffect(() => {
    if (!copyNotice || copyNotice.kind !== 'ok') return
    const t = window.setTimeout(() => setCopyNotice(null), 6000)
    return () => window.clearTimeout(t)
  }, [copyNotice])

  useEffect(() => {
    if (!flashKey) return
    const t = window.setTimeout(() => setFlashKey(null), 1600)
    return () => window.clearTimeout(t)
  }, [flashKey])

  const addOp = useCallback(
    (op: OpInfo, sourceRect?: DOMRect, label?: string) => {
      const key = newKey()
      const commit = () => {
        setSteps((prev) => [
          ...prev,
          {
            key,
            op: op.id,
            paramsJson: JSON.stringify(op.default_params, null, 2),
          },
        ])
        setWorkspaceTab('pipeline')
        setFlashKey(key)
      }
      if (sourceRect && flyRef.current) {
        flyRef.current.fly({
          sourceRect,
          label: label ?? op.label ?? op.id,
          onArrive: commit,
        })
      } else {
        commit()
      }
    },
    [],
  )

  const parseSteps = useCallback(() => {
    return steps.map((s) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(s.paramsJson || '{}')
      } catch {
        throw new Error(`Invalid JSON for ${s.op}`)
      }
      const params =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {}
      return { op: s.op, params }
    })
  }, [steps])

  const run = useCallback(async () => {
    if (!file) return
    setLoadingRun(true)
    setProcError(null)
    setCopyNotice(null)
    setResult(null)
    try {
      const pipeline = parseSteps()
      const res = await processImage(file, pipeline, accessToken)
      setResult(res)
    } catch (e) {
      setProcError(e instanceof Error ? e.message : 'Process failed')
    } finally {
      setLoadingRun(false)
    }
  }, [file, parseSteps, accessToken])

  const onMove = useCallback((key: string, dir: -1 | 1) => {
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.key === key)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }, [])

  useEffect(() => {
    if (!loadingRun || steps.length === 0) {
      setRunningIdx(null)
      return
    }
    setRunningIdx(0)
    const tick = window.setInterval(() => {
      setRunningIdx((i) => {
        if (i === null) return 0
        return (i + 1) % steps.length
      })
    }, 360)
    return () => window.clearInterval(tick)
  }, [loadingRun, steps.length])

  const copyPipelineJson = useCallback(async () => {
    setCopyNotice(null)
    try {
      await copyTextToClipboard(JSON.stringify(parseSteps(), null, 2))
      void recordCodeExport(accessToken)
      setCopyNotice({ kind: 'ok', text: 'Pipeline JSON copied to clipboard.' })
    } catch {
      setCopyNotice({ kind: 'error', text: 'Could not copy JSON. Try Download .py or use a secure URL (https).' })
    }
  }, [parseSteps, accessToken])

  const copyPythonExport = useCallback(async () => {
    setCopyNotice(null)
    try {
      const code = pipelineToPython(parseSteps())
      await copyTextToClipboard(code)
      void recordCodeExport(accessToken)
      setCopyNotice({ kind: 'ok', text: 'Python script copied to clipboard. Paste into a .py file.' })
    } catch (e) {
      setCopyNotice({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Could not copy. Use Download .py below.',
      })
    }
  }, [parseSteps, accessToken])

  const downloadPythonFile = useCallback(() => {
    setCopyNotice(null)
    try {
      const code = pipelineToPython(parseSteps())
      const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'v-rush-pipeline.py'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      void recordCodeExport(accessToken)
      setCopyNotice({ kind: 'ok', text: 'Saved v-rush-pipeline.py' })
    } catch (e) {
      setCopyNotice({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Download failed.',
      })
    }
  }, [parseSteps, accessToken])

  const addCropFromDetection = useCallback(
    (d: DetectionItem) => {
      const crop = opsById.get('crop_fraction')
      if (!crop || !result) return
      const fr = bboxToCropFraction(d.bbox, result.width, result.height)
      setSteps((prev) => [
        ...prev,
        {
          key: newKey(),
          op: 'crop_fraction',
          paramsJson: JSON.stringify({ ...crop.default_params, ...fr }, null, 2),
        },
      ])
      setWorkspaceTab('pipeline')
    },
    [opsById, result],
  )

  const onApplyRefinedImage = useCallback(
    (f: File) => {
      assignStudioFile(f)
      setCopyNotice({ kind: 'ok', text: 'Refined image is now the source. Run the pipeline again if needed.' })
    },
    [assignStudioFile],
  )

  const onRefinedAfterDataUrlChange = useCallback((url: string | null) => {
    setRefinedAfterDataUrl(url)
  }, [])

  const downloadPipelineOutputImage = useCallback(async () => {
    if (!result) return
    try {
      if (refinedAfterDataUrl) {
        const f = await dataUrlToVrushDownloadFile(refinedAfterDataUrl, file)
        const url = URL.createObjectURL(f)
        const a = document.createElement('a')
        a.href = url
        a.download = f.name
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return
      }
      if (!afterSrc) return
      const a = document.createElement('a')
      a.href = afterSrc
      a.download = downloadNameForProcessedOutput(file, result.mime)
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      setCopyNotice({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Download failed.',
      })
    }
  }, [result, refinedAfterDataUrl, afterSrc, file])

  const detections = result?.detections ?? []

  return (
    <>
      <nav className="studio-mode" aria-label="Studio mode">
        <NavLink
          to="/studio"
          end
          className={({ isActive }) => `studio-mode__tab${isActive ? ' studio-mode__tab--on' : ''}`}
        >
          <span className="studio-mode__title">Local · Classical CV</span>
          <span className="studio-mode__sub">OpenCV: filtering, edges, morphology, K-Means, Watershed, GrabCut…</span>
        </NavLink>
        <NavLink
          to="/lab"
          end
          className={({ isActive }) => `studio-mode__tab${isActive ? ' studio-mode__tab--on' : ''}`}
        >
          <span className="studio-mode__title">Deep · Learning Lab</span>
          <span className="studio-mode__sub">YOLOv26 detection · MobileSAM segmentation · ONNX Runtime</span>
        </NavLink>
      </nav>

      <FlyToStack ref={flyRef} />

      <MotionToast show={Boolean(opsError)} kind="error">
        {opsError}
      </MotionToast>

      <div className="app__grid">
        <aside className="app__col app__col--side app__col--source">
          <section className="dock-panel">
            <h2 className="dock-panel__title">
              <span className="dock-panel__dot dock-panel__dot--cyan" />
              Source
              {file && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm dock-panel__title-action"
                  onClick={() => assignStudioFile(null)}
                  disabled={loadingRun}
                  title="Clear the current source image"
                >
                  Clear source
                </button>
              )}
            </h2>
            <p className="panel-hint panel-hint--tight">
              Upload a single image or a whole folder — then click any tile below to load it.
            </p>
            <FileDrop onFile={assignStudioFile} disabled={loadingRun} />
            <DatasetTray
              mode="studio"
              onPick={assignStudioFile}
              activeFile={file}
              disabled={loadingRun}
            />
          </section>
        </aside>

        <main className="app__col app__col--main">
          <section className={`dock-panel dock-panel--main${loadingRun ? ' dock-panel--scanning' : ''}`}>
            <h2 className="dock-panel__title dock-panel__title--center">
              <span className="dock-panel__dot dock-panel__dot--violet" />
              Preview
            </h2>
            <div className="pipeline-page__meta">
              <span className="chip">{steps.length} steps</span>
              {loadingRun && (
                <span className="chip chip--accent pipeline-page__running" role="status">
                  <span className="pipeline-page__running-dot" aria-hidden />
                  Running pipeline…
                </span>
              )}
            </div>
            <BeforeAfter
              beforeUrl={beforeUrl}
              afterSrc={afterSrc}
              lastKind={result?.last_output_kind ?? null}
              samStep={
                samStepHandle
                  ? {
                      stepIndex: samStepHandle.stepIndex,
                      paramsJson: samStepHandle.paramsJson,
                      onChangeParamsJson: onChangeSamParams,
                    }
                  : null
              }
              samMaskPngBase64={result?.sam_mask_png_base64 ?? null}
              samSubjectPngBase64={result?.sam_subject_png_base64 ?? null}
              samOutputMode={samOutputMode}
              resultWidth={result?.width ?? null}
              resultHeight={result?.height ?? null}
              sourceFile={file}
              onApplyRefinedImage={onApplyRefinedImage}
              onRefinedAfterDataUrlChange={onRefinedAfterDataUrlChange}
            />

            <MotionToast show={Boolean(procError)} kind="error">
              {procError}
            </MotionToast>
            <MotionToast
              show={Boolean(result && result.warnings.length > 0)}
              kind="warn"
            >
              <strong>Warnings</strong>
              <ul>
                {result?.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </MotionToast>
            <MotionToast
              show={Boolean(copyNotice)}
              kind={copyNotice?.kind === 'ok' ? 'ok' : 'error'}
              role="status"
            >
              {copyNotice?.text}
            </MotionToast>

            <div className="toolbar toolbar--primary">
              <button
                type="button"
                className={`btn btn--primary${loadingRun ? ' btn--loading' : ''}`}
                disabled={!file || loadingRun}
                onClick={() => void run()}
              >
                {loadingRun ? 'Running…' : 'Run pipeline'}
              </button>
              <button type="button" className="btn" disabled={steps.length === 0} onClick={() => setSteps([])}>
                Clear
              </button>
              {result && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!afterSrc && !refinedAfterDataUrl}
                  onClick={() => void downloadPipelineOutputImage()}
                >
                  Download image
                </button>
              )}
              <details className="export-menu">
                <summary className="export-menu__summary btn btn--ghost">Export pipeline</summary>
                <div className="export-menu__panel">
                  <button
                    type="button"
                    className="export-menu__item"
                    disabled={steps.length === 0}
                    onClick={() => void copyPipelineJson()}
                  >
                    Copy JSON
                  </button>
                  <button
                    type="button"
                    className="export-menu__item"
                    disabled={steps.length === 0}
                    onClick={() => void copyPythonExport()}
                    title="OpenCV + NumPy; YOLO steps need ultralytics manually."
                  >
                    Copy Python
                  </button>
                  <button type="button" className="export-menu__item" disabled={steps.length === 0} onClick={downloadPythonFile}>
                    Download .py
                  </button>
                </div>
              </details>
            </div>

            {detections.length > 0 && (
              <div className="detections-panel">
                <h3 className="detections-panel__title">Detections (last run)</h3>
                <p className="detections-panel__hint">
                  Boxes are in pixel coordinates for the image returned above (after your pipeline).{' '}
                  <Link to="/reference">Reference</Link> lists COCO class names.
                </p>
                <ul className="detections-panel__list">
                  {detections.map((d, i) => (
                    <li key={`${d.label}-${i}-${d.bbox.join(',')}`} className="detections-panel__row">
                      <span className="detections-panel__label">
                        {d.label}{' '}
                        <span className="detections-panel__conf">{(d.confidence * 100).toFixed(1)}%</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => addCropFromDetection(d)}
                        title="Append a crop_fraction step using this box"
                      >
                        Use bbox for crop
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details
              className="hist-panel-wrap"
              open={histogramOpen}
              onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open
                setHistogramOpen(isOpen)
                try {
                  window.localStorage.setItem('vrush-hist-open', isOpen ? '1' : '0')
                } catch {
                  // ignore storage errors
                }
              }}
            >
              <summary className="hist-panel-wrap__summary">Histogram &amp; pixel stats (optional)</summary>
              <HistogramPanel
                before={result?.before_stats ?? clientBeforeStats}
                after={result?.after_stats ?? null}
                afterEmptyHint={
                  file
                    ? 'Run the pipeline to compare the processed distribution here.'
                    : 'Upload an image, add steps, and run the pipeline to see the after-histogram.'
                }
              />
            </details>
          </section>
        </main>

        <aside className="app__col app__col--side app__col--pipeline">
          <section className="dock-panel dock-panel--workspace">
            <div className="workspace-tabs" aria-label="Pipeline workspace">
              <button
                type="button"
                className={`workspace-tabs__btn${workspaceTab === 'ops' ? ' workspace-tabs__btn--on' : ''}`}
                aria-pressed={workspaceTab === 'ops'}
                onClick={() => setWorkspaceTab('ops')}
              >
                Add ops
              </button>
              <button
                type="button"
                className={`workspace-tabs__btn${workspaceTab === 'pipeline' ? ' workspace-tabs__btn--on' : ''}${
                  flashKey && workspaceTab !== 'pipeline' ? ' workspace-tabs__btn--pulse' : ''
                }`}
                aria-pressed={workspaceTab === 'pipeline'}
                onClick={() => setWorkspaceTab('pipeline')}
              >
                Pipeline
                <span
                  className={`workspace-tabs__count${steps.length > 0 ? ' workspace-tabs__count--on' : ''}`}
                  aria-label={`${steps.length} step${steps.length === 1 ? '' : 's'}`}
                >
                  {steps.length}
                </span>
              </button>
            </div>
            {workspaceTab === 'ops' && ops.length > 0 && (
              <OpPalette ops={visibleOps} onAdd={addOp} disabled={loadingRun || !file} embedded />
            )}
            {workspaceTab === 'ops' && ops.length === 0 && <p className="panel-hint">Loading operations…</p>}
            {workspaceTab === 'pipeline' && (
              <>
                {mode === 'ml' && (
                  <p className="panel-hint panel-hint--tight">
                    <strong>Deep mode:</strong> YOLOv26 and MobileSAM run on the image <em>after</em> any preprocessing
                    you stack above them. Switch to{' '}
                    <Link to="/studio">Local</Link> for filtering, edges, morphology, and K-Means / Watershed / GrabCut.
                    {' '}
                    After MobileSAM, use <strong>Manual segmentation</strong>: draw a black loop, then{' '}
                    <strong>Cut outside line</strong> or <strong>Cut inside line</strong> to trim the mask;{' '}
                    <strong>Use as source</strong> continues with the refined result (same file extension as your upload).
                  </p>
                )}
                {hasYoloStep && (
                  <p className="panel-hint panel-hint--tight">
                    <strong>YOLO</strong> runs on the image <em>after</em> the steps above it. Put preprocessing first to detect on
                    the processed image.
                  </p>
                )}
                <div className="toolbar">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setMathOpen((prev) => {
                        const next = !prev
                        try {
                          window.localStorage.setItem('vrush-math-open', next ? '1' : '0')
                        } catch {
                          // ignore storage errors
                        }
                        return next
                      })
                    }}
                  >
                    {mathOpen ? 'Hide math' : 'Show math'}
                  </button>
                </div>
                <PipelineStack
                  steps={steps}
                  opsById={opsById}
                  showMath={mathOpen}
                  flashKey={flashKey}
                  runningIdx={runningIdx}
                  onChangeParams={(key, json) => setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, paramsJson: json } : s)))}
                  onRemove={(key) => setSteps((prev) => prev.filter((s) => s.key !== key))}
                  onMove={onMove}
                  onReorder={setSteps}
                />
                <button
                  type="button"
                  className="workspace-tabs__add-more"
                  onClick={() => setWorkspaceTab('ops')}
                >
                  + Add another op
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
      {/* Nested /studio | /lab match only — keeps parent mounted for shared state */}
      <Outlet />
    </>
  )
}
