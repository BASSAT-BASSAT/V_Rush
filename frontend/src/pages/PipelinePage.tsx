import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { processImage } from '../api/cv'
import { BeforeAfter } from '../components/BeforeAfter'
import { FileDrop } from '../components/FileDrop'
import { OpPalette } from '../components/OpPalette'
import { PipelineStack } from '../components/PipelineStack'
import type { OpInfo, PipelineStepUI, ProcessResponse } from '../types/cv'
import type { AppLayoutOutlet } from '../types/layout'

function newKey() {
  return crypto.randomUUID()
}

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

  const opsById = useMemo(() => new Map(ops.map((o) => [o.id, o])), [ops])

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

  const run = useCallback(async () => {
    if (!file) return
    setLoadingRun(true)
    setProcError(null)
    setResult(null)
    try {
      const pipeline = steps.map((s) => {
        let params: Record<string, unknown> = {}
        try {
          const parsed: unknown = JSON.parse(s.paramsJson || '{}')
          params = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
        } catch {
          throw new Error(`Invalid JSON for ${s.op}`)
        }
        return { op: s.op, params }
      })
      const res = await processImage(file, pipeline, accessToken)
      setResult(res)
    } catch (e) {
      setProcError(e instanceof Error ? e.message : 'Process failed')
    } finally {
      setLoadingRun(false)
    }
  }, [file, steps, accessToken])

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

  const copyPipelineJson = useCallback(() => {
    const pipeline = steps.map((s) => {
      let params: Record<string, unknown> = {}
      try {
        const parsed: unknown = JSON.parse(s.paramsJson || '{}')
        params = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
      } catch {
        params = {}
      }
      return { op: s.op, params }
    })
    void navigator.clipboard.writeText(JSON.stringify(pipeline, null, 2))
  }, [steps])

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
            <FileDrop onFile={setFile} disabled={loadingRun} />
            {ops.length > 0 && <OpPalette ops={ops} onAdd={addOp} disabled={loadingRun || !file} />}
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
            <div className="toolbar">
              <button type="button" className="btn btn--primary" disabled={!file || loadingRun} onClick={() => void run()}>
                {loadingRun ? 'Running…' : 'Run pipeline'}
              </button>
              <button type="button" className="btn" disabled={steps.length === 0} onClick={() => setSteps([])}>
                Clear
              </button>
              <button type="button" className="btn" disabled={steps.length === 0} onClick={copyPipelineJson}>
                Copy JSON
              </button>
              {result && (
                <a className="btn btn--ghost" href={afterSrc ?? '#'} download="kernellab-output.png">
                  Download
                </a>
              )}
            </div>
          </section>
        </main>

        <aside className="app__col app__col--side app__col--pipeline">
          <section className="dock-panel">
            <h2 className="dock-panel__title">
              <span className="dock-panel__dot dock-panel__dot--amber" />
              Pipeline
            </h2>
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
          </section>
        </aside>
      </div>
    </>
  )
}
