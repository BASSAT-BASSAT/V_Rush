import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
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
          pipeline, use <strong>Export Python</strong> on the main page to copy an OpenCV + NumPy script from <code>img</code> to{' '}
          <code>out</code>.
        </p>
      </section>

      <div className="ref-page__sections">
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
