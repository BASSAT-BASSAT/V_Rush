import { useCallback, useMemo, useRef, useState } from 'react'
import {
  clamp01,
  emitSamParamsJson,
  parseSamParamsJson,
  type SamOutputMode,
  type SamPromptType,
} from '../lib/samParams'

export interface SamStepHandle {
  /** Index shown to the user ("Editing step N"). 1-based. */
  stepIndex: number
  /** Current JSON params for the step. */
  paramsJson: string
  /** Push a new JSON string back to the owning pipeline step. */
  onChangeParamsJson: (json: string) => void
}

interface Props {
  beforeUrl: string | null
  afterSrc: string | null
  lastKind: string | null
  /** When present, enables interactive SAM point/box prompting on the Before image. */
  samStep?: SamStepHandle | null
}

export function BeforeAfter({ beforeUrl, afterSrc, lastKind, samStep }: Props) {
  const [mode, setMode] = useState<'split' | 'slider'>('split')
  const [slider, setSlider] = useState(50)

  const samActive = Boolean(samStep && beforeUrl)
  const sam = useMemo(
    () => (samStep ? parseSamParamsJson(samStep.paramsJson) : null),
    [samStep],
  )

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [dragBox, setDragBox] = useState<{ x: number; y: number } | null>(null)
  const [ghost, setGhost] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  )

  const pushSam = useCallback(
    (next: ReturnType<typeof parseSamParamsJson>) => {
      if (!samStep) return
      samStep.onChangeParamsJson(emitSamParamsJson(next))
    },
    [samStep],
  )

  const fracFromEvent = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): { fx: number; fy: number } | null => {
      const el = frameRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      return {
        fx: clamp01((e.clientX - rect.left) / rect.width),
        fy: clamp01((e.clientY - rect.top) / rect.height),
      }
    },
    [],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!samActive || !sam) return
      const pt = fracFromEvent(e)
      if (!pt) return
      ;(e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId)
      if (sam.prompt_type === 'point') {
        pushSam({
          ...sam,
          point_x_frac: pt.fx,
          point_y_frac: pt.fy,
          point_label: e.shiftKey ? 0 : 1,
        })
      } else {
        setDragBox({ x: pt.fx, y: pt.fy })
        setGhost({ x1: pt.fx, y1: pt.fy, x2: pt.fx, y2: pt.fy })
      }
    },
    [samActive, sam, fracFromEvent, pushSam],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!samActive || !sam || !dragBox || sam.prompt_type !== 'box') return
      const pt = fracFromEvent(e)
      if (!pt) return
      setGhost({
        x1: Math.min(dragBox.x, pt.fx),
        y1: Math.min(dragBox.y, pt.fy),
        x2: Math.max(dragBox.x, pt.fx),
        y2: Math.max(dragBox.y, pt.fy),
      })
    },
    [samActive, sam, dragBox, fracFromEvent],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!samActive || !sam || !dragBox || sam.prompt_type !== 'box') return
      const pt = fracFromEvent(e)
      const end = pt ?? { fx: dragBox.x, fy: dragBox.y }
      const x1 = Math.min(dragBox.x, end.fx)
      const y1 = Math.min(dragBox.y, end.fy)
      const x2 = Math.max(dragBox.x, end.fx)
      const y2 = Math.max(dragBox.y, end.fy)
      if (x2 - x1 > 0.005 && y2 - y1 > 0.005) {
        pushSam({
          ...sam,
          box_x1_frac: x1,
          box_y1_frac: y1,
          box_x2_frac: x2,
          box_y2_frac: y2,
        })
      }
      setDragBox(null)
      setGhost(null)
    },
    [samActive, sam, dragBox, fracFromEvent, pushSam],
  )

  const onPointerCancel = useCallback(() => {
    setDragBox(null)
    setGhost(null)
  }, [])

  const activeBox =
    ghost ??
    (sam?.prompt_type === 'box'
      ? {
          x1: sam.box_x1_frac,
          y1: sam.box_y1_frac,
          x2: sam.box_x2_frac,
          y2: sam.box_y2_frac,
        }
      : null)

  if (!beforeUrl) {
    return <div className="before-after before-after--empty">Load an image to compare</div>
  }

  const renderSamOverlay = () => {
    if (!samActive || !sam) return null
    return (
      <>
        <div className="before-after__sam-badge" aria-hidden>
          SAM prompt
        </div>
        {sam.prompt_type === 'point' && (
          <span
            className={`before-after__sam-dot ${
              sam.point_label === 1
                ? 'before-after__sam-dot--fg'
                : 'before-after__sam-dot--bg'
            }`}
            style={{
              left: `${sam.point_x_frac * 100}%`,
              top: `${sam.point_y_frac * 100}%`,
            }}
            aria-hidden
          />
        )}
        {activeBox && (
          <span
            className="before-after__sam-box"
            style={{
              left: `${activeBox.x1 * 100}%`,
              top: `${activeBox.y1 * 100}%`,
              width: `${(activeBox.x2 - activeBox.x1) * 100}%`,
              height: `${(activeBox.y2 - activeBox.y1) * 100}%`,
            }}
            aria-hidden
          />
        )}
      </>
    )
  }

  return (
    <div className="before-after">
      <div className="before-after__toolbar">
        <div className="seg">
          <button
            type="button"
            className={mode === 'split' ? 'seg__btn seg__btn--on' : 'seg__btn'}
            onClick={() => setMode('split')}
          >
            Side by side
          </button>
          <button
            type="button"
            className={mode === 'slider' ? 'seg__btn seg__btn--on' : 'seg__btn'}
            onClick={() => setMode('slider')}
          >
            Slider
          </button>
        </div>
        {lastKind && (
          <span className="before-after__badge" title="Output of last operation">
            last: {lastKind}
          </span>
        )}
      </div>

      {samActive && sam && samStep && (
        <div className="before-after__sam-bar" role="toolbar" aria-label="MobileSAM prompt">
          <span className="before-after__sam-bar-title">
            SAM <span className="before-after__sam-bar-step">step {samStep.stepIndex}</span>
          </span>
          <div className="seg" role="radiogroup" aria-label="Prompt type">
            {(['point', 'box'] as SamPromptType[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={sam.prompt_type === t}
                className={sam.prompt_type === t ? 'seg__btn seg__btn--on' : 'seg__btn'}
                onClick={() => pushSam({ ...sam, prompt_type: t })}
              >
                {t === 'point' ? 'Point' : 'Box'}
              </button>
            ))}
          </div>
          {sam.prompt_type === 'point' && (
            <div className="seg seg--compact" role="radiogroup" aria-label="Point polarity">
              <button
                type="button"
                role="radio"
                aria-checked={sam.point_label === 1}
                className={
                  sam.point_label === 1 ? 'seg__btn seg__btn--on' : 'seg__btn'
                }
                onClick={() => pushSam({ ...sam, point_label: 1 })}
                title="Click = foreground (include)"
              >
                Foreground
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={sam.point_label === 0}
                className={
                  sam.point_label === 0 ? 'seg__btn seg__btn--on' : 'seg__btn'
                }
                onClick={() => pushSam({ ...sam, point_label: 0 })}
                title="Shift+click = background (exclude)"
              >
                Background
              </button>
            </div>
          )}
          <div className="seg seg--compact" role="radiogroup" aria-label="Output mode">
            {(['overlay', 'cutout', 'mask'] as SamOutputMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={sam.output === m}
                className={sam.output === m ? 'seg__btn seg__btn--on' : 'seg__btn'}
                onClick={() => pushSam({ ...sam, output: m })}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="before-after__sam-legend">
            {sam.prompt_type === 'point' ? (
              <>
                <kbd>Click</kbd> foreground · <kbd>Shift</kbd>+<kbd>click</kbd> background
              </>
            ) : (
              <>
                <kbd>Drag</kbd> a box over the subject
              </>
            )}
          </span>
        </div>
      )}

      {mode === 'split' ? (
        <div className="before-after__viewport">
          <div className="before-after__split">
            <figure>
              <figcaption>
                Before {samActive && <span className="before-after__sam-hint">(click / drag to prompt SAM)</span>}
              </figcaption>
              <div
                ref={samActive ? frameRef : undefined}
                className={`before-after__img-wrap${
                  samActive ? ` before-after__img-wrap--sam before-after__img-wrap--sam-${sam?.prompt_type ?? 'point'}` : ''
                }`}
                onPointerDown={samActive ? onPointerDown : undefined}
                onPointerMove={samActive ? onPointerMove : undefined}
                onPointerUp={samActive ? onPointerUp : undefined}
                onPointerCancel={samActive ? onPointerCancel : undefined}
              >
                <img src={beforeUrl} alt="Original" draggable={false} />
                {renderSamOverlay()}
              </div>
            </figure>
            <figure>
              <figcaption>After</figcaption>
              {afterSrc ? (
                <div className="before-after__img-wrap">
                  <img src={afterSrc} alt="Processed" />
                </div>
              ) : (
                <div className="before-after__placeholder">Run pipeline</div>
              )}
            </figure>
          </div>
        </div>
      ) : (
        <div className="before-after__slider-wrap">
          <div className="before-after__viewport before-after__viewport--slider">
            <div
              ref={samActive ? frameRef : undefined}
              className={`before-after__compare${
                samActive ? ` before-after__compare--sam before-after__compare--sam-${sam?.prompt_type ?? 'point'}` : ''
              }`}
              onPointerDown={samActive ? onPointerDown : undefined}
              onPointerMove={samActive ? onPointerMove : undefined}
              onPointerUp={samActive ? onPointerUp : undefined}
              onPointerCancel={samActive ? onPointerCancel : undefined}
            >
              <img
                src={beforeUrl}
                alt=""
                className="before-after__layer before-after__layer--base"
                draggable={false}
              />
              {afterSrc && (
                <img
                  src={afterSrc}
                  alt=""
                  className="before-after__layer before-after__layer--top"
                  style={{ clipPath: `inset(0 0 0 ${slider}%)` }}
                />
              )}
              {renderSamOverlay()}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
            className="before-after__range"
            disabled={!afterSrc}
          />
        </div>
      )}
    </div>
  )
}
