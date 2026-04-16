import { useState } from 'react'

interface Props {
  beforeUrl: string | null
  afterSrc: string | null
  lastKind: string | null
}

export function BeforeAfter({ beforeUrl, afterSrc, lastKind }: Props) {
  const [mode, setMode] = useState<'split' | 'slider'>('split')
  const [slider, setSlider] = useState(50)

  if (!beforeUrl) {
    return <div className="before-after before-after--empty">Load an image to compare</div>
  }

  return (
    <div className="before-after">
      <div className="before-after__toolbar">
        <div className="seg">
          <button type="button" className={mode === 'split' ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => setMode('split')}>
            Side by side
          </button>
          <button type="button" className={mode === 'slider' ? 'seg__btn seg__btn--on' : 'seg__btn'} onClick={() => setMode('slider')}>
            Slider
          </button>
        </div>
        {lastKind && (
          <span className="before-after__badge" title="Output of last operation">
            last: {lastKind}
          </span>
        )}
      </div>

      {mode === 'split' ? (
        <div className="before-after__viewport">
          <div className="before-after__split">
            <figure>
              <figcaption>Before</figcaption>
              <div className="before-after__img-wrap">
                <img src={beforeUrl} alt="Original" />
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
            <div className="before-after__compare">
              <img src={beforeUrl} alt="" className="before-after__layer before-after__layer--base" />
              {afterSrc && (
                <img
                  src={afterSrc}
                  alt=""
                  className="before-after__layer before-after__layer--top"
                  style={{ clipPath: `inset(0 0 0 ${slider}%)` }}
                />
              )}
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
