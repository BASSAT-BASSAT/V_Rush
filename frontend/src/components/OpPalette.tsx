import { useMemo, useState } from 'react'
import type { OpInfo } from '../types/cv'

/** Sensible order for CV pipelines (matches common processing flow). */
const CATEGORY_ORDER = [
  'geometric',
  'color',
  'intensity',
  'linear',
  'morphology',
  'edges',
  'denoise',
  'noise',
  'fourier',
]

interface Props {
  ops: OpInfo[]
  onAdd: (op: OpInfo) => void
  disabled?: boolean
}

function sortCategories(cats: string[]): string[] {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

export function OpPalette({ ops, onAdd, disabled }: Props) {
  const grouped = useMemo(() => {
    const m = new Map<string, OpInfo[]>()
    for (const o of ops) {
      const list = m.get(o.category) ?? []
      list.push(o)
      m.set(o.category, list)
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.label.localeCompare(b.label))
    }
    return m
  }, [ops])

  const categories = useMemo(() => sortCategories([...grouped.keys()]), [grouped])

  const [pickedTopic, setPickedTopic] = useState<string | null>(null)
  const [hoverOp, setHoverOp] = useState<OpInfo | null>(null)

  const topic = useMemo(() => {
    if (categories.length === 0) return ''
    if (pickedTopic && categories.includes(pickedTopic)) return pickedTopic
    return categories[0]
  }, [categories, pickedTopic])

  const currentOps = topic ? (grouped.get(topic) ?? []) : []

  const detailOp = hoverOp

  return (
    <div className="op-palette">
      <h2 className="panel-title">Operations</h2>
      <p className="panel-hint">Choose a topic, then hover or add a method.</p>

      <label className="op-palette__field">
        <span className="op-palette__label">Topic</span>
        <select
          className="op-palette__select"
          value={topic}
          onChange={(e) => setPickedTopic(e.target.value)}
          disabled={disabled || categories.length === 0}
          aria-label="Operation category"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat} ({grouped.get(cat)?.length ?? 0})
            </option>
          ))}
        </select>
      </label>

      <div className="op-palette__methods-head">
        <span className="op-palette__methods-title">Methods</span>
        <span className="op-palette__methods-count">{currentOps.length}</span>
      </div>

      <div className="op-palette__methods" role="listbox" aria-label={`${topic} operations`}>
        {currentOps.length === 0 && <p className="op-palette__empty">No operations in this topic.</p>}
        {currentOps.map((o) => (
          <button
            key={o.id}
            type="button"
            role="option"
            className="op-palette__btn"
            disabled={disabled}
            onMouseEnter={() => setHoverOp(o)}
            onMouseLeave={() => setHoverOp(null)}
            onFocus={() => setHoverOp(o)}
            onBlur={() => setHoverOp(null)}
            onClick={() => onAdd(o)}
          >
            <span className="op-palette__btn-label">{o.label}</span>
            <span className="op-palette__btn-meta">{o.output_kind}</span>
          </button>
        ))}
      </div>

      <div className="op-palette__detail" aria-live="polite">
        {detailOp ? (
          <>
            <div className="op-palette__detail-head">{detailOp.label}</div>
            <p className="op-palette__detail-desc">{detailOp.description}</p>
            {Object.keys(detailOp.param_help ?? {}).length > 0 && (
              <div className="op-palette__detail-params">
                <span className="op-palette__detail-params-title">Parameters</span>
                <dl className="op-palette__dl">
                  {Object.entries(detailOp.param_help).map(([k, text]) => (
                    <div key={k} className="op-palette__dl-row">
                      <dt>
                        <code>{k}</code>
                      </dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </>
        ) : (
          <p className="op-palette__detail-placeholder">Hover a method to see what it does and how params behave.</p>
        )}
      </div>
    </div>
  )
}
