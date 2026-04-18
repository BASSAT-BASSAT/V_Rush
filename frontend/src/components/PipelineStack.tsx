import { useCallback } from 'react'
import { MobileSamParamsEditor } from './MobileSamParamsEditor'
import { Yolo26ParamsEditor } from './Yolo26ParamsEditor'
import type { OpInfo, PipelineStepUI } from '../types/cv'

interface Props {
  steps: PipelineStepUI[]
  opsById: Map<string, OpInfo>
  onChangeParams: (key: string, json: string) => void
  onRemove: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  onDragStart: (key: string) => void
  onDropOn: (targetKey: string) => void
  dragKey: string | null
}

export function PipelineStack({
  steps,
  opsById,
  onChangeParams,
  onRemove,
  onMove,
  onDragStart,
  onDropOn,
  dragKey,
}: Props) {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="pipeline-stack">
      {steps.length === 0 && (
        <p className="panel-hint">Use the <strong>Add ops</strong> tab to pick steps, then reorder and edit JSON here.</p>
      )}
      <ul className="pipeline-stack__list">
        {steps.map((s, idx) => {
          const meta = opsById.get(s.op)
          const help = meta?.param_help ?? {}
          return (
            <li
              key={s.key}
              className={`pipeline-stack__item ${dragKey === s.key ? 'pipeline-stack__item--drag' : ''}`}
              draggable
              onDragStart={() => onDragStart(s.key)}
              onDragOver={handleDragOver}
              onDrop={() => onDropOn(s.key)}
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
