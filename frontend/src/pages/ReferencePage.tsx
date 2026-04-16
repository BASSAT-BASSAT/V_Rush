import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { fetchSegmentationStatus } from '../api/cv'
import { useAuth } from '../hooks/useAuth'
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

export function ReferencePage() {
  const { ops, opsError, accessToken } = useOutletContext<AppLayoutOutlet>()
  const { bypass } = useAuth()
  const grouped = useMemo(() => groupByCategory(ops), [ops])
  const [seg, setSeg] = useState<{ provider: string; configured: boolean; message: string } | null>(null)
  const [segErr, setSegErr] = useState<string | null>(null)

  useEffect(() => {
    if (bypass) return
    fetchSegmentationStatus(accessToken)
      .then(setSeg)
      .catch((e: unknown) => setSegErr(e instanceof Error ? e.message : 'Failed to load segmentation status'))
  }, [accessToken, bypass])

  return (
    <div className="ref-page">
      {opsError && <div className="banner banner--error">{opsError}</div>}

      <section className="ref-page__intro dock-panel">
        <h2 className="ref-page__title">Operation reference</h2>
        <p className="ref-page__lead">
          Each pipeline step is a classical OpenCV-style operation. Short labels appear in the palette; this page expands what each
          does, how outputs differ (spatial image vs frequency spectrum), and JSON parameter hints.
        </p>
      </section>

      {!bypass && (
        <section className="ref-page__segment dock-panel">
          <h3 className="ref-page__seg-title">Segmentation (planned)</h3>
          <p className="ref-page__seg-body">
            Running Segment Anything–class models on your own GPU is expensive. A practical approach is a small backend proxy that
            calls a hosted inference API (keys stay on the server). KernelLab does not run segmentation in the pipeline yet; this
            status reflects optional server configuration.
          </p>
          {segErr && <p className="ref-page__seg-note ref-page__seg-note--warn">{segErr}</p>}
          {seg && (
            <dl className="ref-page__seg-dl">
              <div>
                <dt>Provider</dt>
                <dd>{seg.provider}</dd>
              </div>
              <div>
                <dt>Configured</dt>
                <dd>{seg.configured ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          )}
          {seg && <p className="ref-page__seg-note">{seg.message}</p>}
        </section>
      )}

      <div className="ref-page__sections">
        {grouped.map(([cat, list]) => (
          <section key={cat} className="ref-page__cat">
            <h3 className="ref-page__cat-title">{cat}</h3>
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
