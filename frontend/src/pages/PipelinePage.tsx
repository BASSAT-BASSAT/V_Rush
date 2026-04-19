import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useOutletContext } from 'react-router-dom'
import { processImage } from '../api/cv'
import { isMlOp } from '../cv/mlOps'
import { bboxToCropFraction } from '../lib/bboxCrop'
import { copyTextToClipboard } from '../lib/clipboard'
import { pipelineToPython } from '../lib/pipelineToPython'
import { recordCodeExport } from '../lib/recordCodeExport'
import { BeforeAfter } from '../components/BeforeAfter'
import { FileDrop } from '../components/FileDrop'
import { HistogramPanel } from '../components/HistogramPanel'
import { OpPalette } from '../components/OpPalette'
import { PipelineStack } from '../components/PipelineStack'
import { computeImageStats } from '../lib/imageStats'
import type { DetectionItem, ImageStats, OpInfo, PipelineStepUI, ProcessResponse } from '../types/cv'
import type { AppLayoutOutlet } from '../types/layout'

function newKey() {
  return crypto.randomUUID()
}

type WorkspaceTab = 'ops' | 'pipeline'

export function PipelinePage() {
  const { ops, opsError, accessToken } = useOutletContext<AppLayoutOutlet>()
  const location = useLocation()
  const mode: 'classical' | 'ml' = location.pathname.startsWith('/lab') ? 'ml' : 'classical'

  const [file, setFile] = useState<File | null>(null)
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null)
  const [steps, setSteps] = useState<PipelineStepUI[]>([])
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [loadingRun, setLoadingRun] = useState(false)
  const [procError, setProcError] = useState<string | null>(null)
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [afterSrc, setAfterSrc] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('ops')
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [clientBeforeStats, setClientBeforeStats] = useState<ImageStats | null>(null)
  const [histogramOpen, setHistogramOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('vrush-hist-open') !== '0'
    } catch {
      return true
    }
  })

  /** Ops shown in the palette for the current route (classical vs ML). */
  const visibleOps = useMemo(
    () => (mode === 'ml' ? ops.filter((o) => isMlOp(o.id)) : ops.filter((o) => !isMlOp(o.id))),
    [ops, mode],
  )

  /** Full op lookup (by id) — always covers every op so rendering existing steps still works
   *  if a user somehow has cross-mode steps (e.g. pasted JSON from the other route). */
  const opsById = useMemo(() => new Map(ops.map((o) => [o.id, o])), [ops])

  const hasYoloStep = useMemo(() => steps.some((s) => s.op === 'yolo26_detect'), [steps])

  /** The first mobile_sam step (if any) — drives the interactive overlay on the preview. */
  const samStepHandle = useMemo(() => {
    const idx = steps.findIndex((s) => s.op === 'mobile_sam')
    if (idx < 0) return null
    return {
      stepIndex: idx + 1,
      paramsJson: steps[idx].paramsJson,
      key: steps[idx].key,
    }
  }, [steps])

  const onChangeSamParams = useCallback(
    (json: string) => {
      if (!samStepHandle) return
      setSteps((prev) =>
        prev.map((s) => (s.key === samStepHandle.key ? { ...s, paramsJson: json } : s)),
      )
    },
    [samStepHandle],
  )

  useEffect(() => {
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

  // Clear the "just added" highlight after the flash animation has played.
  useEffect(() => {
    if (!flashKey) return
    const t = window.setTimeout(() => setFlashKey(null), 1600)
    return () => window.clearTimeout(t)
  }, [flashKey])

  const addOp = useCallback((op: OpInfo) => {
    const key = newKey()
    setSteps((prev) => [
      ...prev,
      {
        key,
        op: op.id,
        paramsJson: JSON.stringify(op.default_params, null, 2),
      },
    ])
    // Switch to the pipeline view so the user immediately sees the step they
    // just added (instead of staying on the ops tab with no feedback).
    setWorkspaceTab('pipeline')
    setFlashKey(key)
  }, [])

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

  const onDropOn = useCallback(
    (targetKey: string) => {
      if (!dragKey || dragKey === targetKey) return
      setSteps((prev) => {
        const di = prev.findIndex((s) => s.key === dragKey)
        const ti = prev.findIndex((s) => s.key === targetKey)
        if (di < 0 || ti < 0) return prev
        const next = [...prev]
        const [item] = next.splice(di, 1)
        next.splice(ti, 0, item)
        return next
      })
      setDragKey(null)
    },
    [dragKey],
  )

  const copyPipelineJson = useCallback(async () => {
    setCopyNotice(null)
    try {
      await copyTextToClipboard(JSON.stringify(parseSteps(), null, 2))
      setCopyNotice({ kind: 'ok', text: 'Pipeline JSON copied to clipboard.' })
    } catch {
      setCopyNotice({ kind: 'err', text: 'Could not copy JSON. Try Download .py or use a secure URL (https).' })
    }
  }, [parseSteps])

  const copyPythonExport = useCallback(async () => {
    setCopyNotice(null)
    try {
      const code = pipelineToPython(parseSteps())
      await copyTextToClipboard(code)
      void recordCodeExport()
      setCopyNotice({ kind: 'ok', text: 'Python script copied to clipboard. Paste into a .py file.' })
    } catch (e) {
      setCopyNotice({
        kind: 'err',
        text: e instanceof Error ? e.message : 'Could not copy. Use Download .py below.',
      })
    }
  }, [parseSteps])

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
      void recordCodeExport()
      setCopyNotice({ kind: 'ok', text: 'Saved v-rush-pipeline.py' })
    } catch (e) {
      setCopyNotice({
        kind: 'err',
        text: e instanceof Error ? e.message : 'Download failed.',
      })
    }
  }, [parseSteps])

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

  const detections = result?.detections ?? []

  return (
    <>
      <nav className="studio-mode" aria-label="Studio mode">
        <NavLink
          to="/studio"
          end
          className={({ isActive }) => `studio-mode__tab${isActive ? ' studio-mode__tab--on' : ''}`}
        >
          <span className="studio-mode__title">Classical CV Studio</span>
          <span className="studio-mode__sub">OpenCV: filtering, edges, morphology, K-Means, Watershed, GrabCut…</span>
        </NavLink>
        <NavLink
          to="/lab"
          end
          className={({ isActive }) => `studio-mode__tab${isActive ? ' studio-mode__tab--on' : ''}`}
        >
          <span className="studio-mode__title">Deep Learning Lab</span>
          <span className="studio-mode__sub">YOLOv26 detection · MobileSAM segmentation · ONNX Runtime</span>
        </NavLink>
      </nav>

      {opsError && <div className="banner banner--error">{opsError}</div>}

      <div className="app__grid">
        <aside className="app__col app__col--side app__col--source">
          <section className="dock-panel">
            <h2 className="dock-panel__title">
              <span className="dock-panel__dot dock-panel__dot--cyan" />
              Source
            </h2>
            <p className="panel-hint panel-hint--tight">
              Upload an image, build steps in the right panel, then <strong>Run pipeline</strong> in the preview.
            </p>
            <FileDrop onFile={setFile} disabled={loadingRun} />
          </section>
        </aside>

        <main className="app__col app__col--main">
          <section className="dock-panel dock-panel--main">
            <h2 className="dock-panel__title dock-panel__title--center">
              <span className="dock-panel__dot dock-panel__dot--violet" />
              Preview
            </h2>
            <div className="pipeline-page__meta">
              <span className="chip">{steps.length} steps</span>
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
            />

            {procError && <div className="banner banner--error">{procError}</div>}
            {result && result.warnings.length > 0 && (
              <div className="banner banner--warn">
                <strong>Warnings</strong>
                <ul>
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {copyNotice && (
              <div className={`banner ${copyNotice.kind === 'ok' ? 'banner--ok' : 'banner--error'}`} role="status">
                {copyNotice.text}
              </div>
            )}

            <div className="toolbar toolbar--primary">
              <button type="button" className="btn btn--primary" disabled={!file || loadingRun} onClick={() => void run()}>
                {loadingRun ? 'Running…' : 'Run pipeline'}
              </button>
              <button type="button" className="btn" disabled={steps.length === 0} onClick={() => setSteps([])}>
                Clear
              </button>
              {result && (
                <a className="btn btn--ghost" href={afterSrc ?? '#'} download="v-rush-output.png">
                  Download image
                </a>
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
                    <strong>Deep Learning Lab:</strong> YOLOv26 and MobileSAM run on the image <em>after</em> any preprocessing
                    you stack above them. Head back to{' '}
                    <Link to="/studio">Classical CV</Link> for filtering, edges, morphology, and K-Means / Watershed / GrabCut.
                  </p>
                )}
                {hasYoloStep && (
                  <p className="panel-hint panel-hint--tight">
                    <strong>YOLO</strong> runs on the image <em>after</em> the steps above it. Put preprocessing first to detect on
                    the processed image.
                  </p>
                )}
                <PipelineStack
                  steps={steps}
                  opsById={opsById}
                  flashKey={flashKey}
                  onChangeParams={(key, json) => setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, paramsJson: json } : s)))}
                  onRemove={(key) => setSteps((prev) => prev.filter((s) => s.key !== key))}
                  onMove={onMove}
                  onDragStart={setDragKey}
                  onDropOn={onDropOn}
                  dragKey={dragKey}
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
    </>
  )
}
