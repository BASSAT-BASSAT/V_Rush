import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'

/**
 * Ambient oscilloscope-style background for the whole app: four layered
 * signal waves scrolling at different speeds, a faint grid, and a sweeping
 * scan line. Purely decorative — mounted once in `AppLayout` via
 * `position: fixed; inset: 0; z-index: 0` so it sits behind every route.
 */

type Layer = {
  amp: number
  cycles: number
  phase: number
  opacity: number
  strokeWidth: number
  gradientId: 'wave-grad-violet' | 'wave-grad-cyan' | 'wave-grad-pink'
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

export function WaveBackdrop() {
  const reduced = useReducedMotion()

  const layers = useMemo<Layer[]>(
    () => [
      { amp: 58, cycles: 4, phase: 0, opacity: 0.55, strokeWidth: 1.5, gradientId: 'wave-grad-violet', speedSec: 34, yPct: 0.22 },
      { amp: 42, cycles: 6, phase: Math.PI / 2, opacity: 0.5, strokeWidth: 1.2, gradientId: 'wave-grad-cyan', speedSec: 44, yPct: 0.48 },
      { amp: 70, cycles: 3, phase: Math.PI, opacity: 0.42, strokeWidth: 1.35, gradientId: 'wave-grad-pink', speedSec: 58, yPct: 0.7 },
      { amp: 26, cycles: 9, phase: Math.PI * 0.3, opacity: 0.3, strokeWidth: 1.0, gradientId: 'wave-grad-cyan', speedSec: 24, yPct: 0.85 },
    ],
    [],
  )

  return (
    <div className="wave-backdrop" aria-hidden>
      <div className="wave-backdrop__viewport">
        <svg
          className="wave-backdrop__svg"
          viewBox={`0 0 ${TILE_W} ${TILE_H}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="wave-grad-violet" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7c3aed" stopOpacity="0" />
              <stop offset="0.25" stopColor="#7c3aed" stopOpacity="1" />
              <stop offset="0.75" stopColor="#a78bfa" stopOpacity="1" />
              <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="wave-grad-cyan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="0.5" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="wave-grad-pink" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f472b6" stopOpacity="0" />
              <stop offset="0.5" stopColor="#f472b6" stopOpacity="1" />
              <stop offset="1" stopColor="#f472b6" stopOpacity="0" />
            </linearGradient>

            <pattern id="wave-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect x="0" y="0" width={TILE_W} height={TILE_H} fill="url(#wave-grid)" />

          {layers.map((L, i) => {
            const yCenter = L.yPct * TILE_H
            const d = wavePath(L.amp, L.cycles, L.phase, yCenter)
            return (
              <g
                key={i}
                className="wave-backdrop__layer"
                style={reduced ? undefined : { animationDuration: `${L.speedSec}s` }}
              >
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#${L.gradientId})`}
                  strokeWidth={L.strokeWidth}
                  opacity={L.opacity}
                  strokeLinecap="round"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#${L.gradientId})`}
                  strokeWidth={L.strokeWidth}
                  opacity={L.opacity}
                  strokeLinecap="round"
                  transform={`translate(${TILE_W} 0)`}
                />
              </g>
            )
          })}

          {!reduced && (
            <rect
              className="wave-backdrop__scan"
              x="0"
              y="0"
              width="1.8"
              height={TILE_H}
              fill="url(#wave-grad-violet)"
              opacity="0.22"
            />
          )}
        </svg>

        <div className="wave-backdrop__vignette" />
      </div>
    </div>
  )
}
