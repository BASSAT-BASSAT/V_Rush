import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'

/**
 * Ambient oscilloscope-style background: layered signal waves, faint grid, scan line.
 */

type Layer = {
  amp: number
  cycles: number
  phase: number
  opacity: number
  strokeWidth: number
  gradient: 'violet' | 'cyan' | 'pink'
  speedSec: number
  yPct: number
}

const TILE_W = 1200
const TILE_H = 900

function wavePath(amp: number, cycles: number, phase: number, yCenter: number, steps = 220): string {
  let d = `M 0 ${(yCenter + Math.sin(phase) * amp).toFixed(2)}`
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * TILE_W
    const y = yCenter + Math.sin((i / steps) * cycles * Math.PI * 2 + phase) * amp
    d += ` L ${x.toFixed(1)} ${y.toFixed(2)}`
  }
  return d
}

function gradId(prefix: string, name: Layer['gradient']): string {
  return `${prefix}-grad-${name}`
}

export function WaveSignalSvg({
  idPrefix = 'wave',
  className = 'wave-backdrop__svg',
  showScan = true,
}: {
  idPrefix?: string
  className?: string
  showScan?: boolean
}) {
  const reduced = useReducedMotion()

  const layers = useMemo<Layer[]>(
    () => [
      { amp: 58, cycles: 4, phase: 0, opacity: 0.55, strokeWidth: 1.5, gradient: 'violet', speedSec: 34, yPct: 0.22 },
      { amp: 42, cycles: 6, phase: Math.PI / 2, opacity: 0.5, strokeWidth: 1.2, gradient: 'cyan', speedSec: 44, yPct: 0.48 },
      { amp: 70, cycles: 3, phase: Math.PI, opacity: 0.42, strokeWidth: 1.35, gradient: 'pink', speedSec: 58, yPct: 0.7 },
      { amp: 26, cycles: 9, phase: Math.PI * 0.3, opacity: 0.3, strokeWidth: 1.0, gradient: 'cyan', speedSec: 24, yPct: 0.85 },
    ],
    [],
  )

  const gridId = `${idPrefix}-grid`
  const violetId = gradId(idPrefix, 'violet')
  const cyanId = gradId(idPrefix, 'cyan')
  const pinkId = gradId(idPrefix, 'pink')

  return (
    <svg className={className} viewBox={`0 0 ${TILE_W} ${TILE_H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={violetId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3aed" stopOpacity="0" />
          <stop offset="0.25" stopColor="#7c3aed" stopOpacity="1" />
          <stop offset="0.75" stopColor="#a78bfa" stopOpacity="1" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={cyanId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="0.5" stopColor="#22d3ee" stopOpacity="1" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={pinkId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f472b6" stopOpacity="0" />
          <stop offset="0.5" stopColor="#f472b6" stopOpacity="1" />
          <stop offset="1" stopColor="#f472b6" stopOpacity="0" />
        </linearGradient>
        <pattern id={gridId} width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={TILE_W} height={TILE_H} fill={`url(#${gridId})`} />

      {layers.map((L, i) => {
        const yCenter = L.yPct * TILE_H
        const d = wavePath(L.amp, L.cycles, L.phase, yCenter)
        const stroke = `url(#${gradId(idPrefix, L.gradient)})`
        return (
          <g
            key={i}
            className="wave-backdrop__layer"
            style={reduced ? undefined : { animationDuration: `${L.speedSec}s` }}
          >
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={L.strokeWidth}
              opacity={L.opacity}
              strokeLinecap="round"
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={L.strokeWidth}
              opacity={L.opacity}
              strokeLinecap="round"
              transform={`translate(${TILE_W} 0)`}
            />
          </g>
        )
      })}

      {showScan && !reduced && (
        <rect
          className="wave-backdrop__scan"
          x="0"
          y="0"
          width="1.8"
          height={TILE_H}
          fill={`url(#${violetId})`}
          opacity="0.22"
        />
      )}
    </svg>
  )
}

/** Fixed full-viewport backdrop (AppLayout). */
export function WaveBackdrop() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  return (
    <div className="wave-backdrop" aria-hidden>
      <div className="wave-backdrop__viewport">
        <WaveSignalSvg idPrefix="wave" showScan={!isLanding} />
        <div className="wave-backdrop__vignette" />
      </div>
    </div>
  )
}
