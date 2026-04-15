import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchOps, processImage } from './api/cv'
import { AuthScreen } from './components/AuthScreen'
import { BeforeAfter } from './components/BeforeAfter'
import { FileDrop } from './components/FileDrop'
import { NewsletterForm } from './components/NewsletterForm'
import { OpPalette } from './components/OpPalette'
import { PipelineStack } from './components/PipelineStack'
import { useAuth } from './hooks/useAuth'
import { getSupabase } from './lib/supabase'
import type { OpInfo, PipelineStepUI, ProcessResponse } from './types/cv'
import './App.css'

function newKey() {
  return crypto.randomUUID()
}

function App() {
  const { loading, bypass, session, accessToken, signOut } = useAuth()

  const [ops, setOps] = useState<OpInfo[]>([])
  const [opsError, setOpsError] = useState<string | null>(null)
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
    if (loading) return
    if (!bypass && !session) return
    fetchOps(accessToken)
      .then(setOps)
      .catch((e: unknown) => setOpsError(e instanceof Error ? e.message : 'Failed to load ops'))
  }, [loading, bypass, session, accessToken])

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

      if (!bypass && session?.user?.id) {
        try {
          await getSupabase().from('usage_logs').insert({
            user_id: session.user.id,
            action: 'process_pipeline',
          })
        } catch {
          /* non-fatal if table missing */
        }
      }
    } catch (e) {
      setProcError(e instanceof Error ? e.message : 'Process failed')
    } finally {
      setLoadingRun(false)
    }
  }, [file, steps, accessToken, bypass, session])

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

  if (loading) {
    return (
      <div className="app app--boot">
        <div className="app__aurora" aria-hidden />
        <p className="app--boot-msg">Loading…</p>
      </div>
    )
  }

  if (!bypass && !session) {
    return (
      <div className="app">
        <div className="app__aurora" aria-hidden />
        <AuthScreen />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app__aurora" aria-hidden />
      <div className="app__grid-bg" aria-hidden />

      <div className="app__shell">
        <header className="app__header">
          <div className="app__header-inner">
            <div className="brand">
              <div className="brand__mark" aria-hidden>
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand__svg">
                  <defs>
                    <linearGradient id="klg" x1="8" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#5eead4" />
                      <stop offset="1" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <rect x="4" y="4" width="32" height="32" rx="9" stroke="url(#klg)" strokeWidth="2" fill="rgba(94,234,212,0.06)" />
                  <path
                    d="M12 20h6l4-8 4 16 4-8h6"
                    stroke="url(#klg)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <div className="brand__text">
                <p className="brand__eyebrow">Classical computer vision</p>
                <h1 className="brand__title">KernelLab</h1>
                <p className="tagline">Stack OpenCV-style ops, run the pipeline, compare before and after in one place.</p>
              </div>
            </div>
            <div className="app__header-right">
              {!bypass && session && (
                <div className="app__user">
                  <span className="app__user-email" title={session.user.email ?? ''}>
                    {session.user.email}
                  </span>
                  <button type="button" className="btn btn--ghost" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </div>
              )}
              <div className="app__header-badges">
                <span className="chip chip--accent">{ops.length ? `${ops.length} ops` : 'Loading…'}</span>
                <span className="chip">{steps.length} steps</span>
              </div>
            </div>
          </div>
        </header>

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

        <footer className="app__footer">
          <div className="app__footer-row">
            <span className="app__footer-brand">KernelLab</span>
            <span className="app__footer-sep" aria-hidden>
              ·
            </span>
            <span className="app__footer-founder">
              Founder: <strong>Mohamed ElBassat</strong>
            </span>
            <span className="app__footer-sep" aria-hidden>
              ·
            </span>
            <a className="app__footer-link" href="mailto:mohamedd77bassat@gmail.com">
              mohamedd77bassat@gmail.com
            </a>
          </div>
          {!bypass && (
            <div className="app__footer-newsletter">
              <NewsletterForm />
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}

export default App
