import { AnimatePresence, Reorder, useReducedMotion } from 'motion/react'
import { MobileSamParamsEditor } from './MobileSamParamsEditor'
import { Yolo26ParamsEditor } from './Yolo26ParamsEditor'
import type { OpInfo, PipelineStepUI } from '../types/cv'

interface Props {
  steps: PipelineStepUI[]
  opsById: Map<string, OpInfo>
  onChangeParams: (key: string, json: string) => void
  onRemove: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  onReorder: (next: PipelineStepUI[]) => void
  /** Step key to briefly highlight (e.g. when the user just added it). */
  flashKey?: string | null
  /** Optional running step index — that step gets a travelling outline glow. */
  runningIdx?: number | null
}

export function PipelineStack({
  steps,
  opsById,
  onChangeParams,
  onRemove,
  onMove,
  onReorder,
  flashKey,
  runningIdx,
}: Props) {
  const reduced = useReducedMotion()

  return (
    <div className="pipeline-stack" data-stack="root">
      {steps.length === 0 && (
        <p className="panel-hint">Your pipeline is empty. Open the <strong>Add ops</strong> tab and click any operation &mdash; it will land here as the next step.</p>
      )}
      <Reorder.Group
        axis="y"
        values={steps}
        onReorder={onReorder}
        className="pipeline-stack__list"
        as="ul"
        layoutScroll
      >
        <AnimatePresence initial={false}>
          {steps.map((s, idx) => {
            const meta = opsById.get(s.op)
            const help = meta?.param_help ?? {}
            const formula =
              meta?.detail_doc
                ?.split(/\n+/)
                .find((line) => line.includes('=') || line.includes('sqrt(') || line.includes('log(')) ?? null
            const isFlashing = flashKey === s.key
            const isRunning = typeof runningIdx === 'number' && runningIdx === idx
            const classes = [
              'pipeline-stack__item',
              isFlashing ? 'pipeline-stack__item--flash' : '',
              isRunning ? 'pipeline-stack__item--running' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <Reorder.Item
                key={s.key}
                value={s}
                as="li"
                className={classes}
                layout
                whileDrag={
                  reduced
                    ? undefined
                    : {
                        scale: 1.02,
                        boxShadow: '0 18px 48px -12px rgba(124,58,237,0.55)',
                        zIndex: 5,
                      }
                }
                initial={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: 0, y: -8, scale: 0.96 }
                }
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, scale: 1 }
                }
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, x: 24, scale: 0.96 }
                }
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 320, damping: 26, mass: 0.6 }
                }
                data-step-key={s.key}
              >
                <div className="pipeline-stack__head">
                  <span className="pipeline-stack__idx">{idx + 1}</span>
                  <span className="pipeline-stack__name">{meta?.label ?? s.op}</span>
                  <div className="pipeline-stack__actions">
                    <button type="button" className="icon-btn" title="Up" onClick={() => onMove(s.key, -1)} disabled={idx === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Down"
                      onClick={() => onMove(s.key, 1)}
                      disabled={idx === steps.length - 1}
                    >
                      ↓
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" title="Remove" onClick={() => onRemove(s.key)}>
                      ×
                    </button>
                  </div>
                </div>
                {meta?.description && <p className="pipeline-stack__blurb">{meta.description}</p>}
                {formula && (
                  <p className="pipeline-stack__math" aria-label="Operation formula">
                    <strong>Math:</strong> {formula}
                  </p>
                )}
                {s.op === 'yolo26_detect' ? (
                  <div aria-describedby={Object.keys(help).length ? `help-${s.key}` : undefined}>
                    <span className="pipeline-stack__params-label">Parameters</span>
                    <Yolo26ParamsEditor
                      paramsJson={s.paramsJson}
                      onChangeParamsJson={(json) => onChangeParams(s.key, json)}
                    />
                  </div>
                ) : s.op === 'mobile_sam' ? (
                  <div aria-describedby={Object.keys(help).length ? `help-${s.key}` : undefined}>
                    <span className="pipeline-stack__params-label">Prompt</span>
                    <MobileSamParamsEditor
                      paramsJson={s.paramsJson}
                      onChangeParamsJson={(json) => onChangeParams(s.key, json)}
                    />
                  </div>
                ) : (
                  <>
                    <label className="pipeline-stack__params-label" htmlFor={`params-${s.key}`}>
                      params (JSON)
                    </label>
                    <textarea
                      id={`params-${s.key}`}
                      className="pipeline-stack__params"
                      value={s.paramsJson}
                      spellCheck={false}
                      onChange={(e) => onChangeParams(s.key, e.target.value)}
                      rows={4}
                      aria-describedby={Object.keys(help).length ? `help-${s.key}` : undefined}
                    />
                  </>
                )}
                {Object.keys(help).length > 0 && (
                  <div className="pipeline-stack__help" id={`help-${s.key}`}>
                    <span className="pipeline-stack__help-title">Parameter hints</span>
                    <dl className="pipeline-stack__dl">
                      {Object.entries(help).map(([k, text]) => (
                        <div key={k} className="pipeline-stack__dl-row">
                          <dt>
                            <code>{k}</code>
                          </dt>
                          <dd>{text}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </Reorder.Item>
            )
          })}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  )
}
