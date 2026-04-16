import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OpInfo } from '../types/cv'

/** Sensible order for CV pipelines (matches common processing flow). */
const CATEGORY_ORDER = [
  'geometric',
  'color',
  'intensity',
  'linear',
  'morphology',
  'edges',
  'texture',
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

  const topic = useMemo(() => {
    if (categories.length === 0) return ''
    if (pickedTopic && categories.includes(pickedTopic)) return pickedTopic
    return categories[0]
  }, [categories, pickedTopic])

  const currentOps = topic ? (grouped.get(topic) ?? []) : []

  return (
    <div className="op-palette">
      <h2 className="panel-title">Operations</h2>
      <p className="panel-hint">
        Choose a topic, then click a method to add it to the pipeline.{' '}
        <Link to="/reference" className="op-palette__ref-link">
          Reference
        </Link>{' '}
        has full descriptions and parameter notes.
      </p>

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
            onClick={() => onAdd(o)}
          >
            <span className="op-palette__btn-label">{o.label}</span>
            <span className="op-palette__btn-meta">{o.output_kind}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
