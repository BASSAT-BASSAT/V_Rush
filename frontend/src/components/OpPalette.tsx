import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { categoryLabel } from '../cv/categoryLabels'
import type { OpInfo } from '../types/cv'

/** Sensible order for CV pipelines (matches common processing flow). */
const CATEGORY_ORDER = [
  'detection',
  'segmentation',
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
  /** When true, omit large heading (used inside tabbed workspace). */
  embedded?: boolean
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

export function OpPalette({ ops, onAdd, disabled, embedded }: Props) {
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
  const [search, setSearch] = useState('')

  const topic = useMemo(() => {
    if (categories.length === 0) return ''
    if (pickedTopic && categories.includes(pickedTopic)) return pickedTopic
    return categories[0]
  }, [categories, pickedTopic])

  const searchQuery = search.trim().toLowerCase()

  const currentOps = useMemo(() => {
    if (searchQuery) {
      const q = searchQuery
      return ops
        .filter((o) => {
          const cat = categoryLabel(o.category).toLowerCase()
          const desc = (o.description ?? '').toLowerCase()
          return (
            o.label.toLowerCase().includes(q) ||
            o.id.toLowerCase().includes(q) ||
            o.category.toLowerCase().includes(q) ||
            cat.includes(q) ||
            desc.includes(q)
          )
        })
        .sort((a, b) => {
          const c = a.category.localeCompare(b.category)
          if (c !== 0) return c
          return a.label.localeCompare(b.label)
        })
    }
    return topic ? (grouped.get(topic) ?? []) : []
  }, [searchQuery, topic, grouped, ops])

  const searchingAll = Boolean(searchQuery)

  return (
    <div className={`op-palette${embedded ? ' op-palette--embedded' : ''}`}>
      {!embedded && (
        <>
          <h2 className="panel-title">Operations</h2>
          <p className="panel-hint">
            Choose a topic, then click a method to add it to the pipeline.{' '}
            <Link to="/reference" className="op-palette__ref-link">
              Reference
            </Link>{' '}
            has full descriptions and parameter notes.
          </p>
        </>
      )}

      <label className="op-palette__field">
        <span className="op-palette__label">Search</span>
        <input
          type="search"
          className="op-palette__search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all operations…"
          disabled={disabled || categories.length === 0}
          aria-label="Search all operations by name, id, topic, or description"
        />
      </label>
      {searchingAll && (
        <p className="op-palette__search-note">Searching every category — topic below only applies when the search box is empty.</p>
      )}

      <label className="op-palette__field">
        <span className="op-palette__label">Topic</span>
        <select
          className="op-palette__select"
          value={topic}
          onChange={(e) => setPickedTopic(e.target.value)}
          disabled={disabled || categories.length === 0 || searchingAll}
          aria-label="Operation category (ignored while search is active)"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabel(cat)} ({grouped.get(cat)?.length ?? 0})
            </option>
          ))}
        </select>
      </label>

      <div className="op-palette__methods-head">
        <span className="op-palette__methods-title">{searchingAll ? 'Matches (all topics)' : 'Methods'}</span>
        <span className="op-palette__methods-count">{currentOps.length}</span>
      </div>

      <div
        className="op-palette__methods"
        role="listbox"
        aria-label={searchingAll ? 'Operations matching search' : `${categoryLabel(topic)} operations`}
      >
        {currentOps.length === 0 && (
          <p className="op-palette__empty">
            {searchingAll ? 'No operations match your search.' : 'No operations in this topic.'}
          </p>
        )}
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
            <span className="op-palette__btn-meta">
              {searchingAll ? `${categoryLabel(o.category)} · ${o.output_kind}` : o.output_kind}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
