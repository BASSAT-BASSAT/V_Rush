import { useCallback, useMemo, useState } from 'react'
import { COCO80_CLASS_NAMES } from '../lib/coco80'

type YoloParamsState = {
  conf: number
  max_det: number
  draw: boolean
  /** Class names (lowercase); empty = detect all COCO classes */
  classes: string[]
}

const DEFAULTS: YoloParamsState = {
  conf: 0.25,
  max_det: 100,
  draw: true,
  classes: [],
}

function normalizeClassToken(c: unknown): string | null {
  if (typeof c === 'string') {
    const t = c.trim().toLowerCase()
    return COCO80_CLASS_NAMES.some((n) => n.toLowerCase() === t) ? t : null
  }
  if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c < COCO80_CLASS_NAMES.length) {
    return COCO80_CLASS_NAMES[c].toLowerCase()
  }
  return null
}

function parseParamsJson(json: string): YoloParamsState {
  try {
    const p = JSON.parse(json) as Record<string, unknown>
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return { ...DEFAULTS }

    const conf =
      typeof p.conf === 'number' && !Number.isNaN(p.conf)
        ? Math.min(1, Math.max(0, p.conf))
        : DEFAULTS.conf
    const max_det =
      typeof p.max_det === 'number' && Number.isFinite(p.max_det)
        ? Math.min(300, Math.max(1, Math.round(p.max_det)))
        : DEFAULTS.max_det
    const draw =
      typeof p.draw === 'boolean'
        ? p.draw
        : p.draw === undefined || p.draw === null
          ? DEFAULTS.draw
          : Boolean(p.draw)

    const rawClasses = p.classes
    const classes: string[] = []
    if (Array.isArray(rawClasses)) {
      const seen = new Set<string>()
      for (const item of rawClasses) {
        const n = normalizeClassToken(item)
        if (n && !seen.has(n)) {
          seen.add(n)
          classes.push(n)
        }
      }
      classes.sort()
    }

    return { conf, max_det, draw, classes }
  } catch {
    return { ...DEFAULTS }
  }
}

function emitJson(state: YoloParamsState): string {
  const out: Record<string, unknown> = {
    conf: state.conf,
    max_det: state.max_det,
    draw: state.draw,
    classes: state.classes.length > 0 ? state.classes : [],
  }
  return JSON.stringify(out, null, 2)
}

interface Props {
  paramsJson: string
  onChangeParamsJson: (json: string) => void
}

export function Yolo26ParamsEditor({ paramsJson, onChangeParamsJson }: Props) {
  const parsed = useMemo(() => parseParamsJson(paramsJson), [paramsJson])
  const [filter, setFilter] = useState('')

  const selected = useMemo(() => new Set(parsed.classes), [parsed.classes])

  const filteredNames = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return [...COCO80_CLASS_NAMES]
    return COCO80_CLASS_NAMES.filter((n) => n.toLowerCase().includes(q))
  }, [filter])

  const push = useCallback(
    (next: YoloParamsState) => {
      onChangeParamsJson(emitJson(next))
    },
    [onChangeParamsJson],
  )

  const toggleClass = useCallback(
    (name: string) => {
      const key = name.toLowerCase()
      const nextSet = new Set(parsed.classes)
      if (nextSet.has(key)) nextSet.delete(key)
      else nextSet.add(key)
      const classes = [...nextSet].sort()
      push({ ...parsed, classes })
    },
    [parsed, push],
  )

  const selectFiltered = useCallback(() => {
    const nextSet = new Set(parsed.classes)
    for (const n of filteredNames) {
      nextSet.add(n.toLowerCase())
    }
    push({ ...parsed, classes: [...nextSet].sort() })
  }, [parsed, push, filteredNames])

  const clearClasses = useCallback(() => {
    push({ ...parsed, classes: [] })
  }, [parsed, push])

  return (
    <div className="yolo26-editor">
      <p className="yolo26-editor__intro">
        Leave <strong>no classes</strong> selected to run on <strong>all 80</strong> COCO classes. Pick one or more to limit
        detection.
      </p>

      <div className="yolo26-editor__row">
        <label className="yolo26-editor__field">
          <span className="yolo26-editor__label">conf</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={parsed.conf}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (Number.isNaN(v)) return
              push({ ...parsed, conf: Math.min(1, Math.max(0, v)) })
            }}
          />
        </label>
        <label className="yolo26-editor__field">
          <span className="yolo26-editor__label">max_det</span>
          <input
            type="number"
            min={1}
            max={300}
            step={1}
            value={parsed.max_det}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (Number.isNaN(v)) return
              push({ ...parsed, max_det: Math.min(300, Math.max(1, v)) })
            }}
          />
        </label>
        <label className="yolo26-editor__check">
          <input
            type="checkbox"
            checked={parsed.draw}
            onChange={(e) => push({ ...parsed, draw: e.target.checked })}
          />
          <span>Draw boxes</span>
        </label>
      </div>

      <div className="yolo26-editor__class-head">
        <label className="yolo26-editor__search-label" htmlFor="yolo-class-filter">
          COCO classes ({COCO80_CLASS_NAMES.length})
        </label>
        <input
          id="yolo-class-filter"
          type="search"
          className="yolo26-editor__search"
          placeholder="Filter classes…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoComplete="off"
        />
        <div className="yolo26-editor__bulk">
          <button type="button" className="btn btn--ghost btn--sm" onClick={selectFiltered}>
            Select filtered
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearClasses}>
            Clear all
          </button>
        </div>
      </div>

      {parsed.classes.length > 0 && (
        <p className="yolo26-editor__selection">
          Selected: <strong>{parsed.classes.length}</strong> — {parsed.classes.join(', ')}
        </p>
      )}

      <div className="yolo26-editor__class-list" role="group" aria-label="COCO classes">
        {filteredNames.map((name) => {
          const on = selected.has(name.toLowerCase())
          const id = `yolo-coco-${name.replace(/\s+/g, '-')}`
          return (
            <div key={name} className="yolo26-editor__class-item">
              <input
                id={id}
                type="checkbox"
                checked={on}
                onChange={() => toggleClass(name)}
              />
              <label htmlFor={id}>{name}</label>
            </div>
          )
        })}
      </div>

      <details className="yolo26-editor__raw">
        <summary>Raw JSON</summary>
        <textarea
          className="pipeline-stack__params yolo26-editor__raw-ta"
          value={paramsJson}
          spellCheck={false}
          onChange={(e) => onChangeParamsJson(e.target.value)}
          rows={5}
        />
      </details>
    </div>
  )
}
