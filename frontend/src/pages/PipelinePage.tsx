import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { processImage } from '../api/cv'
import { bboxToCropFraction } from '../lib/bboxCrop'
import { copyTextToClipboard } from '../lib/clipboard'
import { pipelineToPython } from '../lib/pipelineToPython'
import { recordCodeExport } from '../lib/recordCodeExport'
import { BeforeAfter } from '../components/BeforeAfter'
import { FileDrop } from '../components/FileDrop'
import { OpPalette } from '../components/OpPalette'
import { PipelineStack } from '../components/PipelineStack'
import type { DetectionItem, OpInfo, PipelineStepUI, ProcessResponse } from '../types/cv'
import type { AppLayoutOutlet } from '../types/layout'

function newKey() {
  return crypto.randomUUID()
}

type WorkspaceTab = 'ops' | 'pipeline'

export function PipelinePage() {
  const { ops, opsError, accessToken } = useOutletContext<AppLayoutOutlet>()

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

  const opsById = useMemo(() => new Map(ops.map((o) => [o.id, o])), [ops])

  const hasYoloStep = useMemo(() => steps.some((s) => s.op === 'yolo26_detect'), [steps])

  useEffect(() => {
    if (!file) {
      setBeforeUrl(null)
      return
    }
    const u = URL.createObjectURL(file)
    setBeforeUrl(u)
    return () => URL.revokeObjectURL(u)
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

  const addOp = useCallback((op: OpInfo) => {
    setSteps((prev) => [
      ...prev,
      {
        key: newKey(),
        op: op.id,
        paramsJson: JSON.stringify(op.default_params, null, 2),
      },
    ])
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
            <BeforeAfter beforeUrl={beforeUrl} afterSrc={afterSrc} lastKind={result?.last_output_kind ?? null} />
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
                className={`workspace-tabs__btn${workspaceTab === 'pipeline' ? ' workspace-tabs__btn--on' : ''}`}
                aria-pressed={workspaceTab === 'pipeline'}
                onClick={() => setWorkspaceTab('pipeline')}
              >
                Pipeline
              </button>
            </div>
            {workspaceTab === 'ops' && ops.length > 0 && (
              <OpPalette ops={ops} onAdd={addOp} disabled={loadingRun || !file} embedded />
            )}
            {workspaceTab === 'ops' && ops.length === 0 && <p className="panel-hint">Loading operations…</p>}
            {workspaceTab === 'pipeline' && (
              <>
                {hasYoloStep && (
                  <p className="panel-hint panel-hint--tight">
                    <strong>YOLO</strong> runs on the image <em>after</em> the steps above it. Put preprocessing first to detect on
                    the processed image.
                  </p>
                )}
                <PipelineStack
                  steps={steps}
                  opsById={opsById}
                  onChangeParams={(key, json) => setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, paramsJson: json } : s)))}
                  onRemove={(key) => setSteps((prev) => prev.filter((s) => s.key !== key))}
                  onMove={onMove}
                  onDragStart={setDragKey}
                  onDropOn={onDropOn}
                  dragKey={dragKey}
                />
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
