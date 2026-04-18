import { useMemo } from 'react'
import {
  clamp01,
  emitSamParamsJson,
  parseSamParamsJson,
  SAM_DEFAULTS,
  type SamOutputMode,
  type SamPromptType,
} from '../lib/samParams'

function numOr(v: string, fallback: number): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

interface Props {
  paramsJson: string
  onChangeParamsJson: (json: string) => void
}

/** Compact fine-tune panel. The main interaction (click / drag) happens on
 *  the Before image in the preview; this panel shows the active prompt, lets
 *  users nudge exact fractions, and exposes the raw JSON. */
export function MobileSamParamsEditor({ paramsJson, onChangeParamsJson }: Props) {
  const parsed = useMemo(() => parseSamParamsJson(paramsJson), [paramsJson])

  const push = (next: typeof parsed) => onChangeParamsJson(emitSamParamsJson(next))

  const summary =
    parsed.prompt_type === 'point'
      ? `${parsed.point_label === 1 ? 'Foreground' : 'Background'} point @ (${parsed.point_x_frac.toFixed(2)}, ${parsed.point_y_frac.toFixed(2)})`
      : `Box (${parsed.box_x1_frac.toFixed(2)}, ${parsed.box_y1_frac.toFixed(2)}) → (${parsed.box_x2_frac.toFixed(2)}, ${parsed.box_y2_frac.toFixed(2)})`

  return (
    <div className="sam-editor sam-editor--compact">
      <div className="sam-editor__banner">
        <span className="sam-editor__banner-dot" aria-hidden />
        <div className="sam-editor__banner-text">
          <strong>Prompt on the preview.</strong>
          <span>
            Click the Before image to drop a point.{' '}
            <kbd>Shift</kbd>+click for background. Drag for a box.
          </span>
        </div>
      </div>

      <div className="sam-editor__summary" aria-live="polite">
        {summary} · <em>{parsed.output}</em>
      </div>

      <div className="sam-editor__modes">
        <div className="seg" role="radiogroup" aria-label="Prompt type">
          {(['point', 'box'] as SamPromptType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={parsed.prompt_type === t}
              className={parsed.prompt_type === t ? 'seg__btn seg__btn--on' : 'seg__btn'}
              onClick={() => push({ ...parsed, prompt_type: t })}
            >
              {t === 'point' ? 'Point' : 'Box'}
            </button>
          ))}
        </div>
        <div className="seg seg--compact" role="radiogroup" aria-label="Output mode">
          {(['overlay', 'cutout', 'mask'] as SamOutputMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={parsed.output === m}
              className={parsed.output === m ? 'seg__btn seg__btn--on' : 'seg__btn'}
              onClick={() => push({ ...parsed, output: m })}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {parsed.prompt_type === 'point' ? (
        <div className="sam-editor__grid">
          <label className="sam-editor__field">
            <span>point_x</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={parsed.point_x_frac}
              onChange={(e) =>
                push({
                  ...parsed,
                  point_x_frac: clamp01(numOr(e.target.value, SAM_DEFAULTS.point_x_frac)),
                })
              }
            />
          </label>
          <label className="sam-editor__field">
            <span>point_y</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={parsed.point_y_frac}
              onChange={(e) =>
                push({
                  ...parsed,
                  point_y_frac: clamp01(numOr(e.target.value, SAM_DEFAULTS.point_y_frac)),
                })
              }
            />
          </label>
          <label className="sam-editor__check">
            <input
              type="checkbox"
              checked={parsed.point_label === 1}
              onChange={(e) => push({ ...parsed, point_label: e.target.checked ? 1 : 0 })}
            />
            <span>Foreground point</span>
          </label>
        </div>
      ) : (
        <div className="sam-editor__grid sam-editor__grid--4">
          {(['box_x1_frac', 'box_y1_frac', 'box_x2_frac', 'box_y2_frac'] as const).map((k) => (
            <label key={k} className="sam-editor__field">
              <span>{k.replace('_frac', '')}</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={parsed[k]}
                onChange={(e) =>
                  push({ ...parsed, [k]: clamp01(numOr(e.target.value, 0.5)) })
                }
              />
            </label>
          ))}
        </div>
      )}

      <details className="sam-editor__raw">
        <summary>Raw JSON</summary>
        <textarea
          className="pipeline-stack__params sam-editor__raw-ta"
          value={paramsJson}
          spellCheck={false}
          onChange={(e) => onChangeParamsJson(e.target.value)}
          rows={6}
        />
      </details>
    </div>
  )
}
