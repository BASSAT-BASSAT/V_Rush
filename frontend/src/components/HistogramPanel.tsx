import { useId, useMemo, useState } from 'react'
import type { ImageStats } from '../types/cv'

type Channel = 'luma' | 'r' | 'g' | 'b'

const CHANNEL_COLORS: Record<Channel, string> = {
  luma: 'var(--hist-luma, #9aa3b3)',
  r: 'var(--hist-r, #ef4444)',
  g: 'var(--hist-g, #22c55e)',
  b: 'var(--hist-b, #3b82f6)',
}

const CHANNEL_LABELS: Record<Channel, string> = {
  luma: 'Luma',
  r: 'R',
  g: 'G',
  b: 'B',
}

function pickHistogram(stats: ImageStats, channel: Channel): number[] {
  if (channel === 'luma') return stats.histogram_gray
  return stats.histogram_rgb[channel]
}

function sum(xs: number[]): number {
  let s = 0
  for (const x of xs) s += x
  return s
}

interface HistogramBarsProps {
  histogram: number[]
  color: string
  height?: number
  title?: string
}

function HistogramBars({ histogram, color, height = 120, title }: HistogramBarsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const max = useMemo(() => histogram.reduce((m, v) => (v > m ? v : m), 1), [histogram])
  const total = useMemo(() => sum(histogram), [histogram])
  const width = 512
  const barWidth = width / histogram.length

  return (
    <div className="hist-bars" role="img" aria-label={title ?? 'Histogram'} style={{ ['--hist-color' as string]: color }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="hist-bars__svg"
        onMouseLeave={() => setHover(null)}
      >
        <rect x={0} y={0} width={width} height={height} className="hist-bars__bg" />
        {histogram.map((count, bin) => {
          const h = (count / max) * (height - 2)
          return (
            <rect
              key={bin}
              x={bin * barWidth}
              y={height - h}
              width={Math.max(barWidth, 1)}
              height={h}
              fill={color}
              className="hist-bars__bar"
              onMouseEnter={() => setHover(bin)}
            >
              <title>{`bin ${bin} · count ${count.toLocaleString()}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="hist-bars__footer">
        <span>0</span>
        <span>{hover !== null ? `bin ${hover} · ${histogram[hover].toLocaleString()} px` : `Σ = ${total.toLocaleString()} px`}</span>
        <span>255</span>
      </div>
    </div>
  )
}

interface StatChipsProps {
  stats: ImageStats
}

function StatChips({ stats }: StatChipsProps) {
  const mean = stats.mean.map((v) => v.toFixed(1)).join(' / ')
  const std = stats.std.map((v) => v.toFixed(1)).join(' / ')
  const min = stats.min.join(' / ')
  const max = stats.max.join(' / ')
  return (
    <dl className="hist-chips">
      <div className="hist-chips__item">
        <dt>mean</dt>
        <dd>{mean}</dd>
      </div>
      <div className="hist-chips__item">
        <dt>std</dt>
        <dd>{std}</dd>
      </div>
      <div className="hist-chips__item">
        <dt>min</dt>
        <dd>{min}</dd>
      </div>
      <div className="hist-chips__item">
        <dt>max</dt>
        <dd>{max}</dd>
      </div>
      <div className="hist-chips__item">
        <dt>size</dt>
        <dd>
          {stats.width}×{stats.height}
        </dd>
      </div>
    </dl>
  )
}

interface RowProps {
  title: string
  stats: ImageStats
  channel: Channel
  onChannel: (c: Channel) => void
  emptyHint?: string
}

function HistogramRow({ title, stats, channel, onChannel }: RowProps) {
  const labelId = useId()
  return (
    <section className="hist-row" aria-labelledby={labelId}>
      <header className="hist-row__head">
        <h4 id={labelId}>{title}</h4>
        <div className="seg seg--compact" role="radiogroup" aria-label={`${title} channel`}>
          {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={channel === c}
              className={channel === c ? 'seg__btn seg__btn--on' : 'seg__btn'}
              onClick={() => onChannel(c)}
            >
              {CHANNEL_LABELS[c]}
            </button>
          ))}
        </div>
      </header>
      <StatChips stats={stats} />
      <HistogramBars
        histogram={pickHistogram(stats, channel)}
        color={CHANNEL_COLORS[channel]}
        title={`${title} · ${CHANNEL_LABELS[channel]} histogram`}
      />
    </section>
  )
}

interface Props {
  before: ImageStats | null | undefined
  after: ImageStats | null | undefined
  /** When defined, shows a hint under the "After" row (e.g. "run the pipeline to see this"). */
  afterEmptyHint?: string
}

export function HistogramPanel({ before, after, afterEmptyHint }: Props) {
  const [beforeCh, setBeforeCh] = useState<Channel>('luma')
  const [afterCh, setAfterCh] = useState<Channel>('luma')

  if (!before) {
    return (
      <div className="hist-panel hist-panel--empty">
        Load an image to inspect its pixel distribution.
      </div>
    )
  }

  return (
    <div className="hist-panel">
      <HistogramRow
        title="Before"
        stats={before}
        channel={beforeCh}
        onChannel={setBeforeCh}
      />
      {after ? (
        <HistogramRow
          title="After"
          stats={after}
          channel={afterCh}
          onChannel={setAfterCh}
        />
      ) : (
        <section className="hist-row hist-row--empty">
          <header className="hist-row__head">
            <h4>After</h4>
          </header>
          <p>{afterEmptyHint ?? 'Run the pipeline to see the processed distribution.'}</p>
        </section>
      )}
    </div>
  )
}
